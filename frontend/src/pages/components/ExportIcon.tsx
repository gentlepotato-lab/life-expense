/**
 * 내보내기 — 종이 한 장과 내려가는 화살표.
 *
 * 맨 위로(ArrowUpIcon)와 한 식구라 값을 맞춘다. 24 상자에 선 두께 2,
 * 끝은 둥글게. 빛깔은 currentColor라 부르는 쪽 글자색을 따라간다.
 */
export default function ExportIcon({ size = 24 }: { size?: number }) {
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
      {/* 종이 한 장 — 오른쪽 위 귀퉁이를 접었다. */}
      <path d="M14 3H7a2 2 0 0 0-2 2v6" />
      <path d="M14 3l5 5v3" />
      <path d="M14 3v5h5" />
      {/* 아래로 내려가는 화살표 — 받는다는 뜻이다. */}
      <path d="M12 14v6" />
      <path d="M8.5 16.5 12 20l3.5-3.5" />
    </svg>
  );
}
