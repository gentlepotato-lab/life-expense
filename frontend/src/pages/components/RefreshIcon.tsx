/**
 * 새로 고침 — 한 바퀴 도는 화살표.
 *
 * 만년필 · 계산기와 나란히 서므로 톤을 맞춘다. 선 두께는 계산기와 같은
 * 값이다(24 상자에 2 → 18px 에서 1.5px).
 * 빛깔은 currentColor 라 부르는 쪽 글자색을 따라간다.
 */
export default function RefreshIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}
