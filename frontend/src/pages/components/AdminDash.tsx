import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type YAxisTickContentProps,
} from "recharts";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import useAdminPeriod from "../../hooks/useAdminPeriod";
import AdminPeriodBar from "./AdminPeriodBar";
import { PAGE_TITLE, HOME_TABS, ENTRY_TABS, SETTING_TABS } from "../../utils/pageTitles";
import { ADMIN_TABS } from "../../utils/adminTabs";
import AdminFilterPopup from "./AdminFilterPopup";
import DayPicker from "./DayPicker";
import { EditField } from "./CardEditModal";

/**
 * 관리자 대시보드.
 *
 * 한 번에 다 묻는다(GET /api/admin/stats). 화면이 따로따로 물으면 기간을
 * 바꿀 때마다 요청이 그만큼 나간다. 집계가 싸므로 한 번에 모아 받는다.
 *
 * 그림은 씀씀이가 쓰는 Recharts를 그대로 쓴다. 그려 본 적 없는 차트
 * 라이브러리를 새로 들이지 않는다. 맨 위 칸도 씀씀이의 것(.chart-tiles,
 * .chart-tile)을 그대로 쓴다.
 *
 * 손전화에서는 카드가 한 칸으로 쌓이고, 넓어지면 두 칸이 된다(index.css
 * 186절). 손가락으로도 읽히도록 막대 끝과 꺾은선 끝에 숫자를
 * 함께 적는다. 눌러야 값이 보이는 것은 손전화에서 안 보인다.
 */

type 집계 = {
  days: number;
  from: string;
  to: string;
  view: { name: string; n: number }[];
  feature: { name: string; n: number }[];
  slow: { name: string; n: number; worst: number | null }[];
  fail: { name: string; n: number; status: number | null }[];
  write: { date: string; n: number }[];
  daily: { date: string; n: number }[];
  dow: { name: string; n: number }[];
  hour: { name: string; n: number }[];
  kpi: {
    view: number;
    feature: number;
    slow: number;
    fail: number;
    write: number;
    view_per_day: number;
  };
};


/**
 * 축 글씨.
 *
 * 12px이다. 씀씀이는 11px인데, 여기는 한 쪽에 그림이 일곱이라 11px로는 축이
 * 죄 잿빛 실처럼 깔려 읽히지 않았다.
 */
const 축글씨 = 12;
const 축 = { fontSize: 축글씨, fill: "var(--color-text-tertiary)" } as const;

/**
 * 그림 빛깔. 옅은 다섯 가지다.
 *
 * 한 가지 짙은 빛깔로 모든 그림을 그렸더니 어느 칸이 무엇을 재는지 빛깔로는
 * 갈리지 않았다. 그림마다 한 가지를 맡기고, 막대 여럿이 한 칸에 설 때는
 * 차례대로 돌려 쓴다. 옅은 빛깔이라 숫자 글씨를 덮지 않는다.
 *
 * 값을 여기 적는 까닭은 관리자 쪽이 빛깔 벌을 따르지 않기 때문이다. 사용자
 * 쪽 그림은 선택한 벌에서 꺼내 쓰는데(utils/palettes.ts), 여기는 늘 한 결로
 * 선다.
 */
const 파스텔 = ["#B9A4E6", "#9FC6E8", "#A6DACE", "#F2C7A3", "#E8A9C3"] as const;

/**
 * 관리자 사이트의 자리들.
 *
 * 탭마다 첫 쪽이 있고 그 안에 페이지가 있다. 자리마다 따로 적히므로
 * (pages/Admin.tsx) 여기서도 따로 센다. 목록은 등록부에서 꺼내 쓴다
 * (utils/adminTabs.ts). 전에는 이름을 여기 다시 적어서, 자리를 하나
 * 늘리면 두 곳을 함께 고쳐야 했다.
 *
 * 탭 첫 쪽도 함께 넣는다. 들어가는 문이라 따로 떼면 그 탭에 몇 번 들렀는지가
 * 사라진다. 사용자 쪽 탭을 묶을 때와 같은 잣대다.
 */
const 관리자자리 = ADMIN_TABS.flatMap((t) => [
  { path: t.path, name: t.name },
  ...t.pages.map((p) => ({ path: p.path, name: p.name })),
]);

/**
 * 옛 기록. 자리를 따로 적기 전에는 다섯이 이 한 줄로 뭉쳐 쌓였다.
 *
 * 메인 탭의 길도 /admin 이라 등록부에 이미 들어 있다. 그래서 따로 세우지
 * 않고, 딱지 이름만 그때의 뜻으로 적는다.
 */
const 옛관리자 = "/admin";

/**
 * 사용자 화면을 탭으로 묶는다.
 *
 * 열아홉을 한 줄로 늘어놓으면 어느 탭을 얼마나 쓰는지가 안 읽혔다. 탭이
 * 품는 화면은 앱이 한 곳에서 쥐고 있으므로(utils/pageTitles.ts) 그 목록을
 * 그대로 쓴다.
 *
 * 탭의 첫 화면도 그 탭에 함께 넣는다. 들어가는 문이라 따로 떼면 그 탭에
 * 몇 번 들렀는지가 사라진다. 곁가지 화면(씀씀이 내역, 기간 내역)은 어느
 * 탭에 딸린 것인지 여기서 적는다. 탭 목록에는 들지 않기 때문이다.
 */
const 탭묶음 = [
  { 이름: "홈 탭", 길: [...HOME_TABS, "/charts/detail"] },
  { 이름: "내역 탭", 길: ["/history", ...ENTRY_TABS, "/calendar/detail"] },
  { 이름: "설정 탭", 길: ["/settings", ...SETTING_TABS] },
] as const;

/**
 * 기능 여덟과 그것이 무엇을 하는 자리인지.
 *
 * 기록을 남기는 자리가 넷뿐이라(utils/track.ts의 기능적기를 부르는 곳)
 * 나올 수 있는 이름이 여덟이다. 한 번도 안 쓰인 것도 0으로 세워야 무엇을
 * 쓰고 무엇을 안 쓰는지 읽힌다.
 */
const 기능들 = [
  { name: "쓰기", desc: "새 지출 적기 버튼" },
  { name: "쓰기 슬라이드", desc: "한 장씩 넘기며 작성" },
  { name: "계산기", desc: "Calculator 버튼" },
  { name: "대기 내역", desc: "한 장씩 넘겨 전송" },
  { name: "잔소리", desc: "잔소리 버튼" },
  { name: "엑셀 내보내기", desc: "필터 그대로 엑셀로" },
  { name: "영수증", desc: "선택한 내역을 영수증으로" },
  { name: "묶기", desc: "선택한 내역을 묶음으로" },
] as const;

/**
 * 딱지 폭 어림잡기.
 *
 * SVG 안에서는 글자 폭을 그리기 전에 알 수 없다. 11px 글씨에서 한글 한 자가
 * 9.5px, 빈칸이 3px, 나머지가 6px로 나오므로 그렇게 어림잡고 좌우 여백 14px을
 * 더한다. 한글을 11px로 잡았더니 테가 6px쯤 넓어 글이 헐렁해 보였다.
 * 몇 px 어긋나도 글을 테 복판에 묶으므로 쏠려 보이지는 않는다.
 */
function 딱지폭(글: string): number {
  const 배 = 축글씨 / 11;
  let w = 0;
  for (const ch of 글) {
    if (/[가-힣]/.test(ch)) w += 9.5 * 배;
    else if (ch === " ") w += 3 * 배;
    else w += 6 * 배;
  }
  return Math.round(w) + 14;
}

/** 세로 막대 눈금이 쓰는 폭. YAxis의 width와 같아야 글이 왼쪽 끝에 선다. */
const 눈금폭 = 128;

/** 줄 하나가 먹는 키. 딱지 한 줄과 곁말 한 줄이 겹치지 않는 가장 작은 값이다. */
const 줄키 = 33;

/**
 * 세로 막대의 눈금. 두 줄로 적는다.
 *
 * 윗줄이 이름 딱지, 아랫줄이 그것이 무엇인지 적는 곁말이다. 한 줄에 둘을
 * 나란히 두면 360px 화면에서 긴 글과 딱지가 서로를 밀어낸다.
 *
 * 자리를 센다. 줄 사이가 31px이므로 딱지는 복판 위 16px에 14px 키로 서고,
 * 곁말은 복판 아래 10px에 앉는다. 이보다 벌리면 곁말 위로 다음 줄 딱지가
 * 내려와 겹친다.
 */
function 두줄눈금(풀기: (v: string) => { 딱지: string; 곁말: string }) {
  return function 눈금({ x, y, payload }: YAxisTickContentProps) {
    const { 딱지, 곁말 } = 풀기(String(payload?.value ?? ""));
    const 왼 = Number(x ?? 0) - 눈금폭;
    const 복판 = Number(y ?? 0);
    /* 딱지 안 글은 테 복판에 놓는다. 왼쪽에서 7px 띄우고 글을 흘리면, 테
       폭을 어림잡은 값과 실제 글 폭이 어긋난 만큼 글이 한쪽으로 쏠린다.
       가운데로 묶으면 어긋나도 좌우가 똑같이 남아 쏠려 보이지 않는다.
       세로도 baseline 대신 테 복판(dominantBaseline)에 맞춘다. */
    const 폭 = 딱지폭(딱지);
    return (
      <g>
        <rect
          x={왼}
          y={복판 - 17}
          width={폭}
          height={15}
          rx={7.5}
          fill="var(--color-primary-light)"
        />
        <text
          x={왼 + 폭 / 2}
          y={복판 - 9.5}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={축글씨}
          fontWeight={600}
          fill="var(--color-primary)"
        >
          {딱지}
        </text>
        <text x={왼} y={복판 + 11} fontSize={축글씨} fill="var(--color-text-tertiary)">
          {곁말}
        </text>
      </g>
    );
  };
}

/* 화면은 이름이 딱지, 길이 곁말이다. 기능은 이름이 딱지, 하는 일이 곁말이다. */
const 화면눈금 = 두줄눈금((길) => ({
  딱지:
    관리자자리.find((z) => z.path === 길)?.name ??
    (길 === 옛관리자 ? "관리자" : PAGE_TITLE[길] ?? 길),
  곁말: 길,
}));

const 기능눈금 = 두줄눈금((이름) => ({
  딱지: 이름,
  곁말: 기능들.find((f) => f.name === 이름)?.desc ?? "",
}));

/**
 * 쌓인 집계에 없는 줄을 0으로 채운다.
 *
 * 쌓인 것만 그리면 한 번도 안 쓰인 자리가 그래프에서 사라져, 안 쓰이는 것과
 * 아예 없는 것이 구별되지 않는다. 차례는 많이 쓰인 것부터다.
 */
function 영채우기(들: { name: string; n: number }[], 이름들: readonly string[]) {
  const 집계 = new Map(들.map((r) => [r.name, r.n]));
  return 이름들
    .map((name) => ({ name, n: 집계.get(name) ?? 0 }))
    .sort((a, b) => b.n - a.n);
}

/** 짙게 그을 자리. 꺾은선과 테두리에 쓴다. */
const 짙은빛 = "var(--color-primary)";

export default function AdminDash() {
  /* 언제 것을 보는가. 관리자 쪽 다섯 쪽과 같은 것을 쓴다
     (hooks/useAdminPeriod.ts). */
  const 때 = useAdminPeriod();
  const 기간 = 때.기간;
  /* 팝업 안에서 고치는 중인 조건. [적용]을 누르지 않고 닫으면 버린다.
     사용자 화면의 거르기와 같다(pages/Entries.tsx의 filter/appliedFilter). */
  const [초안, set초안] = useState({ frm: "", to: "" });
  const [필터열림, set필터열림] = useState(false);
  const [집계, set집계] = useState<집계 | null>(null);
  const [탈, set탈] = useState(false);

  /* 거르기를 연다. 지금 걸려 있는 조건을 그대로 띄운다. 걸린 것이 없으면
     보고 있는 기간을 채운다. 빈 칸부터 넣게 하면 날마다 두 번 넣는다. */
  const 필터열기 = () => {
    set초안(때.거른기간 ?? { frm: 기간.frm, to: 기간.to });
    set필터열림(true);
  };

  /* 거르기를 건다. 둘 다 비면 거르기를 풀고 달 단위로 돌아간다. */
  const 적용 = () => {
    if (!때.기간걸기(초안.frm, 초안.to)) return;
    set필터열림(false);
  };

  useEffect(() => {
    let 살아있나 = true;
    /* 앞서 받은 집계를 비우지 않는다. 비우면 격자가 통째로 사라졌다가 다시
       서면서 카드 키가 크게 튄다. 기간을 바꾸는 동안에는 옛 값을 그대로
       두고, 새 값이 오면 조용히 갈아 끼운다. */
    set탈(false);
    axios
      .get("/admin/stats", { params: { frm: 기간.frm, to: 기간.to }, headers: 머리() })
      .then((r) => {
        if (살아있나) set집계(r.data as 집계);
      })
      .catch(() => {
        if (살아있나) set탈(true);
      });
    return () => {
      살아있나 = false;
    };
  }, [기간.frm, 기간.to]);

  /* 화면 조회를 탭마다 가르고, 빠진 화면은 0으로 채운다. 이름표는 앱이 쥔
     목록에서 그대로 꺼낸다(utils/pageTitles.ts). 옛 기록의 /admin 한 줄은
     관리자 묶음에 함께 세운다. */
  const 관리자조회 = useMemo(
    () =>
      집계
        ? 영채우기(집계.view, 관리자자리.map((z) => z.path)).filter(
            (r) => r.name !== 옛관리자 || r.n > 0,
          )
        : [],
    [집계],
  );
  /* 그림에 먹이는 목록은 집계가 바뀔 때만 새로 짓는다.
     그릴 때마다 새 배열을 지었더니 Recharts가 값이 바뀐 줄 알고 막대를
     처음부터 다시 그렸다. 거르기 팝업이 이 화면 안에 살아서, 날짜 한 번
     선택할 때마다 뒤쪽 그림 일곱이 통째로 깜빡였다. */
  const 조회묶음 = useMemo(
    () => [
      ...탭묶음.map((탭) => ({ 이름: 탭.이름, 들: 집계 ? 영채우기(집계.view, 탭.길) : [] })),
      { 이름: "관리자 화면", 들: 관리자조회 },
    ],
    [집계, 관리자조회],
  );
  const 기능조회 = useMemo(
    () => (집계 ? 영채우기(집계.feature, 기능들.map((f) => f.name)) : []),
    [집계],
  );

  /** 그림 한 칸. 머리글과 몸을 늘 같은 꼴로 세운다. */
  const 칸 = (
    제목: string,
    비었나: boolean,
    안: React.ReactNode,
    넓게 = false,
    /* 눈금이 두 줄인 칸. 여덟 줄이 한 줄일 때는 196px에 들었는데, 딱지가
       한 줄 더 붙으면서 줄마다 28px이 든다. */
    높게 = false,
  ) => (
    <section className={`card admin-card${넓게 ? " admin-card--wide" : ""}`}>
      <h3 className="admin-card__title">{제목}</h3>
      <div className={`admin-card__body${높게 ? " admin-card__body--tall" : ""}`}>
        {/* 0이어도 그린다. 비었다고 글만 띄우면 그 기간에 아무 일도 없었다는
            것과 아예 안 재고 있다는 것이 구별되지 않는다. 비었다는 알림은
            그릴 거리 자체가 없을 때만 쓴다. */}
        {비었나 ? <p className="page-empty">아직 쌓인 것이 없습니다.</p> : 안}
      </div>
    </section>
  );

  return (
    <div className="admin-dash">
      {/* 언제 것을 보는가. 다섯 쪽과 같은 막대를 쓴다(AdminPeriodBar.tsx). */}
      <AdminPeriodBar 때={때} on필터={필터열기} />

      {탈 ? (
        <div className="card admin-soon">
          <p className="page-empty">불러오지 못했습니다.</p>
        </div>
      ) : !집계 ? (
        <div className="card admin-soon">
          <p className="page-empty">불러오는 중입니다.</p>
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
              { 이름: "조회", 값: 집계.kpi.view, 단위: "회", 딱지: `평균 ${집계.kpi.view_per_day}회` },
              { 이름: "쓰고 수정", 값: 집계.kpi.write, 단위: "건", 딱지: `${집계.days}일` },
              { 이름: "사용 횟수", 값: 집계.kpi.feature, 단위: "회", 딱지: "기능" },
              /* 실패와 느린 요청은 다른 것이다. 하나로 세어 「오류 66회」로
                 적었더니 무엇이 66인지 알 길이 없었다. 수는 실패가 쥐고,
                 느린 쪽은 딱지로 적는다. 칸을 다섯으로 늘리지 않은 것은
                 두 칸씩 서는 격자에서 다섯째가 혼자 남기 때문이다. */
              { 이름: "실패", 값: 집계.kpi.fail, 단위: "회", 딱지: `느린 요청 ${집계.kpi.slow}회` },
            ].map((t) => (
              <div key={t.이름} className="chart-tile admin-tile">
                {/* 딱지는 이름 옆에 선다. 칸은 두 줄 그대로이고, 아랫줄은
                    수가 통째로 쓴다. 딱지를 수와 한 줄에 두니 360px
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
              "날짜별 조회 수",
              false,
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={집계.daily} margin={{ top: 12, right: 12, bottom: 4, left: -8 }}>
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
                    name="조회 수"
                    stroke={짙은빛}
                    strokeWidth={2}
                    fill="url(#admin-area)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>,
              true,
            )}

            {/* 탭마다 한 묶음씩 가른다. 열아홉을 한 줄로 늘어놓으면 어느
                탭을 얼마나 쓰는지가 안 읽혔고, /admin 자리들이 사용자 화면
                사이에 끼어 어느 쪽인지도 갈리지 않았다. */}
            <section className="card admin-card admin-card--wide">
              <h3 className="admin-card__title">화면별 조회 수</h3>
              <div className="admin-card__body admin-card__body--parts admin-card__body--auto">
                {조회묶음.map((묶음, 몇) => (
                  <div key={묶음.이름} className="admin-part">
                    <span className="admin-part__head">
                      {묶음.이름}
                      <span className="admin-part__n">
                        {묶음.들.reduce((a, r) => a + r.n, 0)}회
                      </span>
                    </span>
                    {/* 키를 줄 수로 못 박는다. 줄 수는 화면 수라 늘 같으므로,
                        기간을 바꿔도 칸이 들썩이지 않는다. */}
                    <div style={{ height: 묶음.들.length * 줄키 + 8 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={묶음.들}
                          layout="vertical"
                          /* 왼쪽을 4px이 아니라 8px 비운다. 눈금 글이 왼쪽
                             끝에 붙어 서는데, 4px이면 길 앞의 빗금이 카드
                             안쪽 테에 1px 걸려 잘렸다. */
                          margin={{ top: 4, right: 28, bottom: 4, left: 8 }}
                        >
                          <XAxis type="number" hide />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={화면눈금}
                            tickLine={false}
                            axisLine={false}
                            width={눈금폭}
                          />
                          <Tooltip separator=": " cursor={{ fill: "var(--color-primary-light)" }} />
                          <Bar dataKey="n" name="조회 수" radius={[0, 4, 4, 0]} maxBarSize={16} minPointSize={1} isAnimationActive={false}>
                            {/* 수를 Bar의 label이 아니라 LabelList로 적고,
                                0인 줄에도 1px짜리 막대를 세운다(minPointSize).
                                Recharts는 그려진 막대에 글을 붙이므로, 막대가
                                아예 없으면 0도 적히지 않았다. 1px은 눈에 거의
                                안 띄어 값이 있는 것처럼 읽히지 않는다. */}
                            <LabelList
                              dataKey="n"
                              position="right"
                              fontSize={축글씨}
                              fill="var(--color-text-secondary)"
                            />
                            {묶음.들.map((r, i) => (
                              <Cell key={r.name} fill={파스텔[(i + 몇 * 2) % 파스텔.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {칸(
              "요일별 조회 수",
              false,
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={집계.dow} margin={{ top: 12, right: 8, bottom: 4, left: -8 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" tick={축} tickLine={false} axisLine={false} />
                  <YAxis tick={축} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
                  <Tooltip separator=": " cursor={{ fill: "var(--color-primary-light)" }} />
                  <Bar dataKey="n" name="조회 수" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false}>
                    {집계.dow.map((r, i) => (
                      <Cell key={r.name} fill={파스텔[i % 파스텔.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>,
            )}

            {칸(
              "시간대별 조회 수",
              false,
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={집계.hour} margin={{ top: 12, right: 8, bottom: 4, left: -8 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" tick={축} tickLine={false} axisLine={false} />
                  <YAxis tick={축} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
                  <Tooltip separator=": " cursor={{ fill: "var(--color-primary-light)" }} />
                  <Bar dataKey="n" name="조회 수" radius={[4, 4, 0, 0]} maxBarSize={22} fill={파스텔[1]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>,
            )}

            {칸(
              "쓰고 수정한 건수",
              false,
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={집계.write} margin={{ top: 12, right: 12, bottom: 4, left: -8 }}>
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
                  <Line type="monotone" dataKey="n" name="건수" stroke={파스텔[2]} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>,
            )}

            {칸(
              "기능별 사용 횟수",
              false,
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={기능조회}
                  layout="vertical"
                  /* 왼쪽을 4px이 아니라 8px 비운다. 눈금 글이 왼쪽 끝에
                     붙어 서는데, 4px이면 길 앞의 빗금이 카드 안쪽 테에
                     1px 걸려 잘렸다. */
                  margin={{ top: 4, right: 28, bottom: 4, left: 8 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={기능눈금}
                    tickLine={false}
                    axisLine={false}
                    width={눈금폭}
                  />
                  <Tooltip separator=": " cursor={{ fill: "var(--color-primary-light)" }} />
                  <Bar dataKey="n" name="횟수" radius={[0, 4, 4, 0]} maxBarSize={16} minPointSize={1} isAnimationActive={false}>
                    {/* 0인 줄에도 수를 적는다. 위 화면별 칸과 같은 까닭이다. */}
                    <LabelList
                      dataKey="n"
                      position="right"
                      fontSize={축글씨}
                      fill="var(--color-text-secondary)"
                    />
                    {기능조회.map((r, i) => (
                      <Cell key={r.name} fill={파스텔[(i + 2) % 파스텔.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>,
              false,
              true,
            )}

            {/* 한 칸 안에서 둘을 가른다. 섞어 늘어놓으면 오른쪽 끝에 ms와
                상태 번호가 번갈아 서서, 한 줄이 느린 것인지 물린 것인지를
                그 번호를 읽어야 알았다. 칸을 둘로 쪼개는 대신 머리말을 둘
                두어, 무엇을 보고 있는지 줄을 읽기 전에 알게 한다. */}
            <section className="card admin-card admin-card--wide">
              <h3 className="admin-card__title">오류와 느린 요청</h3>
              {/* 느린 잣대는 화면이 쥐고 있다(utils/track.ts의 느린참). */}
              <p className="admin-hint">1초를 넘긴 것과 실패한 것을 갈라 적습니다.</p>
              <div className="admin-card__body admin-card__body--list admin-card__body--parts admin-card__body--auto">
                {[
                  {
                    이름: "1초를 넘긴 요청",
                    집계: 집계.kpi.slow,
                    들: 집계.slow.map((r) => ({ name: r.name, n: r.n, 끝: `${r.worst ?? 0}ms`, 물림: false })),
                  },
                  {
                    이름: "실패한 요청",
                    집계: 집계.kpi.fail,
                    /* 닿지 못한 요청은 상태 번호가 없다. 빈자리를 두지 않고
                       그렇게 적는다. */
                    들: 집계.fail.map((r) => ({ name: r.name, n: r.n, 끝: r.status ? String(r.status) : "못 닿음", 물림: true })),
                  },
                ].map((묶음) => (
                  <div key={묶음.이름} className="admin-part">
                    <span className="admin-part__head">
                      {묶음.이름}
                      <span className="admin-part__n">{묶음.집계}회</span>
                    </span>
                    {묶음.들.length === 0 ? (
                      <p className="page-empty">아직 쌓인 것이 없습니다.</p>
                    ) : (
                      <ul className="admin-slow">
                        {묶음.들.slice(0, 5).map((r) => (
                          <li key={r.name} className="admin-slow__row">
                            <span className="admin-slow__path">{r.name}</span>
                            <span className="admin-slow__n">{r.n}번</span>
                            <span className={`admin-slow__ms${r.물림 ? " is-bad" : ""}`}>{r.끝}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>

          </div>
        </>
      )}

      {필터열림 && (
        <AdminFilterPopup
          on초기화={() => set초안({ frm: "", to: "" })}
          on적용={적용}
          onClose={() => set필터열림(false)}
        >
          {/* 거르는 자리는 지난 어느 때로도 갈 수 있어야 한다. 머리의
              연월을 누르면 한 해가 펼쳐진다(monthJump). */}
          <EditField label="시작일" span={6}>
            <DayPicker
              monthJump
              clearable
              value={초안.frm}
              onChange={(v) => set초안({ ...초안, frm: v })}
            />
          </EditField>

          <EditField label="종료일" span={6}>
            <DayPicker
              monthJump
              clearable
              value={초안.to}
              onChange={(v) => set초안({ ...초안, to: v })}
            />
          </EditField>

          <EditField label="" span={12}>
            <p className="admin-hint">기간을 비우고 적용하면 달 단위로 돌아갑니다.</p>
          </EditField>
        </AdminFilterPopup>
      )}
    </div>
  );
}
