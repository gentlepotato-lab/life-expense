import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { formatDateLabel } from "../../utils/dateGroup";
import { 걸린빛 } from "../../utils/adminFmt";
import DateGroupHeader from "./DateGroupHeader";
import Collapse from "./Collapse";
import { CollapseAllButtons } from "./CollapseToggle";

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
  const [찾기] = useSearchParams();
  const 열쇠 = 찾기.get("key") || "";
  const [목록, set목록] = useState<줄[] | null>(null);
  const [탈, set탈] = useState(false);
  /* 접은 날. 기본은 모두 펼침이다. */
  const [접은날, set접은날] = useState<Set<string>>(new Set());

  const 받기 = useCallback(() => {
    set탈(false);
    axios
      .get("/admin/batch/runs", { headers: 머리(), params: 열쇠 ? { key: 열쇠 } : {} })
      .then((r) => set목록(r.data as 줄[]))
      .catch(() => {
        set목록([]);
        set탈(true);
      });
  }, [열쇠]);

  useEffect(받기, [받기]);

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
        <div className="pm-toolbar-row admin-toolbar-row">
          {일이름 && <span className="admin-span__tag">{일이름}</span>}
          <span className="admin-toolbar-row__gap" />
          {날묶음.length > 0 && (
            <CollapseAllButtons
              onExpandAll={() => set접은날(new Set())}
              onCollapseAll={() => set접은날(new Set(날묶음.map((g) => g.date)))}
            />
          )}
        </div>
      </div>

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
                      {묶음.items.map((r, i) => (
                        <tr key={`${r.on_day}-${r.at_time}-${i}`} className={r.ok ? "" : "is-off"}>
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
    </div>
  );
}
