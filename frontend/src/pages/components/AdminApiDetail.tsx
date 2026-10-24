import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { formatDateLabel } from "../../utils/dateGroup";
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
import { 값딱지, 먼저펼칠줄, 스르륵한도 } from "./adminLogBits";

/**
 * 호출 기록.
 *
 * API 하나를 부른 줄만 모아 본다. 외부 API 쪽에서 마지막 요청의 줄을 누르면
 * 그 API의 열쇠를 들고 들어온다(AdminApis.tsx).
 *
 * 기간과 거르기는 들어올 때 그대로 실려 오고, 여기서 다시 고칠 수도 있다.
 * 되돌아가는 단추는 바로 앞 쪽으로 돌아가므로, 거기서 보던 기간이 그대로
 * 남아 있다.
 *
 * 걸린 시간과 상태는 한 딱지에 담는다. 액션 기록의 값 칸과 같은 것을 쓴다
 * (adminLogBits.tsx의 값딱지). 두 쪽이 같은 값을 다른 꼴로 적으면 같은
 * 값으로 안 읽힌다.
 */

/** 서버가 내놓는 것. 줄과 함께 그 API의 이름이 온다. */
type 받은것 = { key: string; name: string; use: string; rows: 줄[] };

type 줄 = {
  log_id: number;
  on_day: string;
  at_time: string;
  /** 무엇을 하려고 불렀나. 브라우저가 적어 보낸 말이다. */
  path: string | null;
  /** 요청 방식. 2026-10-24 전에 쌓인 줄은 비어 있다. */
  method: string | null;
  /** 보낸 자리. 물음표 앞까지다 — 열쇠가 그 뒤에 붙는다. */
  url: string | null;
  ms: number | null;
  status: number | null;
};

/**
 * 요청 방식의 딱지 빛깔.
 *
 * 읽기만 하는 것과 고치는 것을 빛으로 가른다. GET은 하늘, 고치러 가는 쪽은
 * 살구다. 글자만 적으면 GET과 POST가 한 눈에 같아 보여, 어느 줄이 바깥을
 * 고치러 간 것인지 줄마다 읽어야 한다.
 */
/**
 * 주소를 읽을 수 있는 꼴로.
 *
 * 찾은 말은 주소에 퍼센트로 감겨 온다(`query=%EC%84%B1%EB%B6%81...`). 그대로
 * 띄우면 무엇을 찾았는지 읽을 수가 없어 풀어서 적는다. 쌓인 값은 보낸 그대로
 * 두고 띄울 때만 푼다 — 기록은 보낸 것과 같아야 한다.
 *
 * 못 푸는 글(퍼센트가 짝이 안 맞는 글)이면 온 대로 적는다.
 */
function 주소글(url: string): string {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
}

const 방식빛: Record<string, string> = {
  GET: "tint-하늘",
  POST: "tint-살구",
  PUT: "tint-살구",
  PATCH: "tint-살구",
  DELETE: "tint-분홍",
};

export default function AdminApiDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [찾기] = useSearchParams();
  const 열쇠 = 찾기.get("key") || "";

  const 실린것 = (location.state as { 때?: 기간짐; back?: string } | null) ?? null;
  const 때 = useAdminPeriod(실린것?.때 ?? null);
  const 돌아갈곳 = 실린것?.back ?? "외부 API";

  const [초안, set초안] = useState({ frm: "", to: "" });
  const [필터열림, set필터열림] = useState(false);
  const [받은것, set받은것] = useState<받은것 | null>(null);
  const [탈, set탈] = useState(false);
  const [접은날, set접은날] = useState<Set<string>>(new Set());
  /* 긴 날의 나머지를 펼치고 접는 자리. 한 번 펼친 날은 줄을 세운 채
     접었다 폈다 하므로 스르륵 닫힌다(hooks/useAdminFold.ts). */
  const 펼침 = useAdminFold();

  const 받기 = useCallback(() => {
    if (!열쇠) {
      set받은것({ key: "", name: "", use: "", rows: [] });
      return;
    }
    set탈(false);
    axios
      .get("/admin/apis/runs", {
        headers: 머리(),
        params: { key: 열쇠, frm: 때.기간.frm, to: 때.기간.to },
      })
      .then((r) => set받은것(r.data as 받은것))
      .catch(() => {
        set받은것({ key: 열쇠, name: "", use: "", rows: [] });
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

  const 날묶음 = (() => {
    const 묶음: { date: string; label: string; items: 줄[] }[] = [];
    for (const r of 받은것?.rows ?? []) {
      const 끝 = 묶음[묶음.length - 1];
      if (끝 && 끝.date === r.on_day) 끝.items.push(r);
      else 묶음.push({ date: r.on_day, label: formatDateLabel(r.on_day), items: [r] });
    }
    return 묶음;
  })();

  const 센것 = 받은것?.rows.length ?? 0;

  return (
    <div className="admin-edit">
      <div className="cat-toolbar">
        <AdminPeriodBar
          때={때}
          on필터={필터열기}
          뒤로={{ 이름: 돌아갈곳, on누름: () => navigate(-1) }}
        >
          {날묶음.length > 0 && (
            <CollapseAllButtons
              onExpandAll={() => set접은날(new Set())}
              onCollapseAll={() => set접은날(new Set(날묶음.map((g) => g.date)))}
            />
          )}
        </AdminPeriodBar>
      </div>

      {/* 어느 API를 보고 있는지. 이름과 열쇠를 한 알약에 나란히 담는다.

          열쇠만 적던 때는 외부 API 쪽 표가 「한국천문연구원 특일 정보」라
          부르는 것을 이 쪽은 「kasi」라 불러, 같은 API가 두 이름으로 섰다.
          이름만 적으면 주소에 실린 열쇠와 화면에 보이는 말이 달라 어느
          줄에서 들어왔는지 짚기 어렵다.

          빛깔은 청록이다. 관리자 사이트가 보라 한 결로 서므로 보라 알약을
          하나 더 두면 이 줄이 눈에 안 걸린다. 표 안에서 걸린 시간을 적는
          딱지가 쓰는 그 빛이다(utils/adminFmt.ts의 걸린빛). */}
      <div className="pm-toolbar-row admin-toolbar-row">
        <span className="admin-api-name tint-청록">
          <span className="admin-api-name__what">
            {받은것?.name || 열쇠 || "-"}
          </span>
          {받은것?.name && <span className="admin-api-name__key">{열쇠}</span>}
        </span>
        <span className="admin-toolbar-row__gap" />
        {받은것 && <span className="admin-span__tag">{센것.toLocaleString("ko-KR")}회</span>}
      </div>

      {받은것 === null ? (
        <div className="card admin-soon">
          <p className="page-empty">불러오는 중입니다.</p>
        </div>
      ) : 탈 ? (
        <div className="card admin-soon">
          <p className="page-empty">기록을 불러오지 못했습니다.</p>
        </div>
      ) : 날묶음.length === 0 ? (
        <div className="card admin-soon">
          <p className="page-empty">호출한 기록이 없습니다.</p>
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
                    {/* 시각과 방식과 값은 글이 정해져 있어 폭을 못 박고, 남는
                        폭은 요청이 쓴다. 주소는 그 칸 안에서 아랫줄에 깔린다 —
                        칸을 따로 두었더니 96px 안에서 주소가 일곱 줄로
                        흘러내렸다. */}
                    <colgroup>
                      <col style={{ width: "76px" }} />
                      <col style={{ width: "56px" }} />
                      <col />
                      <col style={{ width: "70px" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>시각</th>
                        <th>방식</th>
                        <th className="admin-tbl__wrap">요청</th>
                        <th>값</th>
                      </tr>
                    </thead>
                    <tbody>
                      {보일것.map((r, i) => (
                        <tr
                          key={r.log_id}
                          className={
                            스르륵 && i >= 먼저펼칠줄
                              ? `admin-tbl__extra${다폈나 ? "" : " is-folded"}`
                              : undefined
                          }
                        >
                          <th className="admin-mono">{r.at_time}</th>
                          {/* 방식은 딱지로, 주소는 고른 폭 글꼴로 적는다.
                              주소는 옮겨 적는 글이라 글자 수를 세며 읽는다.
                              2026-10-24 전에 쌓인 줄에는 둘 다 없어 줄표가
                              선다(sql/2026-10-24_api_request.sql). */}
                          <td>
                            {r.method ? (
                              <span
                                className={`admin-tbl__tag ${방식빛[r.method] ?? "tint-잿빛"}`}
                              >
                                {r.method}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="admin-tbl__wrap admin-tbl__left">
                            <span className="admin-api-row__what">{r.path || "-"}</span>
                            {r.url && (
                              <span className="admin-api-row__url admin-mono">
                                {주소글(r.url)}
                              </span>
                            )}
                          </td>
                          <td>
                            {값딱지({
                              kind: "api",
                              elapsed_ms: r.ms,
                              status: r.status,
                            })}
                          </td>
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

      {필터열림 && (
        <AdminFilterPopup
          on초기화={() => set초안({ frm: "", to: "" })}
          on적용={적용}
          onClose={() => set필터열림(false)}
        >
          <AdminPeriodFields frm={초안.frm} to={초안.to} on바뀜={set초안} />

          <EditField label="" span={12}>
            <p className="admin-hint">
              날짜를 둘 다 비우면 달 단위로 돌아갑니다. 새것부터 200줄까지
              보여 줍니다.
            </p>
          </EditField>
        </AdminFilterPopup>
      )}
    </div>
  );
}
