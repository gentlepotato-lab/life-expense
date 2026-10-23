import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import useAdminPeriod from "../../hooks/useAdminPeriod";
import AdminPeriodBar from "./AdminPeriodBar";
import AdminPeriodFields from "./AdminPeriodFields";
import AdminFilterPopup from "./AdminFilterPopup";
import AdminGoRow from "./AdminGoRow";
import { EditField } from "./CardEditModal";

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
 * 맨 위에서 달을 넘기고 기간을 거른다(AdminPeriodBar). CNT는 지금 쌓인
 * 줄이고, 그 옆 칸은 고른 기간에 더해진 줄이다. 날짜 칸이 없는 표는 그
 * 자리를 비운다.
 *
 * 줄을 꾹 누르면 그 화면이 쓰는 표를 따로 보는 쪽으로 간다
 * (AdminDbDetail.tsx). 톡 눌러 열게 두면 표를 훑다가 화면이 바뀐다.
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
  tables: {
    table: string;
    name: string;
    site: string;
    n: number;
    /** 고른 기간에 더해진 줄. 날짜 칸이 없는 표는 null 이다. */
    added: number | null;
  }[];
};

/** 어느 사이트의 자료인가. 묶음 머리말에 그대로 적는다. */
const 사이트이름: { key: string; name: string }[] = [
  { key: "user", name: "사용자 사이트" },
  { key: "admin", name: "관리자 사이트" },
];

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
  const navigate = useNavigate();
  const 때 = useAdminPeriod();
  const [초안, set초안] = useState({ frm: "", to: "" });
  const [필터열림, set필터열림] = useState(false);
  const [집계, set집계] = useState<집계 | null>(null);
  /* 차지한 자리는 따로 묻는다. 그 한 질의가 400ms를 먹어, 함께 물으면 쪽
     전체가 그만큼 늦게 떴다(app/routers/admin.py의 /admin/db-size). */
  const [크기, set크기] = useState<string | null>(null);
  const [탈, set탈] = useState(false);

  const 받기 = useCallback(() => {
    let 살아있나 = true;
    axios
      .get("/admin/db", {
        headers: 머리(),
        params: { frm: 때.기간.frm, to: 때.기간.to },
      })
      .then((r) => {
        if (살아있나) set집계(r.data as 집계);
      })
      .catch(() => {
        if (살아있나) set탈(true);
      });
    return () => {
      살아있나 = false;
    };
  }, [때.기간.frm, 때.기간.to]);

  useEffect(받기, [받기]);

  /* 차지한 자리는 기간과 상관없는 값이라 한 번만 묻는다. */
  useEffect(() => {
    let 살아있나 = true;
    axios
      .get("/admin/db-size", { headers: 머리() })
      .then((r) => {
        if (살아있나) set크기((r.data as { size: string }).size);
      })
      .catch(() => {
        /* 못 재도 나머지는 보인다. 그 줄만 비운다. */
      });
    return () => {
      살아있나 = false;
    };
  }, []);

  const 필터열기 = () => {
    set초안({ frm: 때.거른기간?.frm ?? "", to: 때.거른기간?.to ?? "" });
    set필터열림(true);
  };

  const 적용 = () => {
    if (!때.기간걸기(초안.frm, 초안.to)) return;
    set필터열림(false);
  };

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

  const 합계 = 집계.tables.reduce((s, t) => s + t.n, 0);

  /* 많은 것부터 세우고, 최소몫에 못 미치는 것은 「그 밖」 한 칸으로 모은다.
     원래 차례는 아래 표가 지킨다 — 거기는 무엇이 있는지를 보는 자리다. */
  const 큰것 = 집계.tables
    .filter((t) => 합계 > 0 && t.n / 합계 >= 최소몫)
    .sort((a, b) => b.n - a.n)
    .slice(0, 몫빛.length);
  const 큰것합 = 큰것.reduce((s, t) => s + t.n, 0);
  const 그밖 = 합계 - 큰것합;

  /** 몫을 백분으로. 한 자리까지만 적는다. */
  const 몫글 = (n: number) => (합계 > 0 ? `${Math.round((n / 합계) * 100)}%` : "0%");

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

  const 상세로 = (표: string) => {
    navigate(`/admin/db-detail?table=${encodeURIComponent(표)}`, {
      state: { 때: 때.담기(), back: "DB" },
    });
  };

  return (
    <div className="admin-edit">
      <div className="cat-toolbar">
        <AdminPeriodBar 때={때} on필터={필터열기} />
      </div>

      <section className="admin-sec">
        <h3 className="admin-sec__head">쌓인 데이터</h3>

        {/* 몫 띠. 칸마다 제 몫만큼 넓이를 가진다. 칸 사이에 바탕빛 금을
            그어 두 칸이 한 덩어리로 붙어 보이지 않게 한다. */}
        {합계 > 0 && (
          <>
            <div className="admin-share" role="img" aria-label={`쌓인 줄 ${합계.toLocaleString("ko-KR")}건의 화면별 몫`}>
              {칸들.map((c) => (
                <span
                  key={c.key}
                  className="admin-share__part"
                  style={{ width: `${(c.n / 합계) * 100}%`, background: c.color }}
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

        {/* 사이트마다 표 하나. 한 목록에 섞으면 어느 쪽에 얼마나 쌓였는지
            눈에 잡히지 않는다. 띠는 두 사이트를 통틀어 나눈 몫이다. */}
        {사이트이름.map((터) => {
          const 줄들 = 집계.tables.filter((t) => t.site === 터.key);
          if (줄들.length === 0) return null;
          const 터합계 = 줄들.reduce((a, t) => a + t.n, 0);
          const 터더함 = 줄들.reduce((a, t) => a + (t.added ?? 0), 0);
          return (
            <div key={터.key} className="admin-sec__part">
              <h4 className="admin-sec__sub">{터.name}</h4>
              <table className="admin-tbl">
                <colgroup>
                  <col />
                  <col style={{ width: "86px" }} />
                  <col style={{ width: "72px" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>화면</th>
                    <th>CNT</th>
                    {/* 고른 기간에 더해진 줄. 머리말에 기간을 적지 않는 까닭은
                        위 딱지가 이미 어느 기간인지 말하고 있어서다. */}
                    <th>기간</th>
                  </tr>
                </thead>
                <tbody>
                  {줄들.map((t) => (
                    <AdminGoRow key={t.table} on상세={() => 상세로(t.table)}>
                      <th>{t.name}</th>
                      <td className="admin-tbl__right">{t.n.toLocaleString("ko-KR")}</td>
                      <td>
                        {t.added === null ? (
                          "-"
                        ) : (
                          <span
                            className={`admin-tbl__chip ${
                              t.added > 0 ? "tint-하늘" : "tint-잿빛"
                            }`}
                          >
                            {t.added.toLocaleString("ko-KR")}
                          </span>
                        )}
                      </td>
                    </AdminGoRow>
                  ))}
                  {/* 그 사이트의 줄을 더한 줄. 줄무늬보다 한 단 짙게 깔아
                      더한 줄이라는 것이 한눈에 보인다. */}
                  <tr className="admin-tbl__sum">
                    <th>합계</th>
                    <td className="admin-tbl__right">{터합계.toLocaleString("ko-KR")}</td>
                    <td className="admin-tbl__right">{터더함.toLocaleString("ko-KR")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
      </section>

      <section className="admin-sec">
        <h3 className="admin-sec__head">서버 정보</h3>
        <table className="admin-tbl admin-tbl--kv">
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

      <p className="admin-tbl-hint">줄을 꾹 누르면 그 표를 따로 봅니다.</p>

      {필터열림 && (
        <AdminFilterPopup
          on초기화={() => set초안({ frm: "", to: "" })}
          on적용={적용}
          onClose={() => set필터열림(false)}
        >
          <AdminPeriodFields frm={초안.frm} to={초안.to} on바뀜={set초안} />

          <EditField label="" span={12}>
            <p className="admin-hint">날짜를 둘 다 비우면 달 단위로 돌아갑니다.</p>
          </EditField>
        </AdminFilterPopup>
      )}
    </div>
  );
}
