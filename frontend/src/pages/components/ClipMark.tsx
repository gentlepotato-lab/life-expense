/**
 * 묶음을 가리키는 클립.
 *
 * 내역 카드에서는 왼쪽 위 접은 자국(포스트잇) 자리를 이것이 대신한다.
 * 묶여 있는 종이는 접어 두는 것이 아니라 집어 두는 것이라, 같은 자리에서
 * 생김새만 바뀐다. 빛깔은 금액이 쓰는 규칙을 그대로 따른다 —
 * 수입은 풀빛, 지출은 벽돌빛, 0원이거나 수입과 지출이 섞이면 0빛이다.
 *
 * 묶음 머리말과 묶음 팝업 제목 앞에도 같은 그림이 작게 선다. 어느 화면에서나
 * 클립 하나가 묶음을 뜻하도록.
 */
export default function ClipMark({ size, tone = "" }: { size?: number; tone?: string }) {
  return (
    <svg
      className={`clip-mark${tone}`}
      viewBox="0 0 22 34"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6.5 30.5V9.5a4.5 4.5 0 0 1 9 0V25.5a3.5 3.5 0 0 1-7 0V13.5" />
    </svg>
  );
}
