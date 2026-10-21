import { useCallback, useEffect, useState } from "react";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { say, ask } from "../../utils/notify";
import AdminNoticePopup, { type 초안 } from "./AdminNoticePopup";
import AddButton from "./AddButton";
import OnOffToggle from "./OnOffToggle";
import AdminFilterPopup from "./AdminFilterPopup";
import DayPicker from "./DayPicker";
import SingleSelect from "./SingleSelect";
import { EditField, EditDivider } from "./CardEditModal";

/**
 * 공지사항.
 *
 * 화면은 목록 하나다. 적는 것도 고치는 것도 팝업에서 한다. 내역 카드와 같은
 * 결이다. 목록에서 한 줄을 누르면 그 줄이 팝업으로 열린다. 적는 칸을 목록
 * 위에 붙박이로 두었더니, 손전화에서 목록 아래쪽 줄의 편집을 눌러도 화면
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
 * 안 거른다. 서버에 묻지 않고 받아 둔 목록에서 골라낸다. 공지는 많아도
 * 수백 줄이라, 조건마다 요청을 새로 내는 쪽이 오히려 더 느리다.
 */
type 거름 = {
  켜짐: string;
  제목: string;
  /** 공지가 뜨는 기간(start_on~end_on)과 이 기간이 겹치는 것만 본다. */
  뜨는frm: string;
  뜨는to: string;
  /** 등록한 날이 이 사이에 드는 것만 본다. */
  등록frm: string;
  등록to: string;
};

const 안거름: 거름 = { 켜짐: "", 제목: "", 뜨는frm: "", 뜨는to: "", 등록frm: "", 등록to: "" };

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
    if (f.등록frm && (!n.created_on || n.created_on < f.등록frm)) return false;
    if (f.등록to && (!n.created_on || n.created_on > f.등록to)) return false;
    return true;
  });
}

export default function AdminNotices() {
  const [목록, set목록] = useState<공지[] | null>(null);
  const [편집중, set편집중] = useState(false);
  /* 편집에 들어갈 때의 켜짐 상태. 저장할 때 바뀐 줄만 가려내는 데 쓴다.
     문구와 메뉴도 같은 꼴이다(AdminToggles.tsx). */
  const [편집전, set편집전] = useState("[]");
  /* 팝업이 쥔 것. 열쇠가 null이면 새로 적는 중이고, 수가 들어 있으면 그 줄을
     고치는 중이다. 팝업이 닫혀 있으면 아예 없다. */
  const [연것, set연것] = useState<{ id: number | null; 값: 초안 } | null>(null);
  /* 걸어 둔 조건과, 팝업 안에서 고치는 중인 조건. [적용]을 누르지 않고
     닫으면 고치던 것은 버린다. 사용자 화면의 거르기와 같다. */
  const [걸림, set걸림] = useState<거름>(안거름);
  const [초안, set초안] = useState<거름>(안거름);
  const [필터열림, set필터열림] = useState(false);

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

  /* 조건에 맞아 화면에 서는 줄. 연번도 이 차례로 센다. */
  const 보는것 = 목록 ? 골라내기(목록, 걸림) : [];

  return (
    <div className="admin-edit">
      <div className="cat-toolbar">
        <div className="pm-toolbar-row admin-toolbar-row">
          {/* 거른 셈은 왼쪽 끝에 딱지로 적는다. 걸어 두면 목록에서 줄이
              빠지는데, 몇 줄 가운데 몇 줄을 보고 있는지 적어 두지 않으면
              줄이 사라진 것처럼 읽힌다. */}
          {걸렸나(걸림) && 목록 && (
            <span className="admin-span__tag">
              {보는것.length}건 / 전체 {목록.length}건
            </span>
          )}
          {/* 할 일 단추는 오른쪽 끝에 모은다. 사용자 화면도 거기에 둔다.
              담기는 떠 있는 동그란 단추가 맡는다(AddButton). */}
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
          <p className="page-empty">불러오고 있습니다.</p>
        ) : 목록.length === 0 ? (
          <p className="page-empty">등록한 공지가 없습니다.</p>
        ) : 보는것.length === 0 ? (
          <p className="page-empty">조건에 맞는 공지가 없습니다.</p>
        ) : (
          <ul className="admin-list">
            {보는것.map((n, i) => (
              <li
                key={n.notice_id}
                className={`admin-list__row${n.is_active ? "" : " is-off"}${편집중 ? "" : " is-tappable"}`}
                onClick={() => {
                  if (편집중) return;
                  set연것({
                    id: n.notice_id,
                    값: {
                      title: n.title,
                      body: n.body ?? "",
                      start_on: n.start_on ?? "",
                      end_on: n.end_on ?? "",
                      sort_order: n.sort_order,
                      is_active: n.is_active,
                    },
                  });
                }}
              >
                {/* 연번. 적힌 차례가 아니라 보이는 차례다. 몇 번째 줄인지
                    세는 데 쓰므로 공지 번호(notice_id)를 적지 않는다. */}
                <span className="admin-list__no">{보는것.length - i}</span>
                <span className="admin-list__name">{n.title}</span>
                {/* 등록한 때와 고친 때. 고친 적이 없으면 등록한 때만 적는다. */}
                {n.created_on && <span className="admin-list__path">등록 {n.created_on.slice(2)}</span>}
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
                    /* 이미 그쪽이면 아무 일도 하지 않는다. 켠 쪽을 또 눌러
                       꺼지면 스위치가 아니라 뒤집개로 읽힌다. */
                    if (켠다 === !!n.is_active) return;
                    끄고켜기(n);
                  }}
                />
                {편집중 && (
                  <button type="button" className="ui-btn small" onClick={() => void 지우기(n)}>
                    제거
                  </button>
                )}
              </li>
            ))}
          </ul>
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
            if (초안.등록frm && 초안.등록to && 초안.등록frm > 초안.등록to) {
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
            <p className="admin-hint">고른 기간에 걸쳐 뜨는 공지를 찾습니다.</p>
          </EditField>

          <EditDivider />

          <EditField label="등록일 시작" span={6}>
            <DayPicker
              monthJump
              clearable
              value={초안.등록frm}
              onChange={(v) => set초안({ ...초안, 등록frm: v })}
            />
          </EditField>

          <EditField label="등록일 종료" span={6}>
            <DayPicker
              monthJump
              clearable
              value={초안.등록to}
              onChange={(v) => set초안({ ...초안, 등록to: v })}
            />
          </EditField>
        </AdminFilterPopup>
      )}

      {연것 && (
        <AdminNoticePopup
          새것={연것.id === null}
          값={연것.값}
          on바뀜={(값) => set연것({ ...연것, 값 })}
          on저장={() => void 담기()}
          onClose={() => set연것(null)}
        />
      )}
    </div>
  );
}
