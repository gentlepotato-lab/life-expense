import useBackClose from "../../hooks/useBackClose";
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
 * 날짜는 사용자 화면이 쓰는 DayPicker로 고른다. 브라우저가 그리는 날짜 칸은
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
  on바뀜,
  on저장,
  onClose,
}: {
  /** 새로 적는 중인가. 머리말과 하려던 것의 이름이 갈린다. */
  새것: boolean;
  값: 초안;
  on바뀜: (next: 초안) => void;
  on저장: () => void;
  onClose: () => void;
}) {
  useBackClose(true, onClose);

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel popup-panel--framed"
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
