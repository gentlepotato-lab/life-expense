/**
 * 담기. 줄 세 가닥에 열십자.
 *
 * 열십자 하나만 두면 "무언가 더한다"에서 멈춘다. 이 단추가 하는 일은 그
 * 화면의 목록에 한 줄을 더하는 것이라, 줄을 함께 그려 무엇에 더하는지까지
 * 보이게 한다.
 *
 * 내보내기(ExportIcon)는 종이 한 장을 밑그림으로 쓴다. 둘이 한 기둥에 나란히
 * 서는 화면(정기 내역)이 있어 밑그림을 일부러 다르게 뒀다. 종이 둘이 나란히
 * 서면 한눈에 갈리지 않는다.
 *
 * 맨 위로와 내보내기와 한 식구라 값은 맞춘다. 24 상자에 선 두께 2, 끝은 둥글게.
 * 빛깔은 currentColor라 부르는 쪽 글자색을 따라간다.
 */
export default function AddIcon({ size = 24 }: { size?: number }) {
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
      {/* 줄 세 가닥. 목록이다. 아래로 갈수록 짧아 글줄처럼 읽힌다. */}
      <path d="M4 6h10" />
      <path d="M4 12h7" />
      <path d="M4 18h5" />
      {/* 열십자. 거기에 한 줄을 더한다. */}
      <path d="M17 13v6" />
      <path d="M14 16h6" />
    </svg>
  );
}
