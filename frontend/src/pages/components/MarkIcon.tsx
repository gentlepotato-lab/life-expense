/**
 * 쪽지 끝에 찍히는 모양을 작게 그린다.
 *
 * 관리자 화면의 목록이 이름만 늘어놓아 어느 것이 무엇인지 눈에 안 들어왔다.
 * 「별」이라 적힌 줄보다 별이 하나 그려진 줄이 빠르다.
 *
 * 쪽지가 그리는 길(PenMark.tsx)을 가져오지 않는다. 그쪽은 줄과 끝 그림을
 * 한 길로 잇느라 좌표가 그 쪽지 폭에 매여 있어서, 떼어 오면 둘이 함께
 * 흔들린다. 여기서는 같은 모양을 같은 결로 새로 긋는다.
 *
 * 열쇠로 고른다. 이름으로 고르면 관리자가 이름을 바꾸는 날 그림이 사라진다.
 * 모르는 열쇠면 아무것도 그리지 않는다.
 *
 * 선 두께와 상자는 새로 고침과 눈과 같은 값이다(24 상자에 2).
 */

const 길들: Record<string, React.ReactNode> = {
  "mark-star": <path d="M12 3.5 14.6 9.2 20.8 10 16.3 14.3 17.5 20.5 12 17.5 6.5 20.5 7.7 14.3 3.2 10 9.4 9.2Z" />,
  "mark-circle": <circle cx="12" cy="12" r="8" />,
  "mark-square": <rect x="4.5" y="4.5" width="15" height="15" rx="2" />,
  "mark-tri": <path d="M12 4.5 20.5 19.5H3.5Z" />,
  "mark-diamond": <path d="M12 3.5 20.5 12 12 20.5 3.5 12Z" />,
  "mark-heart": <path d="M12 20.5C12 20.5 3.5 15.4 3.5 9.7 3.5 6.8 5.8 4.5 8.6 4.5c1.9 0 3 1 3.4 1.8.4-.8 1.5-1.8 3.4-1.8 2.8 0 5.1 2.3 5.1 5.2 0 5.7-8.5 10.8-8.5 10.8Z" />,
  "mark-moon": <path d="M16.8 4.8a8.5 8.5 0 1 0 2.6 11.8 7 7 0 0 1-2.6-11.8Z" />,
  "mark-tail": <path d="M5 18c3.4 0 5.2-2.2 5.2-4.6S8.6 9 7.2 9.9c-1.3.8-.9 3 .9 3.6 2.4.8 5-.8 5.6-3.3.6-2.5-.9-4.7-2.6-4.3" />,
};

export default function MarkIcon({ itemKey, size = 18 }: { itemKey: string; size?: number }) {
  const 길 = 길들[itemKey];
  if (!길) return null;
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
      {길}
    </svg>
  );
}
