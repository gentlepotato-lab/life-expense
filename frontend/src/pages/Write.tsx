import { useEffect, useState } from "react";
import CalculatorPopup from "./components/CalculatorPopup";
import EntryForm from "./components/EntryForm";

export default function Write() {
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  // 계산기 팝업 열렸을 때 뒤 화면 스크롤/인터랙션 막기
  useEffect(() => {
    if (calculatorOpen) {
      document.documentElement.classList.add("modal-open");
    } else {
      document.documentElement.classList.remove("modal-open");
    }
  }, [calculatorOpen]);

  return (
    <div className="page-wrap">

      {/* 카드 스타일 폼 컨테이너.
          같은 칸 묶음을 지출 내역의 적기 팝업도 쓴다 — 한 자리에 두었다. */}
      <EntryForm />

      <button
        className="calculator-trigger-button"
        onClick={() => setCalculatorOpen(!calculatorOpen)}
        aria-label="Calculator"
      >
        계산기
      </button>
      {calculatorOpen && (
        <CalculatorPopup onClose={() => setCalculatorOpen(false)} />
      )}
    </div>
  );
}
