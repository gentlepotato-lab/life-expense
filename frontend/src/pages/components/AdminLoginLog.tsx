import { useCallback, useEffect, useState } from "react";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { say } from "../../utils/notify";
import { formatDateLabel } from "../../utils/dateGroup";
import useAdminFold from "../../hooks/useAdminFold";
import AdminFilterPopup from "./AdminFilterPopup";
import AdminMoreRow from "./AdminMoreRow";
import DateGroupHeader from "./DateGroupHeader";
import Collapse from "./Collapse";
import { CollapseAllButtons } from "./CollapseToggle";
import DayPicker from "./DayPicker";
import SingleSelect from "./SingleSelect";
import { EditField, EditDivider } from "./CardEditModal";
import { 먼저펼칠줄, 스르륵한도 } from "./adminLogBits";

/**
 * 로그인 기록.
 *
 * 성공과 실패를 한 줄로 합쳐 날짜마다 묶는다. 둘을 따로 두니 누가 자꾸
 * 들어오려 하는지 보려면 두 목록을 눈으로 맞춰 가며 읽어야 했다.
 *
 * 짜임은 공지와 같다(AdminNotices.tsx). 날짜가 카드 밖 단 머리말에 서고,
 * 그 머리말을 눌러 접고 편다. 위에 모두 펼치기|접기와 거르기를 둔다.
 * 사용자 사이트의 내역 화면과 공지사항 화면도 같은 결이다.
 *
 * 실패한 줄과 아직 열려 있는 줄에만 딱지가 붙는다. 멀쩡히 들어왔다 끝난
 * 줄에까지 딱지를 달면 목록이 딱지밭이 된다.
 *
 * 기기는 브라우저가 스스로 밝히는 글에서 추려 적고, IP 주소는 앞에 선
 * nginx 가 넘겨주는 것을 적는다. 한 기기에서 다시 들어오면 그 기기의 옛
 * 줄은 걷히므로, 열려 있는 줄은 기기마다 하나뿐이다
 * (app/routers/admin.py의 /admin/login).
 *
 * 하루에 여러 번 들어온 날이 있어 먼저 몇 줄만 펼친다. 나머지는 표 아래
 * (...)를 눌러 펴고, 다시 눌러 접는다(AdminMoreRow.tsx).
 *
 * 한 줄에 여섯 칸이다. 이 기기 표, 시각, 유지, 기기, IP 주소, 상태다. 기기 이름을
 * 바탕만 적으면서 다섯이 412px 한 줄에 들어간다. 「Windows Chrome」으로
 * 적던 때는 들어가지 않아 시각과 유지를 한 칸에 담았다
 * (app/routers/admin.py의 _기기이름).
 *
 * 실패한 줄에는 기기도 IP 주소도 시간도 없다. 그 줄은 요청 기록에서 가져오는데
 * (action_logs), 거기에는 담은 적이 없다.
 */

type 줄 = {
  on_day: string;
  at_time: string;
  ok: boolean;
  alive: boolean;
  mine: boolean;
  /** 추려 낸 기기 이름. 가리지 못하면 「다른 기기」다. 실패한 줄은 비어 있다. */
  device: string;
  /** 들어온 IP 주소. 실패한 줄에는 없다. */
  ip: string;
  /** 열려 있던 시간(초). 실패한 줄에는 없다. */
  held: number | null;
};

type 받은것 = { live: number; rows: 줄[] };

const 선 = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/**
 * 지금 보고 있는 기기에 서는 표. 동그라미 안에 체크다.
 *
 * 줄 맨 앞 칸에 선다. 자물쇠와 같은 결로 그린다. 같은 16칸, 같은 굵기, 같은
 * 둥근 끝이다. 이모지를 쓰지 않는 까닭은 기기마다 다른 얼굴로 떠서다.
 */
const 이기기표 = (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="6.4" {...선} />
    <path d="M5.2 8.2 7.1 10.1 10.8 6.1" {...선} />
  </svg>
);

/**
 * 상태를 말하는 자물쇠.
 *
 * 열린 것은 고리가 열려 있고, 닫힌 것은 물려 있고, 실패한 것은 가새가 그어져
 * 있다. 빛깔로도 한 번 더 가른다. 16 상자에 1.6 두께로, 사용자 사이트의
 * 기호들과 같은 잣대로 그린다(MenuIcons.tsx).
 */
const 자물쇠 = {
  열림: (
    <svg viewBox="0 0 16 16" {...선} aria-hidden="true">
      <path d="M3.6 7.4h8.8v6.2H3.6z" />
      <path d="M6 7.4V5.2a2.6 2.6 0 0 1 5.1-.6" />
    </svg>
  ),
  닫힘: (
    <svg viewBox="0 0 16 16" {...선} aria-hidden="true">
      <path d="M3.6 7.4h8.8v6.2H3.6z" />
      <path d="M6 7.4V5.2a2 2 0 0 1 4 0v2.2" />
    </svg>
  ),
  실패: (
    <svg viewBox="0 0 16 16" {...선} aria-hidden="true">
      <path d="M3.6 7.4h8.8v6.2H3.6z" />
      <path d="M6 7.4V5.2a2 2 0 0 1 4 0v2.2" />
      <path d="M2.4 14.6L13.6 2.4" />
    </svg>
  ),
};

/**
 * 얼마나 열려 있었나.
 *
 * 열려 있는 줄은 지금까지, 닫힌 줄은 닫힌 때까지다. 초를 그대로 적으면
 * 「28800초」처럼 읽히지 않으므로 가장 큰 자리 하나만 적는다. 한 줄에
 * 들어가야 해서 「8시간 20분」처럼 둘을 적지는 않는다.
 *
 * 칸 이름은 「열린 시간」이다. 열림과 닫힘을 가리는 자물쇠가 같은 줄에 서
 * 있으므로, 그 말과 한 벌로 읽힌다.
 */
function 열린시간(초: number | null): string {
  if (초 === null) return "-";
  if (초 < 60) return `${초}초`;
  if (초 < 3600) return `${Math.floor(초 / 60)}분`;
  if (초 < 86400) return `${Math.floor(초 / 3600)}시간`;
  return `${Math.floor(초 / 86400)}일`;
}

/**
 * 기기마다의 딱지 빛깔.
 *
 * 값이 다르면 음영도 달라야 한 눈에 갈린다. 바탕이 무엇인지로 가르는데,
 * 모르는 기기는 잿빛이다.
 */
function 기기빛(기기: string): string {
  if (기기.startsWith("Windows")) return "tint-하늘";
  if (기기.startsWith("iPhone") || 기기.startsWith("iPad")) return "tint-분홍";
  if (기기.startsWith("Android")) return "tint-풀빛";
  if (기기.startsWith("Mac")) return "tint-보라";
  return "tint-잿빛";
}

/** 거르는 조건. 빈 글이면 안 거른다. */
type 거름 = { 됐나: string; frm: string; to: string };
const 안거름: 거름 = { 됐나: "", frm: "", to: "" };
const 걸렸나 = (f: 거름) => !!(f.됐나 || f.frm || f.to);

export default function AdminLoginLog() {
  const [받음, set받음] = useState<받은것 | null>(null);
  const [탈, set탈] = useState(false);
  const [걸림, set걸림] = useState<거름>(안거름);
  /* 팝업 안에서 고치는 중인 조건. [적용]을 누르지 않고 닫으면 버린다. */
  const [초안, set초안] = useState<거름>(안거름);
  const [필터열림, set필터열림] = useState(false);
  /* 접은 날. 공지와 같은 꼴이다. 기본은 모두 펼침이다. 로그인은 하루에
     몇 줄뿐이라 접으면 볼 것이 없다. */
  const [접은날, set접은날] = useState<Set<string>>(new Set());
  /* 긴 날의 나머지를 펼치고 접는 자리. 한 번 펼친 날은 줄을 세운 채
     접었다 폈다 하므로 스르륵 닫힌다(hooks/useAdminFold.ts). */
  const 펼침 = useAdminFold();

  const 받기 = useCallback((f: 거름) => {
    set탈(false);
    axios
      .get("/admin/sessions", {
        headers: 머리(),
        params: {
          ...(f.됐나 ? { ok: f.됐나 } : {}),
          ...(f.frm ? { frm: f.frm } : {}),
          ...(f.to ? { to: f.to } : {}),
        },
      })
      .then((r) => set받음(r.data as 받은것))
      .catch(() => {
        set받음({ live: 0, rows: [] });
        set탈(true);
      });
  }, []);

  useEffect(() => 받기(걸림), [받기, 걸림]);

  /* 날로 묶는다. 서버가 이미 새것부터 보내므로 나오는 차례를 그대로 쓴다. */
  const 날묶음 = (() => {
    const 묶음: { date: string; label: string; items: 줄[] }[] = [];
    for (const r of 받음?.rows ?? []) {
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
          {/* 지금 열려 있는 기기 수. 거르기와 상관없이 늘 같은 값이다. */}
          {받음 && 받음.live > 0 && (
            <span className="admin-span__tag">열려 있는 기기 {받음.live}</span>
          )}
          <span className="admin-toolbar-row__gap" />
          {날묶음.length > 0 && (
            <CollapseAllButtons
              onExpandAll={() => set접은날(new Set())}
              onCollapseAll={() => set접은날(new Set(날묶음.map((g) => g.date)))}
            />
          )}
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

      {/* 기호가 무엇을 뜻하는지 적는 줄. 자물쇠만으로는 처음 봐서 알 수 없다. */}
      {날묶음.length > 0 && (
        <div className="admin-legend">
          {/* 기호와 그 이름을 한 조각으로 묶는다. 여덟을 한 줄에 늘어놓던 때는
              기호와 이름 사이가 묶음 사이와 같은 8px이라, 어느 이름이 어느
              기호의 것인지 눈으로 묶이지 않았다. */}
          <span className="admin-legend__it">
            <span className="admin-tbl__mark--open">{자물쇠.열림}</span>
            열림
          </span>
          <span className="admin-legend__it">
            <span className="admin-tbl__mark--shut">{자물쇠.닫힘}</span>
            닫힘
          </span>
          <span className="admin-legend__it">
            <span className="admin-tbl__mark--bad">{자물쇠.실패}</span>
            실패
          </span>
          <span className="admin-legend__it">
            <span className="admin-tbl__here">{이기기표}</span>이 기기
          </span>
        </div>
      )}

      {받음 === null ? (
        <div className="card admin-soon">
          <p className="page-empty">불러오는 중입니다.</p>
        </div>
      ) : 탈 ? (
        <div className="card admin-soon">
          <p className="page-empty">기록을 불러오지 못했습니다.</p>
        </div>
      ) : 날묶음.length === 0 ? (
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
                {/* 날짜는 카드 밖, 단 머리말이 말한다. 셀 돈이 없으므로
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
                  <table className="admin-tbl admin-tbl--login">
                    <colgroup>
                      {/* 맨 앞은 이 기기 표가 서는 칸이다. 시각과 유지와
                          상태는 글이 정해져 있어 못 박고, 남는 폭을 기기가
                          쓴다. 못 박은 값은 CSS가 쥔다(.admin-tbl--login) —
                          좁은 화면에서 그 값이 줄어야 여섯이 한 줄에 선다. */}
                      <col style={{ width: "var(--c-here)" }} />
                      <col style={{ width: "var(--c-at)" }} />
                      <col style={{ width: "var(--c-held)" }} />
                      <col />
                      {/* IP 주소는 폭을 못 박는다. 꼬리가 잘린 주소는 아무
                          말도 아니다. 열넉 자(223.39.214.144)가 다 들어가는
                          폭이다. 더 좁은 화면에서는 기기 이름 쪽이 줄어든다 —
                          그쪽은 꼬리가 잘려도 어느 기기인지 읽힌다. */}
                      <col style={{ width: "var(--c-ip)" }} />
                      <col style={{ width: "var(--c-lock)" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="admin-tbl__here" />
                        <th>시각</th>
                        <th>유지</th>
                        <th>기기</th>
                        <th>IP 주소</th>
                        <th className="admin-tbl__mark" />
                      </tr>
                    </thead>
                    <tbody>
                      {보일것.map((r, i) => (
                        <tr
                          key={`${묶음.date}-${r.at_time}-${i}`}
                          className={`${r.alive ? "" : "is-off"}${
                            r.mine ? " is-here" : ""
                          }${
                            스르륵 && i >= 먼저펼칠줄
                              ? ` admin-tbl__extra${다폈나 ? "" : " is-folded"}`
                              : ""
                          }`.trim()}
                        >
                          {/* 지금 보고 있는 기기에만 표가 선다. */}
                          <td className="admin-tbl__here">
                            {r.mine ? 이기기표 : null}
                          </td>
                          {/* 들어온 시각. 줄의 알맹이라 칸 이름으로 세운다. */}
                          <th className="admin-mono">{r.at_time}</th>
                          {/* 열려 있던 시간. 재어 적은 값이라 네모 딱지다. */}
                          <td>
                            {r.held !== null ? (
                              <span className="admin-tbl__chip tint-잿빛">
                                {열린시간(r.held)}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          {/* 기기는 이름이라 둥근 딱지다. 바탕마다 빛깔이 다르다. */}
                          <td>
                            {r.device ? (
                              <span className={`admin-tbl__tag ${기기빛(r.device)}`}>
                                {r.device}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="admin-tbl__right admin-mono">{r.ip || "-"}</td>
                          {/* 자물쇠. 읽는 장치에는 글로 적어 준다. */}
                          <td
                            className={`admin-tbl__mark admin-tbl__mark--${
                              !r.ok ? "bad" : r.alive ? "open" : "shut"
                            }`}
                          >
                            <span
                              role="img"
                              aria-label={!r.ok ? "실패" : r.alive ? "열림" : "닫힘"}
                            >
                              {!r.ok ? 자물쇠.실패 : r.alive ? 자물쇠.열림 : 자물쇠.닫힘}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {묶음.items.length > 먼저펼칠줄 && (
                        <AdminMoreRow
                          칸수={6}
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
          <EditField label="결과" span={12}>
            <SingleSelect
              noun="결과"
              options={[
                { value: "", label: "(전체)" },
                { value: "1", label: "성공" },
                { value: "0", label: "실패" },
              ]}
              selected={초안.됐나}
              onChange={(v) => set초안({ ...초안, 됐나: v })}
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
