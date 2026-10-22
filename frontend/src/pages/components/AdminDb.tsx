import { useEffect, useState } from "react";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";

/**
 * DB.
 *
 * 읽기만 하는 자리다. 고치는 길은 두지 않는다. 여기서 표를 건드릴 수 있게
 * 하면 관리자 화면 하나로 자료를 통째로 날릴 수 있다.
 *
 * 맨 위에 몫 띠 하나가 선다. 쌓인 줄이 어느 표에 몰려 있는지는 수를 읽어서는
 * 잡히지 않는다 — 지출 내역과 조회 기록 둘이 여든 몫을 넘게 쥐고 있다는
 * 것이 띠에서는 한눈에 보인다. 낱낱의 수는 아래 표가 말한다.
 *
 * 몫은 수를 그대로 쓴다. 가장 많은 표와 가장 적은 표가 천 배 넘게 벌어져
 * 있어, 작은 표를 눈에 보이게 부풀리면 띠가 거짓말을 한다. 그래서 작은 것은
 * 「그 밖」으로 모아 한 칸에 담는다.
 *
 * 비밀번호는 띄우지 않는다. 서버가 아예 내놓지 않는다
 * (app/routers/admin.py의 /admin/db).
 */

type 집계 = {
  server: {
    /** DB 종류. 지금은 PostgreSQL 하나뿐이다. */
    kind: string;
    version: string;
    host: string;
    db: string;
    schema: string;
  };
  tables: { table: string; name: string; n: number }[];
};

/**
 * 몫 띠에 따로 설 칸의 빛깔.
 *
 * 딱지와 같은 파스텔 벌에서 가져온다. 띠는 글씨를 얹지 않는 자리라 바탕보다
 * 한 결 짙은 쪽을 쓴다 — 옅은 쪽을 그대로 깔면 칸과 칸이 갈리지 않는다.
 */
const 몫빛 = ["#C4A3E8", "#9CC2E8", "#A8DAD5", "#E8BC9C", "#B9D6A0"];

/** 「그 밖」으로 모인 칸. 값이 아닌 칸이라 잿빛이다. */
const 그밖빛 = "#CFD4DA";

/** 띠에 따로 세울 칸의 최소 몫. 이보다 작으면 금 하나보다 얇아진다. */
const 최소몫 = 0.03;

export default function AdminDb() {
  const [집계, set집계] = useState<집계 | null>(null);
  /* 차지한 자리는 따로 묻는다. 그 한 질의가 400ms를 먹어, 함께 물으면 쪽
     전체가 그만큼 늦게 떴다(app/routers/admin.py의 /admin/db-size). */
  const [크기, set크기] = useState<string | null>(null);
  const [탈, set탈] = useState(false);

  useEffect(() => {
    let 살아있나 = true;
    axios
      .get("/admin/db", { headers: 머리() })
      .then((r) => {
        if (살아있나) set집계(r.data as 집계);
      })
      .catch(() => {
        if (살아있나) set탈(true);
      });
    axios
      .get("/admin/db-size", { headers: 머리() })
      .then((r) => {
        if (살아있나) set크기((r.data as { size: string }).size);
      })
      .catch(() => {
        /* 못 재도 나머지는 보인다. 그 줄만 빈 채로 둔다. */
      });
    return () => {
      살아있나 = false;
    };
  }, []);

  if (탈) {
    return (
      <div className="card admin-soon">
        <p className="page-empty">불러오지 못했습니다.</p>
      </div>
    );
  }

  if (!집계) {
    return (
      <div className="card admin-soon">
        <p className="page-empty">불러오는 중입니다.</p>
      </div>
    );
  }

  const 모두 = 집계.tables.reduce((s, t) => s + t.n, 0);

  /* 많은 것부터 세우고, 최소몫에 못 미치는 것은 「그 밖」 한 칸으로 모은다.
     원래 차례는 아래 표가 지킨다 — 거기는 무엇이 있는지를 보는 자리다. */
  const 큰것 = 집계.tables
    .filter((t) => 모두 > 0 && t.n / 모두 >= 최소몫)
    .sort((a, b) => b.n - a.n)
    .slice(0, 몫빛.length);
  const 큰것합 = 큰것.reduce((s, t) => s + t.n, 0);
  const 그밖 = 모두 - 큰것합;

  /** 몫을 백분으로. 한 자리까지만 적는다. */
  const 몫글 = (n: number) => (모두 > 0 ? `${Math.round((n / 모두) * 100)}%` : "0%");

  const 칸들 = [
    ...큰것.map((t, i) => ({ key: t.table, name: t.name, n: t.n, color: 몫빛[i] })),
    ...(그밖 > 0 ? [{ key: "etc", name: "그 밖", n: 그밖, color: 그밖빛 }] : []),
  ];

  /* 줄 이름은 서버가 쥔 말을 그대로 쓴다(app/routers/admin.py의 /admin/db).
     주소는 IP 주소에 문이 붙은 꼴이라(127.0.0.1:5432) 「IP 주소」가 아니라
     「주소」다(AdminLoginLog.tsx의 IP 주소 칸과 가려 적는다). */
  const 서버줄 = [
    /* 버전은 종류 옆에 딱지로 붙인다. 줄을 따로 세우면 「PostgreSQL」과
       「17.6」이 떨어져 앉아 서로 다른 것처럼 읽힌다. */
    { 이름: "종류", 값: 집계.server.kind, 글꼴: false, 딱지: 집계.server.version },
    { 이름: "DB", 값: 집계.server.db, 글꼴: true },
    { 이름: "스키마", 값: 집계.server.schema, 글꼴: true },
    { 이름: "주소", 값: 집계.server.host, 글꼴: true },
    { 이름: "크기", 값: 크기 || "", 글꼴: false },
  ];

  return (
    <div className="admin-edit">
      <section className="admin-sec">
        <h3 className="admin-sec__head">쌓인 데이터</h3>

        {/* 몫 띠. 칸마다 제 몫만큼 넓이를 가진다. 칸 사이에 바탕빛 금을
            그어 두 칸이 한 덩어리로 붙어 보이지 않게 한다. */}
        {모두 > 0 && (
          <>
            <div className="admin-share" role="img" aria-label={`쌓인 줄 ${모두.toLocaleString("ko-KR")}건의 표별 몫`}>
              {칸들.map((c) => (
                <span
                  key={c.key}
                  className="admin-share__part"
                  style={{ width: `${(c.n / 모두) * 100}%`, background: c.color }}
                />
              ))}
            </div>
            {/* 어느 빛깔이 어느 표인지 적는 줄. 띠 안에 적으면 좁은 칸의
                글이 잘린다. */}
            <div className="admin-share__keys">
              {칸들.map((c) => (
                <span key={c.key} className="admin-share__key">
                  <span className="admin-share__dot" style={{ background: c.color }} />
                  {c.name} {몫글(c.n)}
                </span>
              ))}
            </div>
          </>
        )}

        <table className="admin-tbl">
          <colgroup>
            <col />
            <col style={{ width: "86px" }} />
          </colgroup>
          <thead>
            <tr>
              <th>표</th>
              <th>줄 수</th>
            </tr>
          </thead>
          <tbody>
            {집계.tables.map((t) => (
              <tr key={t.table}>
                <th>{t.name}</th>
                <td className="admin-tbl__right">{t.n.toLocaleString("ko-KR")}</td>
              </tr>
            ))}
            {/* 모두 더한 줄. 띠의 몫이 무엇에 대한 몫인지를 여기서 받는다. */}
            <tr>
              <th>모두</th>
              <td className="admin-tbl__right">{모두.toLocaleString("ko-KR")}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="admin-sec">
        <h3 className="admin-sec__head">서버 정보</h3>
        <table className="admin-tbl">
          <colgroup>
            <col style={{ width: "92px" }} />
            <col />
          </colgroup>
          <tbody>
            {서버줄.map((r) => (
              <tr key={r.이름}>
                <th>{r.이름}</th>
                {/* 주소와 이름은 글자 폭이 고른 벌로 적는다. 사람 말이
                    아니라 그대로 옮겨 쓰는 글이다. */}
                <td className={r.글꼴 ? "admin-mono" : undefined}>
                  {r.딱지 ? (
                    <span className="admin-tbl__pair">
                      <span>{r.값 || "-"}</span>
                      <span className="admin-tbl__chip admin-mono tint-보라">{r.딱지}</span>
                    </span>
                  ) : (
                    r.값 || "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
