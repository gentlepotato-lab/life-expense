/**
 * 카드 실적 제외 단추 — 내역 카드의 결제 수단 왼쪽에 서는 기호 하나.
 *
 * 보는 것과 켜는 것이 한 몸이다. 기호가 곧 단추라 폼에 칸을 따로 만들지
 * 않는다. 원이 켜짐·꺼짐을 말하고, 그 안의 카드가 무엇에 대한 것인지를
 * 말한다 — 켜면 원이 짙게 차고 카드가 흰색으로 뒤집힌다.
 *
 * 결제 수단이 카드인 줄에만 선다. 현금 · 계좌이체에는 실적이라는 것이 없다.
 * 판단은 부르는 쪽이 하고(`카드`인지 아는 것은 그쪽이다), 이 부품은 그리기만
 * 한다.
 *
 * 카드의 꾹 누르기와 접은 자국 떼기가 이 단추를 삼키지 않도록
 * `data-no-longpress`를 달고 누름을 여기서 멈춘다.
 */
type Props = {
  on: boolean;
  /** 끄고 켜기. 꺼진 것을 누르면 true가 온다. */
  onToggle?: (next: boolean) => void;
  /** 보기만 하는 화면(기간 상세)에서는 누를 수 없다. */
  readOnly?: boolean;
};

export default function PerfExcludeButton({ on, onToggle, readOnly = false }: Props) {
  const title = on ? "카드 실적에서 뺀 건이다. 눌러서 되돌린다." : "카드 실적에서 뺀다.";

  return (
    <button
      type="button"
      className={`perf-x${on ? " on" : ""}`}
      data-no-longpress
      disabled={readOnly}
      title={readOnly ? (on ? "카드 실적에서 뺀 건" : undefined) : title}
      aria-pressed={on}
      aria-label="카드 실적에서 빼기"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (!readOnly) onToggle?.(!on);
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        {/* 켜면 원이 찬다. 끄면 테두리만 남는다. */}
        {on ? (
          <circle cx="12" cy="12" r="11" fill="currentColor" />
        ) : (
          <circle cx="12" cy="12" r="10.3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        )}
        {/* 원 안의 카드 — 켜면 흰색으로 뒤집힌다. */}
        <g stroke={on ? "#FFFFFF" : "currentColor"} fill="none">
          <rect x="5.8" y="8.5" width="12.4" height="8" rx="1.7" strokeWidth="1.4" />
          <path d="M5.8 11.1h12.4" strokeWidth="1.4" />
          <path d="M6.9 17.3 17.1 6.9" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      </svg>
    </button>
  );
}
