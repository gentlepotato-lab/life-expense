import { useCallback, useEffect, useState } from "react";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { say } from "../../utils/notify";
import { PAGE_TITLE } from "../../utils/pageTitles";
import { 관리자쪽이름 } from "../../utils/adminTabs";
import { formatDateLabel } from "../../utils/dateGroup";
import AdminFilterPopup from "./AdminFilterPopup";
import DateGroupHeader from "./DateGroupHeader";
import DayPicker from "./DayPicker";
import SingleSelect from "./SingleSelect";
import { EditField, EditDivider } from "./CardEditModal";

/**
 * 조회 기록.
 *
 * 대시보드는 묶어서만 보여 준다. 그래서 "그 요청이 언제 몇 ms였는지"를 볼
 * 자리가 없었다. 여기가 그 자리다.
 *
 * 짜임은 공지와 같다(AdminNotices.tsx). 위에 거르기 한 줄, 아래에 날짜로
 * 묶은 목록이다. 날짜는 카드 밖 단 머리말이 말하고, 줄에는 이름과 딱지만
 * 선다. 사용자 사이트의 내역 화면과 같은 결이다.
 *
 * 구분은 넷이다. 조회와 기능과 요청은 앱이 저절로 적고, 외부는 브라우저가
 * 바깥에 바로 물어본 자국이다(utils/track.ts의 바깥적기).
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

/** 거르는 조건. 빈 글이면 안 거른다. */
type 거름 = { 구분: string; frm: string; to: string };
const 안거름: 거름 = { 구분: "", frm: "", to: "" };
const 걸렸나 = (f: 거름) => !!(f.구분 || f.frm || f.to);

/** 구분마다의 이름. 서버가 쥔 값은 영문 한 낱말이다. */
const 구분이름: Record<string, string> = {
  view: "조회",
  feature: "기능",
  error: "요청",
  api: "외부",
};

/**
 * 구분마다의 딱지 빛깔.
 *
 * 값이 다르면 음영도 달라야 한 눈에 갈린다. 넷을 모두 보라로 두었더니
 * 「조회」와 「요청」이 같은 것처럼 읽혔다.
 */
const 구분빛: Record<string, string> = {
  view: "tint-하늘",
  feature: "tint-풀빛",
  error: "tint-살구",
  api: "tint-보라",
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

/**
 * 줄 끝에 붙는 값.
 *
 * 실패한 줄은 상태가, 1초를 넘긴 줄은 걸린 시간이 알맹이다. 멀쩡히 끝난
 * 줄에는 걸린 시간만 옅게 적고, 조회와 기능에는 적을 것이 없다.
 */
function 값딱지(r: 기록) {
  if (r.kind !== "error" && r.kind !== "api") return "-";
  if (r.status !== null && r.status >= 400) {
    return <span className="admin-tbl__chip tint-분홍">{r.status}</span>;
  }
  if (r.elapsed_ms === null) return "-";
  const 느리나 = r.elapsed_ms >= 1000;
  return (
    <span className={`admin-tbl__chip admin-mono ${느리나 ? "tint-살구" : "tint-잿빛"}`}>
      {r.elapsed_ms.toLocaleString("ko-KR")}ms
    </span>
  );
}

export default function AdminLogs() {
  const [목록, set목록] = useState<기록[] | null>(null);
  const [걸림, set걸림] = useState<거름>(안거름);
  /* 팝업 안에서 고치는 중인 조건. [적용]을 누르지 않고 닫으면 버린다.
     사용자 화면의 거르기와 같다(pages/Entries.tsx). */
  const [초안, set초안] = useState<거름>(안거름);
  const [필터열림, set필터열림] = useState(false);
  const [탈, set탈] = useState(false);

  /* 거르기는 서버가 한다. 90일 치가 수천 줄이라 받고 골라내면 손전화가
     한 번에 그 전부를 쥐게 된다. */
  const 받기 = useCallback((f: 거름) => {
    set탈(false);
    axios
      .get("/admin/logs", {
        headers: 머리(),
        params: {
          ...(f.구분 ? { kind: f.구분 } : {}),
          ...(f.frm ? { frm: f.frm } : {}),
          ...(f.to ? { to: f.to } : {}),
        },
      })
      .then((r) => set목록(r.data as 기록[]))
      .catch(() => {
        set목록([]);
        set탈(true);
      });
  }, []);

  useEffect(() => 받기(걸림), [받기, 걸림]);

  /* 날로 묶는다. 서버가 이미 새것부터 보내므로 나오는 차례를 그대로 쓴다
     (AdminNotices.tsx와 같은 꼴). */
  const 날묶음 = (() => {
    const 묶음: { date: string; label: string; items: 기록[] }[] = [];
    for (const r of 목록 ?? []) {
      const 끝 = 묶음[묶음.length - 1];
      if (끝 && 끝.date === r.on_day) 끝.items.push(r);
      else 묶음.push({ date: r.on_day, label: formatDateLabel(r.on_day), items: [r] });
    }
    return 묶음;
  })();

  return (
    <div className="admin-edit">
      <div className="cat-toolbar">
        <div className="pm-toolbar-row admin-toolbar-row">
          {/* 거른 집계는 왼쪽 끝에 딱지로. 공지와 같은 자리, 같은 꼴이다. */}
          {목록 && 걸렸나(걸림) && (
            <span className="admin-span__tag">{목록.length}건</span>
          )}
          <span className="admin-toolbar-row__gap" />
          <button
            type="button"
            className={`filter-pill${걸렸나(걸림) ? " on" : ""}`}
            aria-pressed={걸렸나(걸림)}
            title={걸렸나(걸림) ? "필터가 걸려 있다. 눌러서 고친다." : "필터"}
            onClick={() => {
              set초안(걸림);
              set필터열림(true);
            }}
          >
            필터
          </button>
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
      ) : 목록.length === 0 ? (
        <div className="card admin-soon">
          <p className="page-empty">조회된 기록이 없습니다.</p>
        </div>
      ) : (
        <div className="admin-days-list">
          {날묶음.map((묶음) => (
            <section key={묶음.date} className="date-group">
              {/* 날짜는 카드 밖, 단 머리말이 말한다. 셀 돈이 없으므로
                  합계는 접는다(hideSum). */}
              <DateGroupHeader
                label={묶음.label}
                summary={{ count: 묶음.items.length, inSum: 0, outSum: 0, net: 0 }}
                hideSum
              />
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
                  {묶음.items.map((r) => (
                    <tr key={r.log_id}>
                      <th className="admin-mono">{r.at_time}</th>
                      <td>
                        <span className={`admin-tbl__tag ${구분빛[r.kind] ?? "tint-잿빛"}`}>
                          {구분이름[r.kind] ?? r.kind}
                        </span>
                      </td>
                      {/* 길은 고른 폭 글꼴로, 화면 이름은 본문 글꼴로 적는다.
                          길은 글자 수를 세며 읽는 글이다. */}
                      <td
                        className={`admin-tbl__wrap${
                          줄이름(r).startsWith("/") ? " admin-mono" : ""
                        }`}
                      >
                        {줄이름(r)}
                      </td>
                      {/* 값은 요청과 외부에만 붙는다. 실패한 줄은 상태가,
                          멀쩡히 끝난 줄은 걸린 시간이 알맹이다. */}
                      <td className="admin-tbl__center">{값딱지(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}

      {필터열림 && (
        <AdminFilterPopup
          on초기화={() => set초안(안거름)}
          on적용={() => {
            if (초안.frm && 초안.to && 초안.frm > 초안.to) {
              say.warn("끝 날짜가 시작 날짜보다 앞섭니다.");
              return;
            }
            set걸림(초안);
            set필터열림(false);
          }}
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
            <p className="admin-hint">새것부터 200줄까지 보여 줍니다.</p>
          </EditField>
        </AdminFilterPopup>
      )}
    </div>
  );
}
