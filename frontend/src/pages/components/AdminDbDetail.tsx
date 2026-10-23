import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { formatDateLabel } from "../../utils/dateGroup";
import useAdminPeriod, { type 기간짐 } from "../../hooks/useAdminPeriod";
import AdminPeriodBar from "./AdminPeriodBar";
import AdminPeriodFields from "./AdminPeriodFields";
import AdminMoreRow from "./AdminMoreRow";
import AdminFilterPopup from "./AdminFilterPopup";
import { EditField } from "./CardEditModal";
import { 먼저펼칠줄, 스르륵한도 } from "./adminLogBits";

/**
 * 표 상세.
 *
 * 화면 하나가 쓰는 표를 따로 본다. DB 쪽에서 줄을 누르면 그 표 이름을 들고
 * 들어온다(AdminDb.tsx).
 *
 * 두 가지를 적는다. 표가 무엇인지와, 선택한 기간에 날마다 몇 줄이 더해졌는지다.
 * 날짜 칸이 없는 표는 뒤엣것을 셀 수 없어 그 자리를 비운다
 * (app/routers/admin.py의 표들).
 */

type 날줄 = { on_day: string; n: number };

type 집계 = {
  tables: {
    table: string;
    name: string;
    site: string;
    n: number;
    added: number | null;
  }[];
};

/** 사이트 이름. DB 쪽 묶음 머리말과 같은 말을 쓴다. */
const 사이트이름: Record<string, string> = {
  user: "사용자 사이트",
  admin: "관리자 사이트",
};

export default function AdminDbDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [찾기] = useSearchParams();
  const 표이름 = 찾기.get("table") || "";

  const 실린것 = (location.state as { 때?: 기간짐; back?: string } | null) ?? null;
  const 때 = useAdminPeriod(실린것?.때 ?? null);
  const 돌아갈곳 = 실린것?.back ?? "DB";

  const [초안, set초안] = useState({ frm: "", to: "" });
  const [필터열림, set필터열림] = useState(false);
  const [집계, set집계] = useState<집계 | null>(null);
  const [날들, set날들] = useState<날줄[] | null>(null);
  const [다폈나, set다폈나] = useState(false);
  /* 한 번이라도 펼친 적이 있나. 접힐 때 스르륵 닫히려면 줄이 화면에 남아
     있어야 한다(hooks/useAdminFold.ts와 같은 잣대다). */
  const [담겼나, set담겼나] = useState(false);
  const [탈, set탈] = useState(false);

  const 받기 = useCallback(() => {
    set탈(false);
    axios
      .get("/admin/db", {
        headers: 머리(),
        params: { frm: 때.기간.frm, to: 때.기간.to },
      })
      .then((r) => set집계(r.data as 집계))
      .catch(() => set탈(true));
    axios
      .get("/admin/db/days", {
        headers: 머리(),
        params: { table: 표이름, frm: 때.기간.frm, to: 때.기간.to },
      })
      .then((r) => set날들(r.data as 날줄[]))
      .catch(() => set날들([]));
  }, [때.기간.frm, 때.기간.to, 표이름]);

  useEffect(받기, [받기]);

  const 필터열기 = () => {
    set초안({ frm: 때.거른기간?.frm ?? "", to: 때.거른기간?.to ?? "" });
    set필터열림(true);
  };

  const 적용 = () => {
    if (!때.기간걸기(초안.frm, 초안.to)) return;
    set필터열림(false);
  };

  const 줄 = 집계?.tables.find((t) => t.table === 표이름) ?? null;
  /* 나머지가 많으면 스르륵 없이 한 번에 펼치고 접는다(adminLogBits.tsx). */
  const 스르륵 = (날들?.length ?? 0) - 먼저펼칠줄 <= 스르륵한도;
  const 세울것 = 스르륵 ? 담겼나 : 다폈나;
  const 보일것 = 세울것 ? 날들 ?? [] : (날들 ?? []).slice(0, 먼저펼칠줄);
  const 더해진것 = (날들 ?? []).reduce((a, d) => a + d.n, 0);

  return (
    <div className="admin-edit">
      <div className="cat-toolbar">
        <AdminPeriodBar
          때={때}
          on필터={필터열기}
          뒤로={{
            이름: 돌아갈곳,
            on누름: () =>
              실린것 ? navigate(-1) : navigate("/admin/db", { replace: true }),
          }}
        />
      </div>

      {탈 ? (
        <div className="card admin-soon">
          <p className="page-empty">불러오지 못했습니다.</p>
        </div>
      ) : !집계 ? (
        <div className="card admin-soon">
          <p className="page-empty">불러오는 중입니다.</p>
        </div>
      ) : !줄 ? (
        <div className="card admin-soon">
          <p className="page-empty">그런 표가 없습니다.</p>
        </div>
      ) : (
        <>
          <section className="admin-sec">
            <h3 className="admin-sec__head">표 정보</h3>
            <table className="admin-tbl admin-tbl--kv">
              <colgroup>
                <col style={{ width: "92px" }} />
                <col />
              </colgroup>
              <tbody>
                <tr>
                  <th>화면</th>
                  <td>{줄.name}</td>
                </tr>
                <tr>
                  <th>사이트</th>
                  <td>{사이트이름[줄.site] ?? 줄.site}</td>
                </tr>
                {/* 표 이름은 그대로 옮겨 쓰는 글이라 고른 폭 글꼴로 적는다.
                    오른쪽에 맞추는 것은 그 밑에 수가 오른쪽에 서기 때문이다.
                    이 칸만 왼쪽에 두면 값의 끝이 어긋난다. */}
                <tr>
                  <th>표</th>
                  <td className="admin-mono admin-tbl__wrap admin-tbl__right">
                    {줄.table}
                  </td>
                </tr>
                <tr>
                  <th>CNT</th>
                  <td className="admin-tbl__right">{줄.n.toLocaleString("ko-KR")}</td>
                </tr>
                <tr>
                  <th>기간</th>
                  <td className="admin-tbl__right">
                    {줄.added === null ? "-" : 줄.added.toLocaleString("ko-KR")}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="admin-sec">
            <h3 className="admin-sec__head">날마다 쌓인 줄</h3>
            {줄.added === null ? (
              <p className="page-empty">언제 쌓였는지 적는 칸이 없는 표입니다.</p>
            ) : 날들 === null ? (
              <p className="page-empty">불러오는 중입니다.</p>
            ) : 날들.length === 0 ? (
              <p className="page-empty">그 기간에 쌓인 줄이 없습니다.</p>
            ) : (
              <table className="admin-tbl">
                <colgroup>
                  <col />
                  <col style={{ width: "86px" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>CNT</th>
                  </tr>
                </thead>
                <tbody>
                  {보일것.map((d, i) => (
                    <tr
                      key={d.on_day}
                      className={
                        스르륵 && i >= 먼저펼칠줄
                          ? `admin-tbl__extra${다폈나 ? "" : " is-folded"}`
                          : undefined
                      }
                    >
                      <th>{formatDateLabel(d.on_day)}</th>
                      <td className="admin-tbl__right">{d.n.toLocaleString("ko-KR")}</td>
                    </tr>
                  ))}
                  {날들.length > 먼저펼칠줄 && (
                    <AdminMoreRow
                      칸수={2}
                      남은수={날들.length - 먼저펼칠줄}
                      폈나={다폈나}
                      on바꾸기={() => {
                        /* 처음 펼칠 때는 접힌 채로 한 번 그린 뒤에 편다.
                           세우자마자 펴면 열 때만 스르륵이 빠진다
                           (hooks/useAdminFold.ts와 같은 잣대다). */
                        if (스르륵 && !담겼나) {
                          set담겼나(true);
                          requestAnimationFrame(() => {
                            requestAnimationFrame(() => set다폈나(true));
                          });
                          return;
                        }
                        set다폈나((v) => !v);
                      }}
                    />
                  )}
                  <tr className="admin-tbl__sum">
                    <th>합계</th>
                    <td className="admin-tbl__right">
                      {더해진것.toLocaleString("ko-KR")}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

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
