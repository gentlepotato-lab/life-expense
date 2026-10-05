import { useEffect, useRef, useState } from "react";
import useAnchoredPanel from "../../hooks/useAnchoredPanel";
import { ymLong } from "../../utils/schedule";
import MonthGrid from "./MonthGrid";

/**
 * 연월 하나를 고르는 작은 달력.
 *
 * 열두 칸 격자는 날짜 고르개와 나눠 쓰는 것(MonthGrid)이다. 여기서는 그것을
 * 떠 있는 판에 얹고, 비우는 단추만 아래에 붙인다.
 *
 * 방아쇠는 다른 고르개(SingleSelect)의 것을 그대로 쓴다. 한 줄에 나란히
 * 서는 칸들이라 눌리기 전 모습이 다르면 줄이 어긋나 보인다.
 */
export default function MonthPicker({
  value,
  onChange,
  /** 고를 수 있는 맨 앞 · 맨 뒤 연월 'YYYYMM'. 없으면 가두지 않는다. */
  min,
  max,
  /** 고른 값 뒤에 붙는 말 — "부터", "까지". */
  suffix = "",
  placeholder = "(연월)",
  /** 비울 수 있는 칸인가. 켜면 판 아래에 그 단추가 선다. */
  clearable = false,
  clearLabel = "없음",
}: {
  value: string | null | undefined;
  onChange: (ym: string) => void;
  min?: string;
  max?: string;
  suffix?: string;
  placeholder?: string;
  clearable?: boolean;
  clearLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const style = useAnchoredPanel(open, wrapRef, { minWidth: 232, maxHeight: 300 });

  /* 펼쳐 보는 해. 고른 값이 있으면 그 해에서 시작한다. */
  const [year, setYear] = useState(() =>
    value ? Number(value.slice(0, 4)) : new Date().getFullYear()
  );

  /* 열 때마다 고른 값의 해로 되돌린다 — 지난번에 넘겨 둔 해가 남아 있으면
     엉뚱한 해가 펼쳐진다. */
  useEffect(() => {
    if (open) {
      setYear(value ? Number(value.slice(0, 4)) : new Date().getFullYear());
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("touchstart", outside);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("touchstart", outside);
    };
  }, [open]);

  return (
    <div className="ms-wrap mp-wrap" ref={wrapRef}>
      {/* button이 아니라 div인 것은 전역 button 규칙(min-height 등)이 걸려
          모양이 달라지기 때문이다. 대신 역할과 키 조작을 손으로 붙인다. */}
      <div
        className="ms-display"
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          } else if (e.key === "Escape" && open) {
            setOpen(false);
          }
        }}
      >
        {value ? (
          <span className="ms-value">{ymLong(value) + suffix}</span>
        ) : (
          <span className="ms-placeholder">{placeholder}</span>
        )}
      </div>

      {open && (
        <div className="ms-dropdown mp-panel" style={style}>
          <MonthGrid
            year={year}
            onYear={setYear}
            value={value}
            min={min}
            max={max}
            onPick={(ym) => {
              onChange(ym);
              setOpen(false);
            }}
          />

          {/* 비우기 — 골랐던 것을 물리는 자리다. 격자 안에 끼우면 열두 달
              가운데 하나처럼 읽히므로 줄을 그어 아래에 따로 둔다. */}
          {clearable && (
            <button
              type="button"
              className={`mp-clear${value ? "" : " on"}`}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {clearLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
