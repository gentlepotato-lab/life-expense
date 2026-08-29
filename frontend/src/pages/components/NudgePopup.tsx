import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useBackClose from "../../hooks/useBackClose";
import NudgeGroup from "./NudgeGroup";
import { PAGE_ICON } from "./MenuIcons";
import type { Nudge } from "../../utils/nudges";

/**
 * 종 단추를 눌렀을 때 뜨는 잔소리.
 *
 * 껍데기는 다른 팝업과 같은 틀(popup-overlay · popup-panel--framed)이고,
 * 속은 잔소리 화면과 같은 묶음(NudgeGroup)이다 — 두 자리가 다른 말을
 * 하면 안 되므로 셈도 모습도 한 벌만 쓴다.
 */
export default function NudgePopup({
  nudges,
  ready,
  onClose,
}: {
  nudges: Nudge[];
  ready: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  useBackClose(true, onClose);

  useEffect(() => {
    document.documentElement.classList.add("modal-open");
    return () => document.documentElement.classList.remove("modal-open");
  }, []);

  /* 팝업은 뒤로 가기용 자리를 하나 밀어 두고 있다. 그냥 옮기면 그 자리를
     되감으면서 방금 연 화면에서 튕겨 나온다. 먼저 뒤로 가서 팝업을 닫고,
     그 되감기가 끝난 뒤에 옮긴다.
     귀 기울이는 일을 useEffect가 아니라 누르는 그 자리에서 붙인다 —
     팝업이 닫히면서 사라지는 바람에 정작 신호를 못 받는 일을 막는다. */
  const goNudges = () => {
    const onPop = () => {
      window.removeEventListener("popstate", onPop);
      window.setTimeout(() => navigate("/nudges"), 0);
    };
    window.addEventListener("popstate", onPop);
    window.history.back();
  };

  const mind = nudges.filter((n) => n.level !== "good");
  const well = nudges.filter((n) => n.level === "good");

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel popup-panel--framed"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="잔소리"
      >
        <header className="popup-head">
          <h3 className="popup-head__title">잔소리</h3>
        </header>

        <div className="popup-body nudge-popup">
          {!ready && <div className="nudge-none">세어 보는 중입니다.</div>}
          {ready && mind.length === 0 && well.length === 0 && (
            <div className="nudge-none">잔소리할 게 없습니다.</div>
          )}
          {well.length > 0 && <NudgeGroup title=";-)" list={well} />}
          {mind.length > 0 && <NudgeGroup title=":-(" list={mind} />}
        </div>

        <div className="btn-row popup-foot">
          <button
            className="ui-btn nudge-detail__go"
            onClick={goNudges}
            aria-label="잔소리 화면으로 가기"
            title="잔소리"
          >
            <span className="nudge-detail__go-icon" aria-hidden="true">
              {PAGE_ICON["/nudges"]}
            </span>
            <span className="nudge-detail__go-arrow" aria-hidden="true">
              <svg
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 16h13M17 11l5 5-5 5" />
              </svg>
            </span>
          </button>
          <button className="ui-btn nudge-detail__close" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
