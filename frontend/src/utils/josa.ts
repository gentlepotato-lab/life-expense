/**
 * 앞말의 받침을 보고 조사를 고른다.
 *
 * "씀씀이을 내려받았습니다"처럼 어긋나면 눈에 바로 걸린다. 화면 이름이
 * 그때그때 끼워지는 자리에서는 손으로 적을 수가 없다.
 *
 * narrowOptions의 nothingFound도 같은 셈을 하지만 그쪽은 "이/가"만 쓰고
 * 한글이 아닐 때 "가"로 떨어진다. 여기는 어느 짝이든 받을 수 있게 열고,
 * 한글이 아니면 받침이 있는 쪽으로 본다 — 숫자와 영문은 읽는 소리가
 * 제각각이라 어느 쪽도 늘 맞지는 않는다.
 */
export function 조사(말: string, 받침: string, 민낯: string): string {
  const ch = (말 ?? "").trim().slice(-1);
  if (!ch) return 민낯;
  const code = ch.charCodeAt(0);
  const 한글 = code >= 0xac00 && code <= 0xd7a3;
  if (!한글) return 받침;
  return (code - 0xac00) % 28 !== 0 ? 받침 : 민낯;
}
