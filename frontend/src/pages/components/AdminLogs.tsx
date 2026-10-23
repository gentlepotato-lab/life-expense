import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { PAGE_TITLE } from "../../utils/pageTitles";
import { 관리자쪽이름 } from "../../utils/adminTabs";
import { formatDateLabel } from "../../utils/dateGroup";
import useAdminFold from "../../hooks/useAdminFold";
import useAdminPeriod from "../../hooks/useAdminPeriod";
import AdminPeriodBar from "./AdminPeriodBar";
import AdminPeriodFields from "./AdminPeriodFields";
import AdminMoreRow from "./AdminMoreRow";
import AdminGoRow from "./AdminGoRow";
import AdminFilterPopup from "./AdminFilterPopup";
import DateGroupHeader from "./DateGroupHeader";
import Collapse from "./Collapse";
import { CollapseAllButtons } from "./CollapseToggle";
import SingleSelect from "./SingleSelect";
import { EditField, EditDivider } from "./CardEditModal";
import { 구분이름, 구분빛, 값딱지, 먼저펼칠줄, 스르륵한도 } from "./adminLogBits";

/**
 * 조회 기록.
 *
 * 대시보드는 묶어서만 보여 준다. 그래서 "그 요청이 언제 몇 ms였는지"를 볼
 * 자리가 없었다. 여기가 그 자리다.
 *
 * 맨 위에서 달을 넘기고 기간을 거른다(AdminPeriodBar). 아래는 날짜로 묶은
 * 표이고, 단 머리말을 눌러 접고 편다. 사용자 사이트의 내역 화면과 같은
 * 결이다.
 *
 * 하루에 쌓인 줄이 많아 먼저 몇 줄만 펼친다. 나머지는 표 아래 (...)를 눌러
 * 편다(AdminMoreRow).
 *
 * 줄을 꾹 누르면 그 이름의 기록만 모아 보는 쪽으로 간다. 톡 눌러 열게 두면
 * 표를 훑다가 화면이 바뀐다. 기간과 거르기는 그대로 실려 가고, 되돌아오면
 * 그대로 되돌아온다(AdminLogDetail.tsx).
 *
 * 묵은 기록은 달마다 지워진다(app/scheduler/cleanup_job.py). 아무리 거슬러
 * 올라가도 90일 치뿐이다.
 */

type 기록 = {
  log_id: number;
  kind: string;
  name: string;
  path: string | null;
  elapsed_ms: number | null;
  status: number | null;
  on_day: string;
  at_time: string;
};

/**
 * 한 줄의 이름.
 *
 * 조회는 길이 곧 이름이라, 그 길이 가리키는 화면 이름으로 바꿔 적는다.
 * 기능과 외부는 적힌 이름이 곧 이름이다. 요청은 어느 길을 부른 것인지가
 * 알맹이라 길을 그대로 쓴다.
 */
function 줄이름(r: 기록): string {
  if (r.kind !== "view") return r.name;
  return 관리자쪽이름(r.name) ?? PAGE_TITLE[r.name] ?? r.name;
}

export default function AdminLogs() {
  const navigate = useNavigate();
  const 때 = useAdminPeriod();
  const [구분, set구분] = useState("");
  /* 팝업 안에서 고치는 중인 조건. [적용]을 누르지 않고 닫으면 버린다.
     사용자 화면의 거르기와 같다(pages/Entries.tsx). */
  const [초안, set초안] = useState({ 구분: "", frm: "", to: "" });
  const [필터열림, set필터열림] = useState(false);
  const [목록, set목록] = useState<기록[] | null>(null);
  const [탈, set탈] = useState(false);
  /* 접은 날과, 나머지까지 펼친 날. 기본은 모두 펼침이되 앞 몇 줄만이다. */
  const [접은날, set접은날] = useState<Set<string>>(new Set());
  /* 긴 날의 나머지를 펼치고 접는 자리. 한 번 펼친 날은 줄을 세운 채
     접었다 폈다 하므로 스르륵 닫힌다(hooks/useAdminFold.ts). */
  const 펼침 = useAdminFold();

  /* 거르기는 서버가 한다. 90일 치가 수천 줄이라 받고 골라내면 손전화가
     한 번에 그 전부를 쥐게 된다. */
  const 받기 = useCallback(() => {
    set탈(false);
    axios
      .get("/admin/logs", {
        headers: 머리(),
        params: {
          frm: 때.기간.frm,
          to: 때.기간.to,
          ...(구분 ? { kind: 구분 } : {}),
        },
      })
      .then((r) => set목록(r.data as 기록[]))
      .catch(() => {
        set목록([]);
        set탈(true);
      });
  }, [때.기간.frm, 때.기간.to, 구분]);

  useEffect(받기, [받기]);

  const 필터열기 = () => {
    set초안({ 구분, frm: 때.거른기간?.frm ?? "", to: 때.거른기간?.to ?? "" });
    set필터열림(true);
  };

  const 적용 = () => {
    if (!때.기간걸기(초안.frm, 초안.to)) return;
    set구분(초안.구분);
    set필터열림(false);
  };

  /* 날로 묶는다. 서버가 이미 새것부터 보내므로 나오는 차례를 그대로 쓴다. */
  const 날묶음 = (() => {
    const 묶음: { date: string; label: string; items: 기록[] }[] = [];
    for (const r of 목록 ?? []) {
      const 끝 = 묶음[묶음.length - 1];
      if (끝 && 끝.date === r.on_day) 끝.items.push(r);
      else 묶음.push({ date: r.on_day, label: formatDateLabel(r.on_day), items: [r] });
    }
    return 묶음;
  })();

  const 상세로 = (r: 기록) => {
    navigate(`/admin/log-detail?name=${encodeURIComponent(r.name)}`, {
      state: { 때: 때.담기(), 구분, back: "조회 기록" },
    });
  };

  return (
    <div className="admin-edit">
      <div className="cat-toolbar">
        <AdminPeriodBar 때={때} on필터={필터열기}>
          {날묶음.length > 0 && (
            <CollapseAllButtons
              onExpandAll={() => set접은날(new Set())}
              onCollapseAll={() => set접은날(new Set(날묶음.map((g) => g.date)))}
            />
          )}
        </AdminPeriodBar>
      </div>

      {목록 === null ? (
        <div className="card admin-soon">
          <p className="page-empty">불러오는 중입니다.</p>
        </div>
      ) : 탈 ? (
        <div className="card admin-soon">
          <p className="page-empty">기록을 불러오지 못했습니다.</p>
        </div>
      ) : 목록.length === 0 ? (
        <div className="card admin-soon">
          <p className="page-empty">조회된 기록이 없습니다.</p>
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
                      {/* 시각과 구분과 값은 글이 정해져 있어 폭을 못 박고,
                          남는 폭은 이름이 쓴다. */}
                      <col style={{ width: "78px" }} />
                      <col style={{ width: "54px" }} />
                      <col />
                      <col style={{ width: "72px" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>시각</th>
                        <th>구분</th>
                        <th className="admin-tbl__wrap">이름</th>
                        <th>값</th>
                      </tr>
                    </thead>
                    <tbody>
                      {보일것.map((r, i) => (
                        <AdminGoRow
                          key={r.log_id}
                          on상세={() => 상세로(r)}
                          /* 먼저 펼친 줄 뒤에 오는 것들. 접힐 때 스르륵
                             닫히도록 이름을 단다. */
                          className={
                            스르륵 && i >= 먼저펼칠줄
                              ? `admin-tbl__extra${다폈나 ? "" : " is-folded"}`
                              : ""
                          }
                        >
                          <th className="admin-mono">{r.at_time}</th>
                          <td>
                            <span className={`admin-tbl__tag ${구분빛[r.kind] ?? "tint-잿빛"}`}>
                              {구분이름[r.kind] ?? r.kind}
                            </span>
                          </td>
                          {/* 길은 고른 폭 글꼴로, 화면 이름은 본문 글꼴로 적는다.
                              길은 글자 수를 세며 읽는 글이다.

                              쏠림은 둘 다 왼쪽이다. 고른 폭 글꼴은 표에서
                              가운데로 모으는 것이 기본인데(index.css의
                              .admin-tbl td.admin-mono), 이 칸은 한 칸에 두
                              가지가 섞여 들어 그대로 두면 줄마다 쏠림이
                              달라진다. */}
                          <td
                            className={`admin-tbl__wrap admin-tbl__left${
                              줄이름(r).startsWith("/") ? " admin-mono" : ""
                            }`}
                          >
                            {줄이름(r)}
                          </td>
                          {/* 값은 요청과 외부에만 붙는다. 실패한 줄은 상태가,
                              멀쩡히 끝난 줄은 걸린 시간이 알맹이다. */}
                          <td>{값딱지(r)}</td>
                        </AdminGoRow>
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

      {목록 && 목록.length > 0 && (
        <p className="admin-tbl-hint">줄을 꾹 누르면 그 이름의 기록만 모아 봅니다.</p>
      )}

      {필터열림 && (
        <AdminFilterPopup
          on초기화={() => set초안({ 구분: "", frm: "", to: "" })}
          on적용={적용}
          onClose={() => set필터열림(false)}
        >
          <EditField label="구분" span={12}>
            <SingleSelect
              noun="구분"
              options={[
                { value: "", label: "(전체)" },
                { value: "view", label: "조회" },
                { value: "feature", label: "기능" },
                { value: "error", label: "요청" },
                { value: "api", label: "외부" },
              ]}
              selected={초안.구분}
              onChange={(v) => set초안({ ...초안, 구분: v })}
              placeholder="(전체)"
            />
          </EditField>

          <EditDivider />

          <AdminPeriodFields
            frm={초안.frm}
            to={초안.to}
            on바뀜={(값) => set초안({ ...초안, ...값 })}
          />

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
