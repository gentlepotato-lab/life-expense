import { useEffect, useState } from "react";
import CalculatorPopup from "./CalculatorPopup";
import PenIcon from "./PenIcon";
import RefreshIcon from "./RefreshIcon";
import WriteEntryModal from "./WriteEntryModal";

/**
 * 어느 화면에서나 오른쪽 위에 떠 있는 단추 세 개 — 새로 고침 · 만년필(쓰기) · 계산기.
 *
 * 자리 · 생김새 · 여는 팝업이 화면마다 어긋나면 안 되므로 한자리에 모아 두고
 * 화면들은 이것만 부른다. 셋을 한 줄(flex)에 세워 사이 간격을 CSS 한 곳에서
 * 정한다 — 각자 오른쪽 끝에서 몇 픽셀인지 따로 세면 창 폭이 바뀔 때마다
 * 어긋난다.
 *
 * 적은 것이 그 화면 목록에 바로 드러나야 하면 onSaved 로 다시 읽으라고 알린다.
 */
export default function QuickActions({ onSaved }: { onSaved?: () => void }) {
  const [writeOpen, setWriteOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  /* 팝업이 떠 있는 동안 뒤 화면이 밀리지 않게 한다.
     열려 있을 때만 손을 대므로, 이 화면의 다른 팝업이 걸어 둔 것을
     지우고 나가는 일이 없다. */
  useEffect(() => {
    if (!writeOpen && !calculatorOpen) return;
    document.documentElement.classList.add("modal-open");
    return () => document.documentElement.classList.remove("modal-open");
  }, [writeOpen, calculatorOpen]);

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
        <button
          className="calculator-trigger-button write-trigger-button"
          onClick={() => setWriteOpen(true)}
          aria-label="새 지출 적기"
        >
          <PenIcon />
        </button>
        <button
          className="calculator-trigger-button"
          onClick={() => setCalculatorOpen(!calculatorOpen)}
          aria-label="Calculator"
        >
          계산기
        </button>
      </div>

      {writeOpen && (
        <WriteEntryModal onClose={() => setWriteOpen(false)} onSaved={onSaved} />
      )}
      {calculatorOpen && (
        <CalculatorPopup onClose={() => setCalculatorOpen(false)} />
      )}
    </>
  );
}
