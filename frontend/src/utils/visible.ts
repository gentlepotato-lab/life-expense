/**
 * 고르는 목록에서 "감춘" 항목을 뺀다.
 *
 * 목록 자체는 감춘 것까지 다 받아 둔다. 지난 내역이 그 분류를 가리키고
 * 있어서, 이름을 찾으려면 목록에 남아 있어야 하기 때문이다.
 * 빼는 일은 "새로 고를 때" 만 한다.
 *
 * 이미 그 항목을 쓰고 있던 내역을 편집하는 경우에는 예외를 둔다.
 * 그러지 않으면 드롭다운이 빈칸으로 보여, 손대지 않았는데도 값이
 * 지워진 것처럼 읽힌다.
 */
export function visible<T extends { is_active?: number | null }>(
  list: T[],
  keep?: (item: T) => boolean
): T[] {
  return list.filter((x) => x.is_active !== 0 || (keep ? keep(x) : false));
}
