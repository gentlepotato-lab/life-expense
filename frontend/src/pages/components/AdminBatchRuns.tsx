import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { formatDateLabel } from "../../utils/dateGroup";
import { 걸린빛 } from "../../utils/adminFmt";
import useAdminFold from "../../hooks/useAdminFold";
import useAdminPeriod, { type 기간짐 } from "../../hooks/useAdminPeriod";
import AdminPeriodBar from "./AdminPeriodBar";
import AdminPeriodFields from "./AdminPeriodFields";
import AdminMoreRow from "./AdminMoreRow";
import AdminFilterPopup from "./AdminFilterPopup";
import DateGroupHeader from "./DateGroupHeader";
import Collapse from "./Collapse";
import { CollapseAllButtons } from "./CollapseToggle";
import { EditField } from "./CardEditModal";
import { 먼저펼칠줄, 스르륵한도 } from "./adminLogBits";

/**
 * 배치 이력.
 *
 * 일이 실행된 기록을 한 줄씩 늘어놓는다. 배치 쪽 카드에는 마지막 한 줄만 서므로,
 * 며칠째 실패하는 중인지 요즘 느려지는 중인지는 거기서 알 수 없다. 카드의
 * [이력] 단추로 들어온다(AdminBatch.tsx).
 *
 * 짜임은 로그인 기록과 같다(AdminLoginLog.tsx). 날짜가 표 밖 단 머리말에
 * 서고, 그 머리말을 눌러 접고 편다. 날짜를 칸으로 두면 하루에 천 줄이 넘는
 * 일(정기 내역 보내기)에서 같은 날이 줄마다 되풀이된다.
 *
 * 열쇠를 들고 들어오면 그 일만 본다. 없으면 모두 섞어 보되 어느 일인지를
 * 칸으로 적는다.
 *
 * 맨 위에서 달을 넘기고 기간을 거른다(AdminPeriodBar). 기간은 들어올 때
 * 실려 오고, 되돌아가는 단추는 바로 앞 쪽으로 돌아간다.
 *
 * 하루에 쌓인 바퀴가 많아 먼저 몇 줄만 펼친다. 매분 도는 일은 하루에 천
 * 줄이 넘는다. 나머지는 표 아래 (...)를 눌러 편다(AdminMoreRow.tsx).
 */

type 줄 = {
  job_key: string;
  name: string;
  on_day: string;
  at_time: string;
  ok: boolean;
  note: string;
  /** 걸린 시간(밀리초). 재기 전에 돈 바퀴는 null 이다. */
  ms: number | null;
};

/** 잘됐나 아닌가. 글로 적는 대신 표로 적는다. */
const 결과표 = {
  됐다: (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d="M3.5 8.5l3 3 6-6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  탈났다: (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d="M4 4l8 8M12 4l-8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  ),
};

/** 걸린 시간 한 줄. 재지 않은 바퀴는 줄표로 둔다. */
const 걸린글 = (ms: number | null) =>
  ms === null ? "-" : `${ms.toLocaleString("ko-KR")}ms`;

export default function AdminBatchRuns() {
  const navigate = useNavigate();
  const location = useLocation();
  const [찾기] = useSearchParams();
  const 열쇠 = 찾기.get("key") || "";

  const 실린것 = (location.state as { 때?: 기간짐; back?: string } | null) ?? null;
  const 때 = useAdminPeriod(실린것?.때 ?? null);
  const 돌아갈곳 = 실린것?.back ?? "배치";

  const [초안, set초안] = useState({ frm: "", to: "" });
  const [필터열림, set필터열림] = useState(false);
  const [목록, set목록] = useState<줄[] | null>(null);
  const [탈, set탈] = useState(false);
  /* 접은 날과, 나머지까지 펼친 날. 기본은 모두 펼침이되 앞 몇 줄만이다. */
  const [접은날, set접은날] = useState<Set<string>>(new Set());
  /* 긴 날의 나머지를 펼치고 접는 자리. 한 번 펼친 날은 줄을 세운 채
     접었다 폈다 하므로 스르륵 닫힌다(hooks/useAdminFold.ts). */
  const 펼침 = useAdminFold();

  const 받기 = useCallback(() => {
    set탈(false);
    axios
      .get("/admin/batch/runs", {
        headers: 머리(),
        params: { frm: 때.기간.frm, to: 때.기간.to, ...(열쇠 ? { key: 열쇠 } : {}) },
      })
      .then((r) => set목록(r.data as 줄[]))
      .catch(() => {
        set목록([]);
        set탈(true);
      });
  }, [때.기간.frm, 때.기간.to, 열쇠]);

  useEffect(받기, [받기]);

  const 필터열기 = () => {
    set초안({ frm: 때.거른기간?.frm ?? "", to: 때.거른기간?.to ?? "" });
    set필터열림(true);
  };

  const 적용 = () => {
    if (!때.기간걸기(초안.frm, 초안.to)) return;
    set필터열림(false);
  };

  /* 날로 묶는다. 서버가 이미 새것부터 보내므로 나오는 차례를 그대로 쓴다. */
  const 날묶음 = (() => {
    const 묶음: { date: string; label: string; items: 줄[] }[] = [];
    for (const r of 목록 ?? []) {
      const 끝 = 묶음[묶음.length - 1];
      if (끝 && 끝.date === r.on_day) 끝.items.push(r);
      else 묶음.push({ date: r.on_day, label: formatDateLabel(r.on_day), items: [r] });
    }
    return 묶음;
  })();

  /* 열쇠를 들고 들어왔으면 어느 일인지 위에 적는다. 줄마다 적으면 같은
     이름이 되풀이된다. */
  const 일이름 = 열쇠 ? 목록?.[0]?.name || "" : "";

  return (
    <div className="admin-edit">
      <div className="cat-toolbar">
        <AdminPeriodBar
          때={때}
          on필터={필터열기}
          뒤로={{
            이름: 돌아갈곳,
            on누름: () =>
              실린것 ? navigate(-1) : navigate("/admin/batch", { replace: true }),
          }}
        >
          {날묶음.length > 0 && (
            <CollapseAllButtons
              onExpandAll={() => set접은날(new Set())}
              onCollapseAll={() => set접은날(new Set(날묶음.map((g) => g.date)))}
            />
          )}
        </AdminPeriodBar>
      </div>

      {/* 어느 일을 보고 있는지. 열쇠는 주소에만 실려 있다. */}
      {일이름 && (
        <div className="pm-toolbar-row admin-toolbar-row">
          <span className="admin-span__tag">{일이름}</span>
          <span className="admin-toolbar-row__gap" />
          {목록 && (
            <span className="admin-span__tag">
              {목록.length.toLocaleString("ko-KR")}회
            </span>
          )}
        </div>
      )}

      {목록 === null ? (
        <div className="card admin-soon">
          <p className="page-empty">불러오는 중입니다.</p>
        </div>
      ) : 탈 ? (
        <div className="card admin-soon">
          <p className="page-empty">기록을 불러오지 못했습니다.</p>
        </div>
      ) : 날묶음.length === 0 ? (
        <div className="card admin-soon">
          <p className="page-empty">아직 실행된 적이 없습니다.</p>
        </div>
      ) : (
        <div className="admin-days-list">
          {날묶음.map((묶음) => {
            const 폈나 = !접은날.has(묶음.date);
            const 다폈나 = 펼침.폈나(묶음.date);
            /* 나머지가 많으면 스르륵 없이 한 번에 펼치고 접는다. 줄마다
               키를 어르는 일이라 많으면 뚝뚝 끊긴다(adminLogBits.tsx). */
            const 스르륵 = 묶음.items.length - 먼저펼칠줄 <= 스르륵한도;
            const 세울것 = 스르륵 ? 펼침.담겼나(묶음.date) : 다폈나;
            const 보일것 = 세울것 ? 묶음.items : 묶음.items.slice(0, 먼저펼칠줄);
            return (
              <section key={묶음.date} className="date-group">
                {/* 날짜는 표 밖, 단 머리말이 말한다. 셀 돈이 없으므로
                    합계는 접는다(hideSum). */}
                <DateGroupHeader
                  label={묶음.label}
                  summary={{ count: 묶음.items.length, inSum: 0, outSum: 0, net: 0 }}
                  hideSum
                  open={폈나}
                  onToggle={() =>
                    set접은날((v) => {
                      const 다음 = new Set(v);
                      if (다음.has(묶음.date)) 다음.delete(묶음.date);
                      else 다음.add(묶음.date);
                      return 다음;
                    })
                  }
                />
                <Collapse open={폈나}>
                  <table className="admin-tbl">
                    <colgroup>
                      {/* 시각과 결과와 걸린 시간은 글이 정해져 있어 못 박고,
                          남는 폭은 한 줄이 쓴다. */}
                      <col style={{ width: "78px" }} />
                      <col style={{ width: "36px" }} />
                      <col style={{ width: "78px" }} />
                      <col />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>시각</th>
                        <th className="admin-tbl__mark" />
                        <th>걸린 시간</th>
                        <th>{열쇠 ? "결과" : "작업"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {보일것.map((r, i) => (
                        <tr
                          key={`${r.on_day}-${r.at_time}-${i}`}
                          className={`${r.ok ? "" : "is-off"}${
                            스르륵 && i >= 먼저펼칠줄
                              ? ` admin-tbl__extra${다폈나 ? "" : " is-folded"}`
                              : ""
                          }`.trim()}
                        >
                          <th className="admin-mono">{r.at_time}</th>
                          <td
                            className={`admin-tbl__mark admin-tbl__mark--${r.ok ? "open" : "bad"}`}
                          >
                            <span>{r.ok ? 결과표.됐다 : 결과표.탈났다}</span>
                          </td>
                          {/* 재어 적은 값이라 네모 딱지다. 1초를 넘기면
                              빛깔이 갈린다(utils/adminFmt.ts). */}
                          <td>
                            <span className={`admin-tbl__chip ${걸린빛(r.ms)}`}>
                              {걸린글(r.ms)}
                            </span>
                          </td>
                          {/* 열쇠를 들고 왔으면 남긴 글을, 아니면 어느
                              일이었는지를 적는다. */}
                          <td className="admin-tbl__wrap">{열쇠 ? r.note || "-" : r.name}</td>
                        </tr>
                      ))}
                      {묶음.items.length > 먼저펼칠줄 && (
                        <AdminMoreRow
                          칸수={4}
                          남은수={묶음.items.length - 먼저펼칠줄}
                          폈나={다폈나}
                          on바꾸기={() => 펼침.바꾸기(묶음.date)}
                        />
                      )}
                    </tbody>
                  </table>
                </Collapse>
              </section>
            );
          })}
        </div>
      )}

      {/* 어디까지 거슬러 볼 수 있는지 적는다. */}
      <p className="admin-hint">
        실행 기록은 90일까지 남고, 최근 200줄까지 보입니다.
      </p>

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
