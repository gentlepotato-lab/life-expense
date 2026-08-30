/**
 * 계산기 — 표시창 하나에 자판, 오른쪽 아래는 길쭉한 [=] 하나.
 *
 * 새로 고침과 나란히 서므로 선 두께를 같게 맞췄다(24 상자에 2).
 * 자판은 둥근 끝을 가진 점으로 찍는다 — 18px에서는 네모로 그리면 뭉갠다.
 * 빛깔은 currentColor라 부르는 쪽 글자색을 따라간다.
 */
export default function CalculatorIcon({ size = 18 }: { size?: number }) {
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
      <rect x="4" y="2" width="16" height="20" rx="2.4" />
      <path d="M8 6.5h8" />
      <path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01" />
      <path d="M8 15.5h.01M12 15.5h.01" />
      <path d="M8 19h.01M12 19h.01" />
      <path d="M16 15.5v3.5" />
    </svg>
  );
}
