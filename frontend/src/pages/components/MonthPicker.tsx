import { useEffect, useRef, useState } from "react";
import useAnchoredPanel from "../../hooks/useAnchoredPanel";
import { ymLong } from "../../utils/schedule";

/**
 * 연월 하나를 고르는 작은 달력.
 *
 * 목록으로 늘어놓으면 서른 줄이 넘는다 — "2026년 1월부터"에서 "2028년
 * 12월부터"까지 한 줄씩 훑어야 골라진다. 달은 열두 개뿐이라 한 해를
 * 펼쳐 놓고 고르는 것이 짧다. 해는 위에서 ‹ › 로 넘긴다.
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

  const ymOf = (m: number) => `${year}${String(m).padStart(2, "0")}`;
  const blocked = (ym: string) => (!!min && ym < min) || (!!max && ym > max);

  /* 해를 넘길 수 있는지 — 그 해에 고를 수 있는 달이 하나라도 있어야 한다. */
  const yearHas = (y: number) => {
    const first = `${y}01`;
    const last = `${y}12`;
    return !((min && last < min) || (max && first > max));
  };

  return (
    <div className="ms-wrap mp-wrap" ref={wrapRef}>
      <div className="ms-display" onClick={() => setOpen(!open)}>
        {value ? (
          <span className="ms-value">{ymLong(value) + suffix}</span>
        ) : (
          <span className="ms-placeholder">{placeholder}</span>
        )}
      </div>

      {open && (
        <div className="ms-dropdown mp-panel" style={style}>
          <div className="mp-head">
            <button
              type="button"
              className="mp-nav"
              aria-label="지난 해"
              disabled={!yearHas(year - 1)}
              onClick={() => setYear((y) => y - 1)}
            >
              ‹
            </button>
            <span className="mp-year">{year}년</span>
            <button
              type="button"
              className="mp-nav"
              aria-label="다음 해"
              disabled={!yearHas(year + 1)}
              onClick={() => setYear((y) => y + 1)}
            >
              ›
            </button>
          </div>

          <div className="mp-grid">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const ym = ymOf(m);
              return (
                <button
                  key={m}
                  type="button"
                  className={`mp-cell${ym === value ? " on" : ""}`}
                  disabled={blocked(ym)}
                  onClick={() => {
                    onChange(ym);
                    setOpen(false);
                  }}
                >
                  {m}월
                </button>
              );
            })}
          </div>

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
