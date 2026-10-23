import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useLongPress from "../../hooks/useLongPress";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { say, ask } from "../../utils/notify";
import AdminNoticePopup, { type 초안 } from "./AdminNoticePopup";
import AddButton from "./AddButton";
import OnOffToggle from "./OnOffToggle";
import AdminFilterPopup from "./AdminFilterPopup";
import DateGroupHeader from "./DateGroupHeader";
import useAdminPeriod from "../../hooks/useAdminPeriod";
import AdminPeriodBar from "./AdminPeriodBar";
import { CollapseAllButtons } from "./CollapseToggle";
import Collapse from "./Collapse";
import { formatDateLabel } from "../../utils/dateGroup";
import DayPicker from "./DayPicker";
import SingleSelect from "./SingleSelect";
import { EditField, EditDivider } from "./CardEditModal";

/**
 * 공지사항.
 *
 * 화면은 목록 하나다. 적는 것도 고치는 것도 팝업에서 한다. 내역 카드와 같은
 * 결이다. 목록에서 한 줄을 누르면 그 줄이 팝업으로 열린다. 적는 칸을 목록
 * 위에 붙박이로 두니, 손전화에서 목록 아래쪽 줄의 편집을 눌러도 화면
 * 위쪽만 바뀌어 아무 일도 안 일어난 것처럼 보였다.
 *
 * 켜고 끄기와 제거는 편집 중에만 나온다. 설정 탭의 화면들과 같다
 * (pages/PaymentMethods.tsx).
 */

type 공지 = {
  notice_id: number;
  title: string;
  body: string | null;
  start_on: string | null;
  end_on: string | null;
  sort_order: number;
  is_active: number;
  created_on: string | null;
  updated_on: string | null;
};

/** 새로 적을 때의 빈 줄. */
const 빈것: 초안 = { title: "", body: "", start_on: "", end_on: "", sort_order: 0, is_active: 1 };

/**
 * 거르는 조건.
 *
 * 켜짐은 "" 이 전체, "1" 이 켜진 것, "0" 이 꺼진 것이다. 나머지는 빈 글이면
 * 안 거른다. 서버에 묻지 않고 받은 목록에서 골라낸다. 공지는 많아도
 * 수백 줄이라, 조건마다 요청을 새로 내는 쪽이 오히려 더 느리다.
 */
type 거름 = {
  켜짐: string;
  제목: string;
  /** 공지가 뜨는 기간(start_on~end_on)과 이 기간이 겹치는 것만 본다. */
  뜨는frm: string;
  뜨는to: string;
};

const 안거름: 거름 = { 켜짐: "", 제목: "", 뜨는frm: "", 뜨는to: "" };

/** 조건이 하나라도 걸려 있나. */
const 걸렸나 = (f: 거름) => Object.values(f).some((v) => v !== "");

/**
 * 조건에 맞는 줄만 골라낸다.
 *
 * 뜨는 기간은 "겹치나"로 본다. 공지 쪽은 기간을 비울 수 있어서(비우면 늘
 * 뜬다) 양끝이 없는 것으로 치고 재야 한다. 등록일은 날 하나뿐이므로
 * 사이에 드나로 본다.
 */
function 골라내기(들: 공지[], f: 거름): 공지[] {
  const 말 = f.제목.trim().toLowerCase();
  return 들.filter((n) => {
    if (f.켜짐 !== "" && String(n.is_active) !== f.켜짐) return false;
    if (말 && !n.title.toLowerCase().includes(말)) return false;
    if (f.뜨는frm && n.end_on && n.end_on < f.뜨는frm) return false;
    if (f.뜨는to && n.start_on && n.start_on > f.뜨는to) return false;
    return true;
  });
}

/**
 * 고른 기간에 등록한 것만 골라낸다.
 *
 * 등록일은 날 하나뿐이므로 사이에 드나로 본다. 등록일이 없는 줄(옛 줄)은
 * 기간을 걸면 빠진다. 언제 올린 것인지 모르는 줄이라 어느 달에 넣을지
 * 가릴 수 없다.
 */
function 기간골라내기(들: 공지[], frm: string, to: string): 공지[] {
  return 들.filter((n) => {
    if (!n.created_on) return false;
    if (n.created_on < frm) return false;
    if (n.created_on > to) return false;
    return true;
  });
}

/**
 * 공지 한 줄.
 *
 * 꾹 누르면 편집 팝업이 열린다. 사용자 화면의 내역 카드와 같은 잣대다
 * (hooks/useLongPress.ts). 톡 눌러 열게 두니 켜고 끄는 스위치를
 * 누르려다 팝업이 열리는 일이 잦았다.
 *
 * 줄마다 훅을 하나씩 걸어야 하므로 부품으로 뗀다. map() 안에서는 훅을
 * 부를 수 없다. 이름을 영어로 적는 것은 한글 이름이면 react-hooks 규칙이
 * 부품으로 알아보지 못하기 때문이다.
 */
function NoticeRow({
  공지: n,
  편집중,
  on열기,
  on끄고켜기,
  on지우기,
  on상세,
}: {
  공지: 공지;
  편집중: boolean;
  on열기: () => void;
  on끄고켜기: () => void;
  on지우기: () => void;
  on상세: () => void;
}) {
  /* 편집 중에는 막는다. 그때는 스위치와 제거가 할 일이다. */
  const { pressing, handlers } = useLongPress(on열기, { disabled: 편집중 });

  /* 제목이 칸을 넘었나. 넘은 줄에만 자락과 (...)을 얹는다. 내역 화면의
     메모가 끊기는 꼴과 같다(pages/components/MemoPad.tsx). CSS만으로는
     넘쳤는지 알 수 없어 재 본다. */
  const 이름칸 = useRef<HTMLSpanElement | null>(null);
  const [잘렸나, set잘렸나] = useState(false);

  useEffect(() => {
    const 재기 = () => {
      const e = 이름칸.current;
      if (e) set잘렸나(e.scrollWidth > e.clientWidth + 1);
    };
    재기();
    /* 창 폭이 바뀌면 끊기는 자리도 바뀐다. */
    window.addEventListener("resize", 재기);
    return () => window.removeEventListener("resize", 재기);
  }, [n.title, 편집중]);

  return (
    <li
      className={`admin-list__row${n.is_active ? "" : " is-off"}${
        편집중 ? "" : " card--pressable"
      }${pressing ? " pressing" : ""}`}
      title={편집중 ? undefined : "꾹 눌러서 편집"}
      {...handlers}
    >
      <span ref={이름칸} className="admin-list__name admin-list__name--cut">
        {n.title}
        {/* 끊긴 끝. 뒤쪽을 길게 걸쳐 옅어지다 (...)로 이어진다. 메모 판과
            같은 꼴이다. 짧게 덮으면 끝이 딱 떨어져 테이프를 붙여 놓은 것처럼
            보인다. */}
        {잘렸나 && (
          <span className="admin-list__fade" aria-hidden="true">
            (...)
          </span>
        )}
      </span>
      {/* 등록한 날은 단 머리말이 말한다. 줄에는 고친 때만 적는다. 고친
          적이 없으면 아무것도 적지 않는다. 둘 다 딱지로 달았더니 긴 제목이
          붙은 줄에서 스위치까지 밀려 났다. */}
      {n.updated_on && n.updated_on !== n.created_on && (
        <span className="admin-list__path">수정 {n.updated_on.slice(2)}</span>
      )}
      {/* 스위치는 늘 선다. 편집 중이 아니면 막혀 있을 뿐이다. */}
      <OnOffToggle
        이름={n.title}
        켜짐={!!n.is_active}
        막힘={!편집중}
        켬말="켠다. 홈에 뜬다."
        끔말="끈다. 홈에 안 뜬다."
        on바뀜={(켠다) => {
          /* 이미 그쪽이면 아무 일도 하지 않는다. 켠 쪽을 또 눌러 꺼지면
             스위치가 아니라 뒤집개로 읽힌다. */
          if (켠다 === !!n.is_active) return;
          on끄고켜기();
        }}
      />
      {/* 고친 적과 뜨는 기간까지 한자리에서 보는 쪽으로 간다. 편집 중에는
          제거가 그 자리에 서므로 함께 세우지 않는다. 단추에서 시작한 누름은
          꾹 누르기가 받지 않는다(hooks/useLongPress.ts). */}
      {편집중 ? (
        <button type="button" className="ui-btn small" onClick={on지우기}>
          제거
        </button>
      ) : (
        <button type="button" className="admin-go" onClick={on상세}>
          상세
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path
              d="M6 4l4 4-4 4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </li>
  );
}

export default function AdminNotices() {
  const navigate = useNavigate();
  /* 등록한 때로 달을 넘긴다. 다른 관리자 쪽과 같은 막대를 쓴다
     (AdminPeriodBar.tsx). */
  const 때 = useAdminPeriod();
  const [목록, set목록] = useState<공지[] | null>(null);
  const [편집중, set편집중] = useState(false);
  /* 편집에 들어갈 때의 켜짐 상태. 저장할 때 바뀐 줄만 가려내는 데 쓴다.
     문구와 메뉴도 같은 꼴이다(AdminToggles.tsx). */
  const [편집전, set편집전] = useState("[]");
  /* 팝업이 쥔 것. 열쇠가 null이면 새로 적는 중이고, 수가 들어 있으면 그 줄을
     고치는 중이다. 팝업이 닫혀 있으면 아예 없다. */
  const [연것, set연것] = useState<{ id: number | null; 값: 초안; 꾹?: boolean } | null>(null);
  /* 걸린 조건과, 팝업 안에서 고치는 중인 조건. [적용]을 누르지 않고
     닫으면 고치던 것은 버린다. 사용자 화면의 거르기와 같다. */
  const [걸림, set걸림] = useState<거름>(안거름);
  const [초안, set초안] = useState<거름>(안거름);
  const [필터열림, set필터열림] = useState(false);
  /* 접은 날. 내역 화면과 같은 꼴이다. */
  const [접은날, set접은날] = useState<Set<string>>(new Set());

  const 받기 = useCallback(() => {
    axios
      .get("/admin/notices", { headers: 머리() })
      .then((r) => set목록(r.data as 공지[]))
      .catch(() => set목록([]));
  }, []);

  useEffect(받기, [받기]);

  const 담기 = async () => {
    if (!연것) return;
    const 값 = 연것.값;
    if (!값.title.trim()) {
      say.warn("제목을 입력해 주세요.");
      return;
    }
    try {
      if (연것.id === null) {
        await axios.post("/admin/notices", 값, { headers: 머리() });
        say.ok("추가 완료-!! ;-)");
      } else {
        await axios.put(`/admin/notices/${연것.id}`, 값, { headers: 머리() });
        say.ok("저장 완료-!! ;-)");
      }
      set연것(null);
      받기();
    } catch {
      say.bad("저장하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  /** 켜고 끄기는 화면에서만 바꾼다. 서버에는 저장할 때 한 번에 보낸다. */
  const 끄고켜기 = (n: 공지) =>
    set목록((v) =>
      (v ?? []).map((x) => (x.notice_id === n.notice_id ? { ...x, is_active: x.is_active ? 0 : 1 } : x)),
    );

  /** 바뀐 줄을 가릴 때 쓰는 지문. */
  const 지문 = (들: 공지[]) => JSON.stringify(들.map((x) => [x.notice_id, x.is_active]));

  const 저장 = async () => {
    const 이제 = 목록 ?? [];
    if (지문(이제) === 편집전) {
      say.warn("변경된 내용이 없습니다만...?");
      set편집중(false);
      return;
    }
    const 옛것 = new Map<number, number>();
    for (const x of JSON.parse(편집전) as [number, number][]) 옛것.set(x[0], x[1]);
    const 보낼것 = 이제.filter((x) => 옛것.get(x.notice_id) !== x.is_active);
    try {
      for (const x of 보낼것) {
        await axios.put(
          `/admin/notices/${x.notice_id}`,
          {
            ...x,
            body: x.body ?? "",
            start_on: x.start_on ?? "",
            end_on: x.end_on ?? "",
          },
          { headers: 머리() },
        );
      }
      say.ok("저장 완료-!! ;-)");
      set편집중(false);
      받기();
    } catch {
      say.bad("저장하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  const 지우기 = async (n: 공지) => {
    const 할까 = await ask({
      title: "공지 제거",
      body: "이 공지를 제거할까요?",
      warn: "되돌릴 수 없습니다.",
      go: "제거",
      danger: true,
    });
    if (!할까) return;
    try {
      await axios.delete(`/admin/notices/${n.notice_id}`, { headers: 머리() });
      say.ok("제거 완료-!! ;-)");
      받기();
    } catch {
      say.bad("제거하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  /* 조건에 맞아 화면에 서는 줄. 기간을 먼저 거르고 조건을 건다. */
  const 기간것 = 목록 ? 기간골라내기(목록, 때.기간.frm, 때.기간.to) : [];
  const 보는것 = 골라내기(기간것, 걸림);

  /* 등록한 날로 묶는다. 사용자 화면의 내역이 날짜마다 단을 세우는 것과 같은
     꼴이다(pages/Entries.tsx). 날짜를 줄마다 딱지로 달았더니 긴 제목이
     붙은 줄에서 잘렸고, 같은 날 적은 공지끼리 묶이지도 않았다.
     목록이 이미 새것부터이므로 나오는 차례를 그대로 쓴다. */
  const 날묶음 = (() => {
    const 묶음: { date: string; label: string; items: 공지[] }[] = [];
    for (const n of 보는것) {
      const 날 = n.created_on ?? "";
      const 끝 = 묶음[묶음.length - 1];
      if (끝 && 끝.date === 날) 끝.items.push(n);
      else 묶음.push({ date: 날, label: 날 ? formatDateLabel(날) : "날짜 없음", items: [n] });
    }
    return 묶음;
  })();

  return (
    <div className="admin-edit">
      <div className="cat-toolbar">
        <AdminPeriodBar
          때={때}
          on필터={() => {
            set초안(걸림);
            set필터열림(true);
          }}
        >
          {날묶음.length > 0 && (
            <CollapseAllButtons
              onExpandAll={() => set접은날(new Set())}
              onCollapseAll={() => set접은날(new Set(날묶음.map((g) => g.date)))}
            />
          )}
        </AdminPeriodBar>

        <div className="pm-toolbar-row admin-toolbar-row">
          {/* 거른 집계는 왼쪽 끝에 딱지로 적는다. 걸면 목록에서 줄이
              빠지는데, 몇 줄 가운데 몇 줄을 보고 있는지 적지 않으면
              줄이 사라진 것처럼 읽힌다. */}
          {목록 && (
            <span className="admin-span__tag">
              {걸렸나(걸림)
                ? `${보는것.length}건 / ${기간것.length}건`
                : `${기간것.length}건`}
            </span>
          )}
          {/* 할 일 단추는 오른쪽 끝에 모은다. 사용자 화면도 거기에 둔다.
              담기는 떠 있는 동그란 단추가 맡는다(AddButton). */}
          <span className="admin-toolbar-row__gap" />
          <button
            type="button"
            className="ui-btn primary"
            onClick={() => {
              if (!편집중) {
                set편집전(지문(목록 ?? []));
                set편집중(true);
              } else {
                void 저장();
              }
            }}
          >
            {편집중 ? "저장" : "편집"}
          </button>
        </div>
      </div>

      <div className="cat-card admin-box">
      <section className="admin-group">
        <h3 className="admin-card__title">등록한 공지</h3>
        {목록 === null ? (
          <p className="page-empty">불러오는 중입니다.</p>
        ) : 목록.length === 0 ? (
          <p className="page-empty">등록한 공지가 없습니다.</p>
        ) : 보는것.length === 0 ? (
          <p className="page-empty">조건에 맞는 공지가 없습니다.</p>
        ) : (
          <div className="card-list admin-days-list">
            {날묶음.map((묶음) => {
              const 폈나 = !접은날.has(묶음.date);
              return (
                <section key={묶음.date || "날짜없음"} className="date-group">
                  {/* 단 머리말은 내역 화면이 쓰는 그 부품이다. 셀 돈이
                      없으므로 합계는 접는다(hideSum). */}
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
                    <ul className="admin-list">
                      {묶음.items.map((n) => (
                        <NoticeRow
                          key={n.notice_id}
                          공지={n}
                          편집중={편집중}
                          on열기={() =>
                            set연것({
                              id: n.notice_id,
                              /* 꾹 눌러 연 것이라 손이 아직 닿아 있다.
                                 팝업이 손을 기다렸다 손짓을 받는다. */
                              꾹: true,
                              값: {
                                title: n.title,
                                body: n.body ?? "",
                                start_on: n.start_on ?? "",
                                end_on: n.end_on ?? "",
                                sort_order: n.sort_order,
                                is_active: n.is_active,
                              },
                            })
                          }
                          on끄고켜기={() => 끄고켜기(n)}
                          on지우기={() => void 지우기(n)}
                          on상세={() =>
                            navigate(`/admin/notice-detail?id=${n.notice_id}`, {
                              state: { back: "공지" },
                            })
                          }
                        />
                      ))}
                    </ul>
                  </Collapse>
                </section>
              );
            })}
          </div>
        )}
      </section>
      </div>

      {/* 담기. 사용자 화면의 다섯 자리와 같은 단추, 같은 자리다. */}
      <AddButton 이름="새 공지" onClick={() => set연것({ id: null, 값: { ...빈것 } })} />

      {필터열림 && (
        <AdminFilterPopup
          on초기화={() => set초안(안거름)}
          on적용={() => {
            if (초안.뜨는frm && 초안.뜨는to && 초안.뜨는frm > 초안.뜨는to) {
              say.warn("끝 날짜가 시작 날짜보다 앞섭니다.");
              return;
            }
            set걸림(초안);
            set필터열림(false);
          }}
          onClose={() => set필터열림(false)}
        >
          <EditField label="켜짐" span={6}>
            <SingleSelect
              noun="상태"
              options={[
                { value: "", label: "(전체)" },
                { value: "1", label: "켜짐" },
                { value: "0", label: "꺼짐" },
              ]}
              selected={초안.켜짐}
              onChange={(v) => set초안({ ...초안, 켜짐: v })}
              placeholder="(전체)"
            />
          </EditField>

          <EditField label="제목" span={6}>
            <input
              type="text"
              value={초안.제목}
              placeholder="(제목)"
              onChange={(e) => set초안({ ...초안, 제목: e.target.value })}
            />
          </EditField>

          <EditDivider />

          <EditField label="뜨는 기간 시작" span={6}>
            <DayPicker
              monthJump
              clearable
              value={초안.뜨는frm}
              onChange={(v) => set초안({ ...초안, 뜨는frm: v })}
            />
          </EditField>

          <EditField label="뜨는 기간 종료" span={6}>
            <DayPicker
              monthJump
              clearable
              value={초안.뜨는to}
              onChange={(v) => set초안({ ...초안, 뜨는to: v })}
            />
          </EditField>

          <EditField label="" span={12}>
            <p className="admin-hint">
              고른 기간에 걸쳐 뜨는 공지를 찾습니다. 등록한 때는 위에서 달로
              넘겨 봅니다.
            </p>
          </EditField>
        </AdminFilterPopup>
      )}

      {연것 && (
        <AdminNoticePopup
          새것={연것.id === null}
          값={연것.값}
          꾹눌러열림={!!연것.꾹}
          on바뀜={(값) => set연것({ ...연것, 값 })}
          on저장={() => void 담기()}
          onClose={() => set연것(null)}
        />
      )}
    </div>
  );
}
