import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useAnchoredPanel from "../../hooks/useAnchoredPanel";
import MonthGrid from "./MonthGrid";
import { 옮긴달 } from "../../hooks/useMonthSpan";

/**
 * 달을 넘기는 막대.
 *
 * 지출 내역 · 묶은 내역 · 씀씀이 · 안쓴이 도전이 같은 것을 쓴다. 네 군데에
 * 같은 모양을 따로 적어 두었더니 넘길 수 있는 끝이 화면마다 달라졌다.
 *
 * 연월 글씨를 누르면 열두 칸 달력이 펼쳐진다 — 한 해 전으로 가려고 ‹ 를
 * 열두 번 누르게 하지 않는다. 달력은 연월 고르개(MonthPicker)와 같은 격자를
 * 쓴다.
 *
 * 달력만 body에 띄운다. 이 막대가 선 자리(.toolbar-wrap.is-pinned)는
 * will-change로 제 쌓임 맥락과 fixed 기준을 함께 만들어, 그 안에 두면 달력이
 * 뒤쪽 줄(.cal-sources)에 덮이고 자리까지 밀린다.
 */
export default function MonthNav({
  ym,
  onChange,
  /** 넘겨 볼 수 있는 맨 앞 · 맨 뒤 연월 'YYYY-MM'. 없으면 가두지 않는다. */
  min,
  max,
  /** 고치는 중처럼 달을 옮겨서는 안 되는 때 — 화살표도 달력도 잠근다. */
  disabled = false,
  className = "",
}: {
  ym: string;
  onChange: (ym: string) => void;
  min?: string | null;
  max?: string | null;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  /* 판은 연월 글씨 바로 아래에 붙인다 — 막대 왼쪽 끝(‹)에 맞추면 누른 자리와
     뜨는 자리가 어긋난다. */
  const labelRef = useRef<HTMLDivElement | null>(null);
  const style = useAnchoredPanel(open, labelRef, { minWidth: 232, maxHeight: 300 });

  /* 격자는 'YYYYMM'을 쓴다. 화면들이 들고 다니는 꼴은 'YYYY-MM'이다. */
  const 짧게 = (v: string | null | undefined) => (v ? v.replace("-", "") : undefined);

  const [year, setYear] = useState(() => Number(ym.slice(0, 4)));

  /* 열 때마다 보고 있는 달의 해로 되돌린다 — 지난번에 넘겨 둔 해가 남아 있으면
     엉뚱한 해가 펼쳐진다. */
  useEffect(() => {
    if (open) setYear(Number(ym.slice(0, 4)));
  }, [open, ym]);

  useEffect(() => {
    if (!open) return;
    /* 달력이 막대 밖(body)에 있으므로 두 군데를 모두 안쪽으로 친다 —
       한쪽만 보면 달을 누르는 순간 닫혀 그 누름이 허공에 떨어진다. */
    const outside = (e: Event) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("touchstart", outside);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("touchstart", outside);
    };
  }, [open]);

  const 앞 = 옮긴달(ym, -1);
  const 뒤 = 옮긴달(ym, 1);
  const 앞막힘 = disabled || (!!min && 앞 < min);
  const 뒤막힘 = disabled || (!!max && 뒤 > max);

  return (
    <div className={`month-nav${className ? ` ${className}` : ""}`} ref={wrapRef}>
      <button
        type="button"
        className="month-nav__arrow"
        aria-label="지난달"
        disabled={앞막힘}
        onClick={() => onChange(앞)}
      >
        ‹
      </button>

      {/* button이 아니라 div인 것은 전역 button 규칙(높이 등)이 걸려 글씨
          자리가 달라지기 때문이다. 대신 역할과 키 조작을 손으로 붙인다. */}
      <div
        ref={labelRef}
        className={`month-nav__label${disabled ? " readonly" : ""}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && setOpen(!open)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          } else if (e.key === "Escape" && open) {
            setOpen(false);
          }
        }}
      >
        {Number(ym.slice(0, 4))}년 {Number(ym.slice(5, 7))}월
      </div>

      <button
        type="button"
        className="month-nav__arrow"
        aria-label="다음 달"
        disabled={뒤막힘}
        onClick={() => onChange(뒤)}
      >
        ›
      </button>

      {open &&
        !disabled &&
        createPortal(
          <div ref={panelRef} className="ms-dropdown mp-panel" style={style}>
            <MonthGrid
              year={year}
              onYear={setYear}
              value={짧게(ym)}
              min={짧게(min)}
              max={짧게(max)}
              onPick={(v) => {
                onChange(`${v.slice(0, 4)}-${v.slice(4)}`);
                setOpen(false);
              }}
            />
          </div>,
          document.body
        )}
    </div>
  );
}
