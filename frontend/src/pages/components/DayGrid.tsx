import { useEffect, useState } from "react";
import axios from "../../api/client";
import { todayStr, ymOfView, type View } from "../../utils/day";

/**
 * 한 달치 날짜 칸.
 *
 * 쓰기 슬라이드의 1단계와 날짜 고르개(DayPicker)가 함께 쓴다. 두 벌로 적어
 * 두면 주말 빛깔이나 공휴일 처리를 한쪽만 고치게 되고, 그러면 같은 앱 안에서
 * 어떤 달력은 개천절이 붉고 어떤 달력은 검게 된다.
 *
 * 앞뒤 달의 날은 자리만 채우고 누를 수 없다 — 누르면 달이 바뀌어 지금 보는
 * 달과 고른 날이 어긋난다. 달을 넘기는 손잡이는 달력 · 씀씀이와 같은
 * 모양(.month-nav__arrow)을 쓴다.
 *
 * 보고 있는 달은 밖에서 쥔다. 고르개에서는 머리를 눌러 연월을 건너뛸 수
 * 있어야 하는데, 그러려면 그쪽이 달을 갈아 끼울 수 있어야 한다.
 */

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 공휴일은 한 달에 한 번만 받아 온다.
 *
 * 고르개는 열고 닫을 때마다 새로 붙으므로, 두지 않으면 같은 달을 몇 번이고
 * 다시 묻게 된다. 한 번 지난 달의 휴일은 그 자리에서 바뀌지 않는다.
 */
const 휴일곳간 = new Map<string, Record<string, string>>();

function DayGrid({
  value,
  view,
  onView,
  onPick,
  /** 머리의 연월을 누를 수 있게 한다. 주면 연월 고르기로 건너뛴다. */
  onHeadClick,
  /** 떠 있는 판에 들어갈 때. 칸 키를 못 박고 바깥 테를 걷는다. */
  compact = false,
}: {
  value: string;
  view: View;
  onView: (v: View) => void;
  onPick: (ymd: string) => void;
  onHeadClick?: () => void;
  compact?: boolean;
}) {
  const first = new Date(view.y, view.m - 1, 1);
  const days = new Date(view.y, view.m, 0).getDate();
  const lead = first.getDay();

  const shift = (step: number) => {
    const t = view.y * 12 + (view.m - 1) + step;
    onView({ y: Math.floor(t / 12), m: (t % 12) + 1 });
  };

  const ymd = (d: number) =>
    `${view.y}-${String(view.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const today = todayStr();

  /* 공휴일 — 'YYYY-MM-DD' → 이름.
     휴일 표에는 주말도 is_holiday = 1로 들어 있지만, 주말은 요일로 이미
     갈라 칠하므로 이름이 붙은 날(개천절 · 대체공휴일 따위)만 쓴다. */
  const 열쇠 = ymOfView(view);
  const [holidays, setHolidays] = useState<Record<string, string>>(
    () => 휴일곳간.get(열쇠) ?? {}
  );
  useEffect(() => {
    const 있던것 = 휴일곳간.get(열쇠);
    if (있던것) {
      setHolidays(있던것);
      return;
    }
    let 살아있나 = true;
    axios
      .get("/holidays", { params: { year: view.y, month: view.m } })
      .then((r) => {
        const map: Record<string, string> = {};
        for (const h of r.data as { dt: string; holiday_name: string | null }[]) {
          if (h.holiday_name) map[h.dt] = h.holiday_name;
        }
        휴일곳간.set(열쇠, map);
        if (살아있나) setHolidays(map);
      })
      .catch(() => {
        if (살아있나) setHolidays({});
      });
    return () => {
      살아있나 = false;
    };
  }, [열쇠, view.y, view.m]);

  return (
    <div className={`daygrid${compact ? " daygrid--compact" : ""}`}>
      <div className="daygrid__head">
        <button
          type="button"
          className="month-nav__arrow"
          aria-label="지난달"
          onClick={() => shift(-1)}
        >
          ‹
        </button>
        {/* 머리를 누를 수 있을 때만 단추로 둔다. 누를 수 없는 글자를 단추
            모양으로 두면 눌러 보게 된다. */}
        {onHeadClick ? (
          <button type="button" className="daygrid__label daygrid__label--btn" onClick={onHeadClick}>
            {view.y}년 {view.m}월
          </button>
        ) : (
          <span className="daygrid__label">
            {view.y}년 {view.m}월
          </span>
        )}
        <button
          type="button"
          className="month-nav__arrow"
          aria-label="다음 달"
          onClick={() => shift(1)}
        >
          ›
        </button>
      </div>

      <div className="daygrid__grid">
        {/* 일요일은 붉게, 토요일은 강조색으로 — 달력 화면이 쓰는 잣대 그대로다. */}
        {WEEKDAYS.map((w, i) => (
          <span key={w} className={`daygrid__wd${i === 0 ? " sun" : i === 6 ? " sat" : ""}`}>
            {w}
          </span>
        ))}
        {/* 요일과 날짜를 가르는 한 줄. 칸마다 테두리를 주면 사이가 벌어져
            일곱 토막으로 끊긴다. 줄을 통째로 쓰는 칸 하나로 긋는다. */}
        <span className="daygrid__rule" />
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} className="daygrid__pad" />
        ))}
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
          const dow = (lead + d - 1) % 7;
          const 쉬는날 = holidays[ymd(d)];
          /* 고른 날과 오늘은 다른 표다 — 고른 날은 꽉 차고, 오늘은 테를 두른다.
             둘이 같은 날이면 꽉 찬 쪽이 이긴다.
             공휴일은 토요일이어도 붉게 — 쉬는 날이라는 것이 요일보다 앞선다. */
          return (
            <button
              key={d}
              type="button"
              title={쉬는날 || undefined}
              className={
                "daygrid__day" +
                (ymd(d) === value ? " on" : "") +
                (ymd(d) === today ? " today" : "") +
                (쉬는날 ? " sun" : dow === 0 ? " sun" : dow === 6 ? " sat" : "")
              }
              onClick={() => onPick(ymd(d))}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default DayGrid;
