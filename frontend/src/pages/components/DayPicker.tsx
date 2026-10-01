import { useEffect, useRef, useState } from "react";
import useAnchoredPanel from "../../hooks/useAnchoredPanel";
import DayGrid from "./DayGrid";
import MonthGrid from "./MonthGrid";
import { dateLabel, todayStr, viewOf, ymOfView, type View } from "../../utils/day";

/**
 * 하루를 고르는 달력.
 *
 * 브라우저가 주는 날짜 칸(input[type=date])을 대신한다. 그 칸은 기기마다
 * 생김새가 달라 — 안드로이드 · 아이폰 · 윈도가 제가끔 다른 달력을 띄운다 —
 * 같은 앱 안에서 날짜 고르는 모습이 셋이 됐다. 여기서 쓰는 달력은 쓰기
 * 슬라이드의 것과 같은 것(DayGrid)이라, 주말 빛깔도 공휴일 빨강도 한 벌이다.
 *
 * 방아쇠와 판은 다른 고르개(SingleSelect · MonthPicker)의 것을 그대로 쓴다.
 * 한 줄에 나란히 서는 칸들이라 눌리기 전 모습이 다르면 줄이 어긋나 보인다.
 */
export default function DayPicker({
  value,
  onChange,
  placeholder = "(날짜)",
  /** 비울 수 있는 칸인가. 켜면 판 아래에 그 단추가 선다. */
  clearable = false,
  /**
   * 머리의 연월을 눌러 한 해를 펼칠 수 있게 한다.
   *
   * 기간을 거르는 자리에만 켠다. 지난해 영수증을 찾을 때 달을 열몇 번
   * 넘기는 대신 한 번에 건너뛴다. 적는 자리(쓰기 · 내역 편집)는 거의
   * 언제나 요 며칠이라 켜지 않는다 — 고르는 길이 둘이면 손이 멈칫한다.
   */
  monthJump = false,
}: {
  value: string;
  onChange: (ymd: string) => void;
  placeholder?: string;
  clearable?: boolean;
  monthJump?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const style = useAnchoredPanel(open, wrapRef, { minWidth: 272, maxHeight: 400 });

  const [view, setView] = useState<View>(() => viewOf(value));
  /** 지금 판에 펼친 것 — 날짜인가 달인가. */
  const [mode, setMode] = useState<"day" | "month">("day");

  /* 열 때마다 고른 날의 달로 되돌리고 날짜 쪽으로 펴 둔다. 지난번에 넘겨
     둔 달이 남아 있으면 엉뚱한 달이 펼쳐진다. */
  useEffect(() => {
    if (open) {
      setView(viewOf(value));
      setMode("day");
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

  const choose = (ymd: string) => {
    onChange(ymd);
    setOpen(false);
  };

  return (
    <div className="ms-wrap dp-wrap" ref={wrapRef}>
      <div className="ms-display" onClick={() => setOpen(!open)}>
        {value ? (
          <span className="ms-value">{dateLabel(value)}</span>
        ) : (
          <span className="ms-placeholder">{placeholder}</span>
        )}
      </div>

      {open && (
        <div className="ms-dropdown dp-panel" style={style}>
          {mode === "day" ? (
            <DayGrid
              compact
              value={value}
              view={view}
              onView={setView}
              onPick={choose}
              onHeadClick={monthJump ? () => setMode("month") : undefined}
            />
          ) : (
            /* 달을 고르면 값이 바뀌는 것이 아니라 그 달로 넘어간다 —
               여기서 고르려던 것은 어디까지나 하루다. */
            <MonthGrid
              year={view.y}
              onYear={(y) => setView({ ...view, y })}
              value={ymOfView(view)}
              onPick={(ym) => {
                setView({ y: Number(ym.slice(0, 4)), m: Number(ym.slice(4)) });
                setMode("day");
              }}
            />
          )}

          {/* 줄을 긋고 아래에 따로 둔다. 격자 안에 끼우면 날 가운데 하나처럼
              읽힌다. 연월 고르개의 비우기와 같은 자리, 같은 꼴이다. */}
          <div className="dp-foot">
            <button type="button" className="dp-foot__btn" onClick={() => choose(todayStr())}>
              오늘
            </button>
            {clearable && (
              <button
                type="button"
                className={`dp-foot__btn${value ? "" : " on"}`}
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                없음
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
