import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";

/**
 * 관리자 대시보드.
 *
 * 넷을 한 번에 묻는다(GET /api/admin/stats). 화면이 넷을 따로 물으면 기간을
 * 바꿀 때마다 요청이 네 번 나간다.
 *
 * 그림은 씀씀이가 쓰는 Recharts를 그대로 쓴다. 그려 본 적 없는 차트
 * 라이브러리를 새로 들이지 않는다.
 *
 * 손전화에서는 카드가 한 칸으로 쌓이고 넓어지면 두 칸이 된다 —
 * index.css 186절이 맡는다. 손가락으로도 읽히도록 막대 끝과 꺾은선 끝에
 * 숫자를 함께 적는다. 눌러야 값이 보이는 것은 손전화에서 안 보인다.
 */

type 셈 = {
  days: number;
  view: { name: string; n: number }[];
  feature: { name: string; n: number }[];
  error: { name: string; n: number; worst: number | null; status: number | null }[];
  write: { date: string; n: number }[];
};

/** 고를 수 있는 기간. */
const 기간들 = [7, 30, 90] as const;

/** 축 글씨. 씀씀이와 같은 크기와 빛깔을 쓴다. */
const 축 = { fontSize: 11, fill: "var(--color-text-tertiary)" } as const;

/** 그림 빛깔. 관리자 화면의 강조색을 그대로 쓴다. */
const 짙은빛 = "var(--color-primary)";

export default function AdminDash() {
  const [기간, set기간] = useState<number>(30);
  const [셈, set셈] = useState<셈 | null>(null);
  const [탈, set탈] = useState(false);

  useEffect(() => {
    let 살아있나 = true;
    set셈(null);
    set탈(false);
    axios
      .get("/admin/stats", { params: { days: 기간 }, headers: 머리() })
      .then((r) => {
        if (살아있나) set셈(r.data as 셈);
      })
      .catch(() => {
        if (살아있나) set탈(true);
      });
    return () => {
      살아있나 = false;
    };
  }, [기간]);

  return (
    <div className="admin-dash">
      <nav className="admin-days" aria-label="기간">
        {기간들.map((d) => (
          <button
            key={d}
            type="button"
            className={`ui-btn small${기간 === d ? " primary" : ""}`}
            onClick={() => set기간(d)}
          >
            최근 {d}일
          </button>
        ))}
      </nav>

      {탈 ? (
        <div className="card admin-soon">
          <p className="page-empty">셈을 불러오지 못했습니다.</p>
        </div>
      ) : !셈 ? (
        <div className="card admin-soon">
          <p className="page-empty">셈을 불러오고 있습니다.</p>
        </div>
      ) : (
        <div className="admin-grid">
          <section className="card admin-card">
            <h3 className="admin-card__title">화면별 드나든 수</h3>
            {셈.view.length === 0 ? (
              <p className="page-empty">아직 쌓인 것이 없습니다.</p>
            ) : (
              <div className="admin-card__body">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={셈.view.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 4 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={축} tickLine={false} axisLine={false} width={116} />
                    <Tooltip cursor={{ fill: "var(--color-primary-light)" }} />
                    <Bar dataKey="n" name="드나든 수" fill={짙은빛} radius={[0, 4, 4, 0]} maxBarSize={16}
                      label={{ position: "right", fontSize: 11, fill: "var(--color-text-secondary)" }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="card admin-card">
            <h3 className="admin-card__title">적고 고친 건수</h3>
            {셈.write.length === 0 ? (
              <p className="page-empty">아직 쌓인 것이 없습니다.</p>
            ) : (
              <div className="admin-card__body">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={셈.write} margin={{ top: 12, right: 12, bottom: 4, left: -16 }}>
                    <CartesianGrid stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="date" tick={축} tickLine={false} axisLine={false}
                      interval="preserveStartEnd" tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={축} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="n" name="건수" stroke={짙은빛} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="card admin-card">
            <h3 className="admin-card__title">기능별 쓰임</h3>
            {셈.feature.length === 0 ? (
              <p className="page-empty">아직 쌓인 것이 없습니다.</p>
            ) : (
              <div className="admin-card__body">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={셈.feature.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 4 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={축} tickLine={false} axisLine={false} width={116} />
                    <Tooltip cursor={{ fill: "var(--color-primary-light)" }} />
                    <Bar dataKey="n" name="쓰임" fill={짙은빛} radius={[0, 4, 4, 0]} maxBarSize={16}
                      label={{ position: "right", fontSize: 11, fill: "var(--color-text-secondary)" }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="card admin-card">
            <h3 className="admin-card__title">오류와 느린 요청</h3>
            {셈.error.length === 0 ? (
              <p className="page-empty">아직 쌓인 것이 없습니다.</p>
            ) : (
              <ul className="admin-slow">
                {셈.error.slice(0, 8).map((r) => (
                  <li key={r.name} className="admin-slow__row">
                    <span className="admin-slow__path">{r.name}</span>
                    <span className="admin-slow__n">{r.n}회</span>
                    <span className={`admin-slow__ms${r.status && r.status >= 400 ? " is-bad" : ""}`}>
                      {r.status && r.status >= 400 ? r.status : `${r.worst ?? 0}ms`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
