/**
 * 종 — 잔소리를 부르는 단추의 그림.
 *
 * 홈의 잔소리 그림(HomeArt 의 ArtNudge)과 같은 종이다. 위에 꼭지가 있고,
 * 아래로 벌어진 자락이 테두리에서 딱 끊긴 뒤 추가 달린다.
 * 옆에 선 새로 고침 · 계산기와 선 두께를 맞췄다(24 상자에 2).
 * 빛깔은 currentColor 라 부르는 쪽 글자색을 따라간다.
 */
export default function BellIcon({ size = 18 }: { size?: number }) {
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
      {/* 꼭지 */}
      <path d="M12 2.2v2" />
      {/* 몸통 */}
      <path d="M18.4 10.6c0-3.5-2.9-6.4-6.4-6.4s-6.4 2.9-6.4 6.4c0 4.4-1.6 6.4-2.8 7.6h18.4c-1.2-1.2-2.8-3.2-2.8-7.6Z" />
      {/* 추 — 종이 울린다 */}
      <path d="M14.1 20.6a2.2 2.2 0 0 1-4.2 0" />
    </svg>
  );
}
