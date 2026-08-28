/**
 * 고르는 목록을 친 글자로 즐인다.
 *
 * 목록이 길면 눈으로 훑는 것보다 몇 글자 치는 편이 빠르다.
 * 그렇다고 다섯 개밖에 없는 목록(IN/OUT · 갈래 같은)에까지 찾기 칸을 얹으면
 * 별 일 아닌 것이 자리만 차지한다. 길 때만 내준다.
 */
export const FIND_FROM = 6;

/** 친 글자가 든 것만. 대소문자는 가리지 않는다 */
export function narrowOptions<T extends { label: string }>(list: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    /* "[+] 새로 등록" 같은 더하기 줄은 남긴다 — 찾는 것이 없어서
       새로 적으려는 참이 대부분이다 */
    (o) => o.label.startsWith("[+]") || o.label.toLowerCase().includes(q)
  );
}

/**
 * 찾는 것이 없을 때 보여 줄 한 줄.
 *
 * 고르는 것이 무엇이냐에 따라 말이 달라진다 — 분류면 분류, 사람이면 사람.
 * 조사는 마지막 글자의 받침을 보고 고른다(분류가 · 사람이).
 */
export function nothingFound(noun: string): string {
  const last = noun.trim().slice(-1);
  const code = last.charCodeAt(0);
  const hangul = code >= 0xac00 && code <= 0xd7a3;
  const batchim = hangul && (code - 0xac00) % 28 !== 0;
  return `찾는 ${noun}${batchim ? "이" : "가"} 없습니다.`;
}
