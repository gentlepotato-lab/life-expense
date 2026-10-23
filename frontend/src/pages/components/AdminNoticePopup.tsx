import { useEffect, useState } from "react";
import useBackClose from "../../hooks/useBackClose";
import useScrollLock from "../../hooks/useScrollLock";
import DayPicker from "./DayPicker";
import { EditField, EditDivider } from "./CardEditModal";

/**
 * 공지를 적고 고치는 팝업.
 *
 * 새로 적는 것도 이미 등록한 것을 고치는 것도 여기서 한다. 둘이 묻는 것이
 * 똑같으므로 판을 둘로 나눌 까닭이 없다. 머리말과 하려던 것의 이름만
 * 갈린다.
 *
 * 짜임과 크기와 단추 차례는 사용자 화면의 팝업을 그대로 쓴다. 껍데기는
 * .popup-overlay와 .popup-panel--framed, 칸은 EditField, 바닥은
 * .btn-row.popup-foot이다. 크기도 그 판이 쥔다(90%, 최대 500px, 최대 90vh).
 *
 * 날짜는 사용자 화면이 쓰는 DayPicker로 선택한다. 브라우저가 그리는 날짜 칸은
 * 기기마다 생김새와 차례(mm/dd/yyyy)가 달라, 같은 앱으로 읽히지 않는다.
 * 기간을 거르는 자리이므로 monthJump와 clearable을 켠다.
 */

export type 초안 = {
  title: string;
  body: string;
  start_on: string;
  end_on: string;
  sort_order: number;
  is_active: number;
};

export default function AdminNoticePopup({
  새것,
  값,
  꾹눌러열림 = false,
  on바뀜,
  on저장,
  onClose,
}: {
  /** 새로 적는 중인가. 머리말과 하려던 것의 이름이 갈린다. */
  새것: boolean;
  값: 초안;
  /** 꾹 눌러서 열렸나. 그때는 손이 아직 판 위에 닿아 있다. */
  꾹눌러열림?: boolean;
  on바뀜: (next: 초안) => void;
  on저장: () => void;
  onClose: () => void;
}) {
  useBackClose(true, onClose);
  /* 열려 있는 동안 뒤쪽은 구르지 않는다. */
  useScrollLock(true);

  /**
   * 손을 뗄 때까지 판을 손짓에서 비운다.
   *
   * 꾹 누르면 손이 아직 닿아 있는 자리에 이 판이 뜬다. 하필 그 자리에 제목
   * 입력칸이 걸리면, 이어지는 누름을 그 칸이 받아 글이 잡히고 선택 손잡이가
   * 떠 버렸다. 입력칸은 글을 고르라고 있는 자리라 user-select로는 못 막는다.
   *
   * 그래서 뜬 뒤 첫 손 뗌까지만 판을 손짓에서 비운다. 떼면 곧바로 돌려주므로
   * 쓰는 데에는 아무 차이가 없다. 떼는 신호가 끝내 오지 않을 때를 대비해
   * 시계도 함께 건다. useLongPress의 손뗄때까지잠그기와 같은 잣대다.
   */
  const [손기다림, set손기다림] = useState(꾹눌러열림);

  useEffect(() => {
    if (!손기다림) return;
    const 풀기 = () => set손기다림(false);
    const 시계 = window.setTimeout(풀기, 3000);
    window.addEventListener("pointerup", 풀기);
    window.addEventListener("pointercancel", 풀기);
    window.addEventListener("touchend", 풀기);
    return () => {
      window.clearTimeout(시계);
      window.removeEventListener("pointerup", 풀기);
      window.removeEventListener("pointercancel", 풀기);
      window.removeEventListener("touchend", 풀기);
    };
  }, [손기다림]);

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className={`popup-panel popup-panel--framed${손기다림 ? " is-waiting-hand" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={새것 ? "새 공지" : "공지 편집"}
      >
        <header className="popup-head">
          <h3 className="popup-head__title">{새것 ? "새 공지" : "공지 편집"}</h3>
        </header>

        <div className="popup-body edit-grid">
          <EditField label="제목" span={12} required>
            <input
              type="text"
              value={값.title}
              placeholder="(제목)"
              maxLength={60}
              onChange={(e) => on바뀜({ ...값, title: e.target.value })}
            />
          </EditField>

          <EditField label="본문" span={12}>
            <textarea
              className="admin-area"
              value={값.body}
              placeholder="(본문)"
              rows={7}
              onChange={(e) => on바뀜({ ...값, body: e.target.value })}
            />
          </EditField>

          <EditDivider />

          <EditField label="시작일" span={6}>
            <DayPicker
              monthJump
              clearable
              value={값.start_on}
              onChange={(v) => on바뀜({ ...값, start_on: v })}
            />
          </EditField>

          <EditField label="종료일" span={6}>
            <DayPicker
              monthJump
              clearable
              value={값.end_on}
              onChange={(v) => on바뀜({ ...값, end_on: v })}
            />
          </EditField>

          <EditField label="" span={12}>
            <p className="admin-hint">기간을 설정하지 않으면 항상 표시됩니다.</p>
          </EditField>
        </div>

        <div className="btn-row popup-foot">
          {/* 사용자 화면의 팝업과 같은 차례다. 닫기 다음에 하려던 것. */}
          <button type="button" className="ui-btn" onClick={onClose}>
            닫기
          </button>
          <button type="button" className="ui-btn primary" onClick={on저장}>
            {새것 ? "추가" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
