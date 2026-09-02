/**
 * 마스킹 테이프 일곱 가지.
 *
 * 금액을 가리는 테이프는 그동안 자리마다 달랐다 — 내역은 꽃, 잔소리는
 * 땡땡이, 달력과 씀씀이는 사선이었다. 골라 쓰는 것으로 바꾸면서 한 벌로
 * 모은다. 문구점에서 테이프를 한 롤 사면 여기저기 같은 것을 붙이지, 서랍마다
 * 다른 것을 쓰지는 않는다.
 *
 * 그림은 모두 60×30에 같은 물결 몸통이라 무엇을 골라도 뜯긴 자리가 같다.
 * 바꿔 붙이는 일은 CSS 변수 하나(--tape-img)로 한다 — 테이프를 쓰는 자리가
 * 열 곳이 넘어서, 자리마다 갈아 끼우면 하나를 빠뜨리게 된다.
 */

export type TapeKey =
  | "flower"
  | "dot"
  | "stripe"
  | "check"
  | "kraft"
  | "heart"
  | "star";

export const TAPES: { key: TapeKey; label: string; file: string }[] = [
  { key: "flower", label: "꽃", file: "/tape.svg" },
  { key: "dot", label: "땡땡이", file: "/tape-dot.svg" },
  { key: "stripe", label: "사선", file: "/tape-stripe.svg" },
  { key: "check", label: "깅엄", file: "/tape-check.svg" },
  { key: "kraft", label: "크라프트", file: "/tape-kraft.svg" },
  { key: "heart", label: "하트", file: "/tape-heart.svg" },
  { key: "star", label: "반짝", file: "/tape-star.svg" },
];

/** 고르지 않았을 때 붙는 것 — 지금까지 내역에 붙어 있던 꽃이다. */
export const DEFAULT_TAPE: TapeKey = "flower";

export function tapeFile(key: string): string {
  return (TAPES.find((t) => t.key === key) ?? TAPES[0]).file;
}

/**
 * 고른 테이프를 문서에 건다.
 *
 * 화면을 다시 그리지 않는다 — 변수 하나만 갈아 끼우면 이미 붙어 있는 테이프도
 * 그 자리에서 바뀐다. 그래서 고르는 그 순간 눈에 보인다.
 */
export function applyTape(key: string): void {
  document.documentElement.style.setProperty(
    "--tape-img",
    `url("${tapeFile(key)}")`
  );
}
