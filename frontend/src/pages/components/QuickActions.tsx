import { useEffect, useState } from "react";
import BellIcon from "./BellIcon";
import CalculatorIcon from "./CalculatorIcon";
import CalculatorPopup from "./CalculatorPopup";
import NudgePopup from "./NudgePopup";
import PendingDeckPopup from "./PendingDeckPopup";
import PenIcon from "./PenIcon";
import RefreshIcon from "./RefreshIcon";
import ScrollTopButton from "./ScrollTopButton";
import SlideIcon from "./SlideIcon";
import WriteEntryModal from "./WriteEntryModal";
import WriteSlideModal from "./WriteSlideModal";
import useNudges, { invalidateNudges } from "../../hooks/useNudges";
import usePending, { invalidatePending } from "../../hooks/usePending";
import { PAGE_ICON } from "./MenuIcons";
import { closeOverlays } from "../../hooks/useBackClose";
import { prefOn } from "../../utils/prefs";

/**
 * 어느 화면에서나 오른쪽 위에 떠 있는 단추 넷 —
 * 새로 고침 · 만년필(쓰기) · 계산기 · 종(잔소리).
 *
 * 자리 · 생김새 · 여는 팝업이 화면마다 어긋나면 안 되므로 한자리에 모아 두고
 * 화면들은 이것만 부른다. 넷을 한 줄(flex)에 세워 사이 간격을 CSS 한 곳에서
 * 정한다 — 각자 오른쪽 끝에서 몇 픽셀인지 따로 세면 창 폭이 바뀔 때마다.
 * 어긋난다.
 *
 * 적은 것이 그 화면 목록에 바로 드러나야 하면 onSaved로 다시 읽으라고 알린다.
 */
export default function QuickActions({ onSaved }: { onSaved?: () => void }) {
  const [writeOpen, setWriteOpen] = useState(false);
  /* 쓰기 슬라이드(beta) — 시범으로 붙인 또 하나의 쓰기다. */
  const [slideOpen, setSlideOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  /* 대기 내역을 한 장씩 넘겨 보는 팝업 — 계산기와 잔소리 사이에 선다. */
  const [deckOpen, setDeckOpen] = useState(false);

  /* 한 건 적고 나면 잔소리도 달라진다 — 그때만 다시 센다. */
  const [nudgeKey, setNudgeKey] = useState(0);
  const { nudges, ready } = useNudges({ reloadKey: nudgeKey });

  /* 배지는 잔소리 전체를 센다. "챙길 것"만 세면 화면에 넉 줄이 떠 있는데
     배지에는 둘이라 적혀 서로 어긋나 보인다 — 종을 눌러 볼 것이 몇 가지인지가
     배지가 답해야 할 물음이다. */
  const mind = prefOn("nudge_on") ? nudges.length : 0;

  /* 모래시계 배지에 적을 수. 팝업이 넘겨 볼 장과 같은 줄에서 나온다 —
     따로 세면 배지에는 5라 적혀 있는데 열면 넉 장인 일이 생긴다. */
  const [pendKey, setPendKey] = useState(0);
  const { rows: pendRows, ready: pendReady } = usePending(pendKey);

  /**
   * 한 번에 하나만 띄운다.
   *
   * 네 단추가 팝업 위에도 떠 있으므로, 팝업이 열린 채로 다른 단추를 누르는
   * 일이 생긴다. 그때 둘이 겹쳐 뜨면 뒤로 가기 차례도 눈에 보이는 것도
   * 엉킨다. 열려 있던 것은 무엇이든 — 이 화면이 연 것까지 — 먼저 닫는다.
   *
   * 같은 단추를 다시 누르면 닫기만 한다. 계산기가 원래 그랬다.
   */
  const only = (which: "write" | "slide" | "calc" | "deck" | "nudge") => {
    const already =
      (which === "write" && writeOpen) ||
      (which === "slide" && slideOpen) ||
      (which === "calc" && calculatorOpen) ||
      (which === "deck" && deckOpen) ||
      (which === "nudge" && nudgeOpen);
    void closeOverlays().then(() => {
      setWriteOpen(!already && which === "write");
      setSlideOpen(!already && which === "slide");
      setCalculatorOpen(!already && which === "calc");
      setDeckOpen(!already && which === "deck");
      setNudgeOpen(!already && which === "nudge");
    });
  };

  /* 팝업이 떠 있는 동안 뒤 화면이 밀리지 않게 한다.
     열려 있을 때만 손을 대므로, 이 화면의 다른 팝업이 걸어 둔 것을
     지우고 나가는 일이 없다. */
  useEffect(() => {
    if (!writeOpen && !slideOpen && !calculatorOpen && !deckOpen && !nudgeOpen) return;
    document.documentElement.classList.add("modal-open");
    return () => document.documentElement.classList.remove("modal-open");
  }, [writeOpen, slideOpen, calculatorOpen, deckOpen, nudgeOpen]);

  return (
    <>
      <div className="quick-actions">
        <button
          className="calculator-trigger-button refresh-trigger-button"
          onClick={() => window.location.reload()}
          aria-label="새로 고침"
        >
          <RefreshIcon />
        </button>
        {/* 쓰기 슬라이드(beta) — 쓰기 바로 왼쪽이다. 같은 일을 다른 길로
            하는 단추라 나란히 서야 그 관계가 보인다. */}
        <button
          className="calculator-trigger-button slide-trigger-button"
          onClick={() => only("slide")}
          aria-label="쓰기(beta)"
        >
          <SlideIcon />
          <span className="beta-badge">beta</span>
        </button>
        <button
          className="calculator-trigger-button write-trigger-button"
          onClick={() => only("write")}
          aria-label="새 지출 적기"
        >
          <PenIcon />
        </button>
        <button
          className="calculator-trigger-button"
          onClick={() => only("calc")}
          aria-label="Calculator"
        >
          <CalculatorIcon />
        </button>
        {/* 대기 내역 — 내역 탭의 그 모래시계를 그대로 쓴다. 다른 기호를
            새로 그리면 같은 것을 가리키는 그림이 둘이 된다. */}
        <button
          className="calculator-trigger-button pend-trigger-button"
          onClick={() => only("deck")}
          aria-label="대기 내역"
        >
          <span className="pend-trigger-button__icon" aria-hidden="true">
            {PAGE_ICON["/pending-entries"]}
          </span>
          {pendReady && pendRows.length > 0 && (
            <span className="pend-badge">{pendRows.length > 9 ? "9+" : pendRows.length}</span>
          )}
        </button>
        <button
          className="calculator-trigger-button nudge-trigger-button"
          onClick={() => only("nudge")}
          aria-label="잔소리"
        >
          <BellIcon />
          {ready && mind > 0 && (
            <span className="nudge-badge">{mind > 9 ? "9+" : mind}</span>
          )}
        </button>
      </div>

      <ScrollTopButton />

      {writeOpen && (
        <WriteEntryModal
          onClose={() => setWriteOpen(false)}
          onSaved={() => {
            invalidateNudges();
            setNudgeKey((k) => k + 1);
            invalidatePending();
            setPendKey((k) => k + 1);
            onSaved?.();
          }}
        />
      )}
      {slideOpen && (
        <WriteSlideModal
          onClose={() => setSlideOpen(false)}
          onSaved={() => {
            invalidateNudges();
            setNudgeKey((k) => k + 1);
            invalidatePending();
            setPendKey((k) => k + 1);
            onSaved?.();
          }}
        />
      )}
      {calculatorOpen && (
        <CalculatorPopup onClose={() => setCalculatorOpen(false)} />
      )}
      {deckOpen && <PendingDeckPopup onClose={() => setDeckOpen(false)} />}
      {nudgeOpen && (
        <NudgePopup nudges={nudges} ready={ready} onClose={() => setNudgeOpen(false)} />
      )}
    </>
  );
}
