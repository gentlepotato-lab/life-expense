import useBackClose from "../../hooks/useBackClose";
import DayPicker from "./DayPicker";
import { EditField, EditDivider } from "./CardEditModal";
import { EMPTY_GROUP_FILTER, type GroupFilter } from "../../utils/groupFilter";

/**
 * 묶음 내역의 걸러 내기.
 *
 * 거는 조건은 utils/groupFilter.ts에 적어 두었다.
 * 머리, 본문, 바닥의 짜임은 내역 세 화면의 필터 팝업과 같다.
 */
export default function GroupFilterPopup({
  filter,
  setFilter,
  onClose,
  onApply,
}: {
  filter: GroupFilter;
  setFilter: React.Dispatch<React.SetStateAction<GroupFilter>>;
  /** 적용하지 않고 닫을 때 — 고치던 값을 되돌리는 것은 부르는 쪽 몫이다. */
  onClose: () => void;
  onApply: () => void;
}) {
  useBackClose(true, onClose);

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel popup-panel--framed"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="필터"
      >
        <header className="popup-head">
          <h3 className="popup-head__title">필터</h3>
        </header>

        <div className="popup-body edit-grid">
          {/* 거르는 자리는 지난 어느 때로도 갈 수 있어야 한다 —
              머리의 연월을 누르면 한 해가 펼쳐진다. */}
          <EditField label="시작일" span={6}>
            <DayPicker
              monthJump
              clearable
              value={filter.dateFrom}
              onChange={(v) => setFilter({ ...filter, dateFrom: v })}
            />
          </EditField>

          <EditField label="종료일" span={6}>
            <DayPicker
              monthJump
              clearable
              value={filter.dateTo}
              onChange={(v) => setFilter({ ...filter, dateTo: v })}
            />
          </EditField>

          <EditDivider />

          <EditField label="이름" span={12}>
            <input
              type="text"
              value={filter.name}
              placeholder="(묶음 이름)"
              onChange={(e) => setFilter({ ...filter, name: e.target.value })}
            />
          </EditField>

          <EditField label="메모" span={12}>
            <input
              type="text"
              value={filter.memo}
              placeholder="(메모)"
              onChange={(e) => setFilter({ ...filter, memo: e.target.value })}
            />
          </EditField>
        </div>

        <div className="btn-row popup-foot">
          <button
            type="button"
            className="ui-btn"
            onClick={() => setFilter({ ...EMPTY_GROUP_FILTER })}
          >
            초기화
          </button>
          {/* 편집 팝업과 같은 차례로 — 되돌리는 것, 닫기, 하려던 것 */}
          <button type="button" className="ui-btn" onClick={onClose}>
            닫기
          </button>
          <button type="button" className="ui-btn primary" onClick={onApply}>
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
