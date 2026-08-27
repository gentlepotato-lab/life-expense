/**
 * 금액을 짧게 적는 법.
 *
 * 화면 파일에서 컴포넌트 말고 다른 것을 내보내면 Fast Refresh 가 깨지므로
 * 여러 자리가 함께 쓰는 셈은 여기 둔다.
 */

/**
 * 400000 → "40만 원"
 *
 * 카드 실적 구간처럼 만 원 단위로 끊어 적는 금액에 쓴다. 자리를 다 적으면
 * (400,000원) 줄이 길어지고, 구간끼리 견주기도 어렵다.
 * 만 원이 안 되는 값은 그대로 적고, 딱 떨어지지 않으면 소수 한 자리까지만 남긴다.
 */
export function manwon(v: number | string): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "0원";
  if (Math.abs(n) < 10000) return `${n.toLocaleString("ko-KR")}원`;
  const man = n / 10000;
  return `${Number(Number.isInteger(man) ? man : man.toFixed(1)).toLocaleString("ko-KR")}만 원`;
}
