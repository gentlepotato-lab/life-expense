/**
 * 맨 위로 — 위를 가리키는 화살표.
 *
 * 새로 고침 · 만년필 · 계산기 · 종과 한 식구라 톤을 맞춘다. 24 상자에 선
 * 두께 2(18px에서 1.5px), 끝은 둥글게 — 그 넷과 같은 값이다.
 * 빛깔은 currentColor라 부르는 쪽 글자색을 따라간다.
 */
export default function ArrowUpIcon({ size = 18 }: { size?: number }) {
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
      <path d="M12 19V6" />
      <path d="M5.5 12.5 12 6l6.5 6.5" />
    </svg>
  );
}
