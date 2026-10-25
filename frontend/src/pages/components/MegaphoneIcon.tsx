/**
 * 확성기.
 *
 * 공지 딱지 안에 글자 앞으로 선다. 딱지가 11px이므로 그림도 거기에 맞춰
 * 작게 쓴다. 기본값 12px은 「공지」 두 글자와 키가 맞는다.
 *
 * 선 두께는 1.8이다. 앱의 다른 그림은 2를 쓰는데(EyeIcon 등) 저것들은
 * 18px로 서고 이것은 12px로 서서, 같은 두께면 이 크기에서 뭉개진다.
 *
 * 나팔은 왼쪽 위를 보고, 그 앞으로 소리 자국 둘이 퍼진다. 자국을 셋 넣어
 * 보았더니 12px 안에서 덩어리로 뭉쳐 아무 꼴도 아니었다.
 */
export default function MegaphoneIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* 나팔. 좁은 쪽이 오른쪽 아래, 벌어진 쪽이 왼쪽 위다. */}
      <path d="M4 10.5 17 5v14L4 13.5Z" />
      {/* 손잡이. 나팔 좁은 쪽에서 아래로 짧게 뻗는다. */}
      <path d="M7.5 14.5v3.5a1.5 1.5 0 0 0 3 0v-2.2" />
      {/* 퍼지는 소리 둘. */}
      <path d="M20 9.5a3.5 3.5 0 0 1 0 5" />
    </svg>
  );
}
