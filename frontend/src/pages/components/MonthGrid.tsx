/**
 * 한 해치 열두 달 칸.
 *
 * 연월 고르개(MonthPicker)와 날짜 고르개(DayPicker)의 연월 건너뛰기가 함께
 * 쓴다. 두 벌로 적어 두면 이번 달 테나 가둘 수 있는 앞뒤 끝을 한쪽만 고치게
 * 된다.
 *
 * 목록으로 늘어놓으면 서른 줄이 넘는다. 달은 열두 개뿐이라 한 해를 펼쳐 놓고
 * 고르는 것이 짧다. 해는 위에서 ‹ › 로 넘긴다.
 */
export default function MonthGrid({
  year,
  onYear,
  value,
  onPick,
  /** 고를 수 있는 맨 앞 · 맨 뒤 연월 'YYYYMM'. 없으면 가두지 않는다. */
  min,
  max,
}: {
  year: number;
  onYear: (y: number) => void;
  value?: string | null;
  onPick: (ym: string) => void;
  min?: string;
  max?: string;
}) {
  const ymOf = (m: number) => `${year}${String(m).padStart(2, "0")}`;
  const blocked = (ym: string) => (!!min && ym < min) || (!!max && ym > max);

  /* 해를 넘길 수 있는지 — 그 해에 고를 수 있는 달이 하나라도 있어야 한다. */
  const yearHas = (y: number) => {
    const first = `${y}01`;
    const last = `${y}12`;
    return !((min && last < min) || (max && first > max));
  };

  /* 이번 달. 고른 것과 따로 테를 둘러 지금이 어디인지 알린다. */
  const nowYm = (() => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  return (
    <>
      <div className="mp-head">
        <button
          type="button"
          className="month-nav__arrow"
          aria-label="지난 해"
          disabled={!yearHas(year - 1)}
          onClick={() => onYear(year - 1)}
        >
          ‹
        </button>
        <span className="mp-year">{year}년</span>
        <button
          type="button"
          className="month-nav__arrow"
          aria-label="다음 해"
          disabled={!yearHas(year + 1)}
          onClick={() => onYear(year + 1)}
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
              className={
                "mp-cell" + (ym === value ? " on" : "") + (ym === nowYm ? " now" : "")
              }
              disabled={blocked(ym)}
              onClick={() => onPick(ym)}
            >
              {m}월
            </button>
          );
        })}
      </div>
    </>
  );
}
