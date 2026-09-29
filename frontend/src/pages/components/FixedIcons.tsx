/**
 * 고정과 변동을 말하는 그림 둘.
 *
 * 글자를 쓰지 않는 까닭은 이 기호가 내역 카드마다 하나씩 서기 때문이다.
 * `고정`·`변동` 네 글자가 줄마다 붙으면 분류 이름과 금액 사이에 덩어리가
 * 하나 더 생겨 카드가 빽빽해진다.
 *
 * 압정은 박아 둔 것, 물결은 출렁이는 것이다. 굵기와 마감은 앱의 다른 선 그림
 * (MenuIcons)과 같게 2px 둥근 끝이다.
 */
export function PinIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 4h6l-1 6 3 3H7l3-3z" fill="currentColor" stroke="none" />
      <path d="M12 13v7" />
    </svg>
  );
}

export function WaveIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 9c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
      <path d="M3 16c2-3 4-3 6 0s4 3 6 0 4-3 6 0" opacity={0.5} />
    </svg>
  );
}
