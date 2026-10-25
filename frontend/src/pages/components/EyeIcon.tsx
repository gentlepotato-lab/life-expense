/**
 * 눈. 적는 중인 비밀번호를 보이거나 감춘다.
 *
 * 새로 고침과 계산기와 같은 톤이다(24 상자에 선 두께 2). 빛깔은
 * currentColor라 부르는 쪽 글자색을 따라간다.
 *
 * off를 켜면 눈에 빗금이 그어진다. 지금 보이는 중이니 누르면 감춰진다는
 * 뜻이다. 두 모습이 같은 상자를 쓰므로 눌러도 자리가 흔들리지 않는다.
 */
export default function EyeIcon({ size = 18, off = false }: { size?: number; off?: boolean }) {
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
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}
