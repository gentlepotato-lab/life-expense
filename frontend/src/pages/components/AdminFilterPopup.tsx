import useBackClose from "../../hooks/useBackClose";
import useScrollLock from "../../hooks/useScrollLock";

/**
 * 거르는 조건을 묻는 팝업의 껍데기.
 *
 * 묻는 것은 쪽마다 다르지만 껍데기와 바닥 단추는 같다. 대시보드와 공지가
 * 저마다 같은 짜임을 또 적지 않도록 여기 한 곳에 둔다. 묻는 칸은 부르는
 * 쪽이 children으로 넣는다.
 *
 * 짜임과 크기와 단추 차례는 사용자 화면의 거르기 팝업을 그대로 쓴다
 * (pages/Entries.tsx의 filterOpen). 바닥은 되돌리는 것, 닫기, 하려던 것
 * 차례다. 닫기는 고치던 조건을 버리고, 걸려 있던 조건은 그대로 남는다.
 */
export default function AdminFilterPopup({
  on초기화,
  on적용,
  onClose,
  children,
}: {
  on초기화: () => void;
  on적용: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useBackClose(true, onClose);
  /* 열려 있는 동안 뒤쪽은 구르지 않는다. */
  useScrollLock(true);

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

        <div className="popup-body edit-grid">{children}</div>

        <div className="btn-row popup-foot popup-foot--tight">
          <button type="button" className="ui-btn" onClick={on초기화}>
            초기화
          </button>
          <button type="button" className="ui-btn" onClick={onClose}>
            닫기
          </button>
          <button type="button" className="ui-btn primary" onClick={on적용}>
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
