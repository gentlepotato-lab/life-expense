import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import MonthNav from "./MonthNav";
import useMonthSpan from "../../hooks/useMonthSpan";
import { formatDateLabel } from "../../utils/dateGroup";

/**
 * 고른 기간을 한 줄로 적는다.
 *
 * 두 끝의 해가 같으면 뒤쪽 해는 뺀다. 같은 해를 두 번 적으면 360px 화면에서
 * 알약과 한 줄에 들지 못한다. 해가 갈리는 기간(12월에서 1월로 넘길 때)에는
 * 둘 다 적는다.
 */
function 기간글(frm: string, to: string): string {
  const 앞 = formatDateLabel(frm);
  const 뒤 = formatDateLabel(to);
  const 올해 = String(new Date().getFullYear());
  /* 두 끝이 모두 올해면 해를 빼고 적는다. 바로 위 달 막대가 "2026년 10월"로
     해를 이미 말하고 있어, 딱지까지 두 번 적으면 360px 화면에서 알약과 한
     줄에 들지 못한다. 해가 갈리면 둘 다 적는다. */
  const 벗기기 = (t: string) => t.replace(/^\d{4}\.\s*/, "");
  if (frm.slice(0, 4) === 올해 && to.slice(0, 4) === 올해) {
    return `${벗기기(앞)} ~ ${벗기기(뒤)}`;
  }
  if (frm.slice(0, 4) === to.slice(0, 4)) return `${앞} ~ ${벗기기(뒤)}`;
  return `${앞} ~ ${뒤}`;
}

/**
 * 관리자 대시보드.
 *
 * 한 번에 다 묻는다(GET /api/admin/stats). 화면이 따로따로 물으면 기간을
 * 바꿀 때마다 요청이 그만큼 나간다. 셈이 싸므로 한 번에 모아 받는다.
 *
 * 그림은 씀씀이가 쓰는 Recharts를 그대로 쓴다. 그려 본 적 없는 차트
 * 라이브러리를 새로 들이지 않는다. 맨 위 칸도 씀씀이의 것(.chart-tiles,
 * .chart-tile)을 그대로 쓴다.
 *
 * 손전화에서는 카드가 한 칸으로 쌓이고, 넓어지면 두 칸이 된다(index.css
 * 186절). 손가락으로도 읽히도록 막대 끝과 꺾은선 끝에 숫자를
 * 함께 적는다. 눌러야 값이 보이는 것은 손전화에서 안 보인다.
 */

type 셈 = {
  days: number;
  from: string;
  to: string;
  view: { name: string; n: number }[];
  feature: { name: string; n: number }[];
  error: { name: string; n: number; worst: number | null; status: number | null }[];
  write: { date: string; n: number }[];
  daily: { date: string; n: number }[];
  dow: { name: string; n: number }[];
  hour: { name: string; n: number }[];
  kpi: { view: number; feature: number; error: number; write: number; view_per_day: number };
};

/** 가까운 며칠만 볼 때 쓰는 알약. 달 단위가 기본이고 이것은 곁길이다. */
const 기간들 = [7, 30, 90] as const;

/** YYYY-MM-DD로 적는다. 서버가 날짜만 받는다. */
const 날적기 = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** 그 달의 첫날과 끝날. 끝날이 오늘보다 뒤면 오늘까지만 본다. */
function 달기간(ym: string): { frm: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const 첫날 = new Date(y, m - 1, 1);
  const 끝날 = new Date(y, m, 0);
  const 오늘 = new Date();
  오늘.setHours(0, 0, 0, 0);
  return { frm: 날적기(첫날), to: 날적기(끝날 > 오늘 ? 오늘 : 끝날) };
}

/** 오늘까지 며칠. */
function 며칠(n: number): { frm: string; to: string } {
  const 오늘 = new Date();
  오늘.setHours(0, 0, 0, 0);
  const 앞 = new Date(오늘);
  앞.setDate(앞.getDate() - (n - 1));
  return { frm: 날적기(앞), to: 날적기(오늘) };
}

/** 축 글씨. 씀씀이와 같은 크기와 빛깔을 쓴다. */
const 축 = { fontSize: 11, fill: "var(--color-text-tertiary)" } as const;

/**
 * 그림 빛깔. 옅은 다섯 가지다.
 *
 * 한 가지 짙은 빛깔로 모든 그림을 그렸더니 어느 칸이 무엇을 재는지 빛깔로는
 * 갈리지 않았다. 그림마다 한 가지를 맡기고, 막대 여럿이 한 칸에 설 때는
 * 차례대로 돌려 쓴다. 옅은 빛깔이라 숫자 글씨를 덮지 않는다.
 *
 * 값을 여기 적는 까닭은 관리자 쪽이 빛깔 벌을 따르지 않기 때문이다. 사용자
 * 쪽 그림은 고른 벌에서 꺼내 쓰는데(utils/palettes.ts), 여기는 늘 한 결로
 * 선다.
 */
const 파스텔 = ["#B9A4E6", "#9FC6E8", "#A6DACE", "#F2C7A3", "#E8A9C3"] as const;

/** 짙게 그을 자리. 꺾은선과 테두리에 쓴다. */
const 짙은빛 = "var(--color-primary)";

export default function AdminDash() {
  /* 보고 있는 달. 지출 내역과 같은 꼴로 넘긴다(MonthNav). 기본은 이번 달이다. */
  const [ym, setYm] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  /* 알약으로 고른 며칠. 달을 넘기면 풀린다. 둘 가운데 하나만 걸린다. */
  const [며칠고름, set며칠고름] = useState<number | null>(null);
  const [셈, set셈] = useState<셈 | null>(null);
  const [탈, set탈] = useState(false);
  /* 넘겨 볼 수 있는 끝. 네 화면이 같은 바닥을 쓴다. */
  const { min, max } = useMonthSpan();

  const 기간 = 며칠고름 ? 며칠(며칠고름) : 달기간(ym);

  useEffect(() => {
    let 살아있나 = true;
    /* 앞서 받은 셈을 비우지 않는다. 비우면 격자가 통째로 사라졌다가 다시
       서면서 카드 키가 크게 튄다. 기간을 바꾸는 동안에는 옛 값을 그대로
       두고, 새 값이 오면 조용히 갈아 끼운다. */
    set탈(false);
    axios
      .get("/admin/stats", { params: { frm: 기간.frm, to: 기간.to }, headers: 머리() })
      .then((r) => {
        if (살아있나) set셈(r.data as 셈);
      })
      .catch(() => {
        if (살아있나) set탈(true);
      });
    return () => {
      살아있나 = false;
    };
  }, [기간.frm, 기간.to]);

  /** 그림 한 칸. 머리글과 몸을 늘 같은 꼴로 세운다. */
  const 칸 = (제목: string, 비었나: boolean, 안: React.ReactNode, 넓게 = false) => (
    <section className={`card admin-card${넓게 ? " admin-card--wide" : ""}`}>
      <h3 className="admin-card__title">{제목}</h3>
      <div className="admin-card__body">
        {비었나 ? <p className="page-empty">아직 쌓인 것이 없습니다.</p> : 안}
      </div>
    </section>
  );

  return (
    <div className="admin-dash">
      <div className="pm-toolbar-row admin-toolbar-row">
        <MonthNav
          ym={ym}
          onChange={(v) => {
            set며칠고름(null);
            setYm(v);
          }}
          min={min}
          max={max}
        />
      </div>

      {/* 둘째 줄. 고른 기간과 알약이 한 벌로 선다. 딱지가 왼쪽 끝, 알약이
          오른쪽 끝이다. 딱지를 따로 떼어 두었더니 알약과 멀찍이 떨어져
          둘이 한 벌로 안 읽혔다. */}
      <div className="pm-toolbar-row admin-toolbar-row">
        <span className="admin-span__tag">{기간글(기간.frm, 기간.to)}</span>
        <nav className="admin-days" aria-label="기간">
          {/* 「최근」은 셋이 함께 이고 있는 말이라 글자로만 한 번 적는다.
              누르는 자리는 며칠인지뿐이다. 모두 펼치기 묶음과 같은 꼴이다
              (CollapseToggle.tsx의 .set-bulk__all). */}
          <span className="admin-days__all" aria-hidden="true">
            최근
          </span>
          {기간들.map((d) => (
            <button
              key={d}
              type="button"
              className={`ui-btn small${며칠고름 === d ? " primary" : ""}`}
              aria-label={`최근 ${d}일`}
              onClick={() => set며칠고름(며칠고름 === d ? null : d)}
            >
              {d}일
            </button>
          ))}
        </nav>
      </div>

      {탈 ? (
        <div className="card admin-soon">
          <p className="page-empty">셈을 불러오지 못했습니다.</p>
        </div>
      ) : !셈 ? (
        <div className="card admin-soon">
          <p className="page-empty">셈을 불러오고 있습니다.</p>
        </div>
      ) : (
        <>
          {/* 맨 위 칸. 기간 안의 합계를 한눈에 적는다. */}
          <div className="chart-tiles admin-tiles">
            {/* 값과 단위를 한 줄에 둔다. 단위가 제 줄을 차지하면 칸이 세
                줄짜리가 되어 쓸데없이 키를 먹는다. */}
            {[
              /* 딱지는 짧게 적는다. 360px 화면에서 칸 하나가 162px이고, 수와
                 단위가 먼저 자리를 차지한 뒤 딱지에 남는 폭이 80px 남짓이다.
                 길게 적으면 꼬리가 잘려 아무 말도 아니게 된다. */
              { 이름: "조회", 값: 셈.kpi.view, 단위: "회", 딱지: `평균 ${셈.kpi.view_per_day}회` },
              { 이름: "쓰고 수정", 값: 셈.kpi.write, 단위: "건", 딱지: `${셈.days}일` },
              { 이름: "사용 횟수", 값: 셈.kpi.feature, 단위: "회", 딱지: "기능" },
              { 이름: "오류", 값: 셈.kpi.error, 단위: "회", 딱지: "느린 요청" },
            ].map((t) => (
              <div key={t.이름} className="chart-tile admin-tile">
                {/* 딱지는 이름 옆에 선다. 칸은 두 줄 그대로이고, 아랫줄은
                    수가 통째로 쓴다. 딱지를 수와 한 줄에 두었더니 360px
                    화면에서 셋이 140px을 나눠 가지느라 딱지가 잘렸다. */}
                <span className="admin-tile__head">
                  <span className="chart-tile__label">{t.이름}</span>
                  <span className="admin-tile__tag">{t.딱지}</span>
                </span>
                <span className="admin-tile__row">
                  <span className="chart-tile__value">{t.값.toLocaleString("ko-KR")}</span>
                  <span className="admin-tile__unit">{t.단위}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="admin-grid">
            {칸(
              "날짜별 조회",
              셈.daily.length === 0,
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={셈.daily} margin={{ top: 12, right: 12, bottom: 4, left: -8 }}>
                  <defs>
                    <linearGradient id="admin-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={파스텔[0]} stopOpacity={0.8} />
                      <stop offset="100%" stopColor={파스텔[0]} stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={축}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis tick={축} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
                  <Tooltip separator=": " />
                  <Area
                    type="monotone"
                    dataKey="n"
                    name="조회"
                    stroke={짙은빛}
                    strokeWidth={2}
                    fill="url(#admin-area)"
                  />
                </AreaChart>
              </ResponsiveContainer>,
              true,
            )}

            {칸(
              "화면별 조회 수",
              셈.view.length === 0,
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={셈.view.slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 4, right: 28, bottom: 4, left: 4 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={축}
                    tickLine={false}
                    axisLine={false}
                    width={116}
                  />
                  <Tooltip separator=": " cursor={{ fill: "var(--color-primary-light)" }} />
                  <Bar dataKey="n" name="조회" radius={[0, 4, 4, 0]} maxBarSize={16}
                    label={{ position: "right", fontSize: 11, fill: "var(--color-text-secondary)" }}>
                    {셈.view.slice(0, 8).map((r, i) => (
                      <Cell key={r.name} fill={파스텔[i % 파스텔.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>,
            )}

            {칸(
              "요일별 조회",
              셈.dow.every((r) => r.n === 0),
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={셈.dow} margin={{ top: 12, right: 8, bottom: 4, left: -8 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" tick={축} tickLine={false} axisLine={false} />
                  <YAxis tick={축} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
                  <Tooltip separator=": " cursor={{ fill: "var(--color-primary-light)" }} />
                  <Bar dataKey="n" name="조회" radius={[4, 4, 0, 0]} maxBarSize={22}>
                    {셈.dow.map((r, i) => (
                      <Cell key={r.name} fill={파스텔[i % 파스텔.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>,
            )}

            {칸(
              "시간대별 조회",
              셈.hour.every((r) => r.n === 0),
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={셈.hour} margin={{ top: 12, right: 8, bottom: 4, left: -8 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" tick={축} tickLine={false} axisLine={false} />
                  <YAxis tick={축} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
                  <Tooltip separator=": " cursor={{ fill: "var(--color-primary-light)" }} />
                  <Bar dataKey="n" name="조회" radius={[4, 4, 0, 0]} maxBarSize={22} fill={파스텔[1]} />
                </BarChart>
              </ResponsiveContainer>,
            )}

            {칸(
              "쓰고 수정한 건수",
              셈.write.length === 0,
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={셈.write} margin={{ top: 12, right: 12, bottom: 4, left: -8 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={축}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis tick={축} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
                  <Tooltip separator=": " />
                  <Line type="monotone" dataKey="n" name="건수" stroke={파스텔[2]} strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>,
            )}

            {칸(
              "기능별 사용 횟수",
              셈.feature.length === 0,
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={셈.feature.slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 4, right: 28, bottom: 4, left: 4 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={축}
                    tickLine={false}
                    axisLine={false}
                    width={116}
                  />
                  <Tooltip separator=": " cursor={{ fill: "var(--color-primary-light)" }} />
                  <Bar dataKey="n" name="횟수" radius={[0, 4, 4, 0]} maxBarSize={16}
                    label={{ position: "right", fontSize: 11, fill: "var(--color-text-secondary)" }}>
                    {셈.feature.slice(0, 8).map((r, i) => (
                      <Cell key={r.name} fill={파스텔[(i + 2) % 파스텔.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>,
            )}

            <section className="card admin-card">
              <h3 className="admin-card__title">오류와 느린 요청</h3>
              {/* 무엇을 모은 자리인지 적는다. 길과 횟수와 걸린 시간만 보고는
                  이것이 무엇을 재는지 알 수 없다. 느린 잣대는 화면이 쥐고
                  있다(utils/track.ts의 느린참, 1000ms). */}
              <p className="admin-hint">1초를 넘겼거나 실패한 요청입니다.</p>
              <div className="admin-card__body admin-card__body--list">
                {셈.error.length === 0 ? (
                  <p className="page-empty">아직 쌓인 것이 없습니다.</p>
                ) : (
                  <ul className="admin-slow">
                    {셈.error.slice(0, 8).map((r) => (
                      <li key={r.name} className="admin-slow__row">
                        <span className="admin-slow__path">{r.name}</span>
                        <span className="admin-slow__n">{r.n}번</span>
                        <span className={`admin-slow__ms${r.status && r.status >= 400 ? " is-bad" : ""}`}>
                          {r.status && r.status >= 400 ? r.status : `${r.worst ?? 0}ms`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
