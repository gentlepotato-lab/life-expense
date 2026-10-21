/**
 * 관리자 토큰을 담는 자리.
 *
 * adminAuth.ts에 있던 것을 떼어 왔다. api/client.ts가 401을 보고 토큰을
 * 걷어야 하는데, client.ts를 adminAuth.ts가 부르고 있어 서로 물리기 때문이다.
 * 여기는 아무것도 부르지 않아 어느 쪽에서 불러도 된다.
 *
 * sessionStorage에 담는다. 창을 닫으면 사라진다. localStorage에 담으면
 * 다음에 열 때도 그대로 열려 있어 자물쇠를 건 뜻이 옅어진다.
 */

const 담는열쇠 = "life-expense:admin";

/** 토큰이 끊겼을 때 알릴 곳들. */
const 듣는이: (() => void)[] = [];

/** 지금 든 토큰. 없으면 빈 글이다. */
export function 토큰(): string {
  try {
    return window.sessionStorage.getItem(담는열쇠) ?? "";
  } catch {
    return "";
  }
}

export function 담기(값: string): void {
  try {
    if (값) window.sessionStorage.setItem(담는열쇠, 값);
    else window.sessionStorage.removeItem(담는열쇠);
  } catch {
    /* 저장 공간이 막혀 있어도 이번 판은 그대로 돈다. */
  }
}

/** 토큰이 끊길 때 부를 것을 매단다. 걷는 함수를 돌려준다. */
export function on끊김(fn: () => void): () => void {
  듣는이.push(fn);
  return () => {
    const i = 듣는이.indexOf(fn);
    if (i >= 0) 듣는이.splice(i, 1);
  };
}

/**
 * 토큰을 걷고 매단 곳에 알린다.
 *
 * 서버가 401로 돌려보낼 때 부른다. 그러지 않으면 화면이 그 401을 "받아 온
 * 것이 없다"로 받아, 목록이 빈 채로 떠서 자료가 사라진 것처럼 보인다.
 */
export function 끊겼다(): void {
  if (!토큰()) return;
  담기("");
  for (const fn of [...듣는이]) {
    try {
      fn();
    } catch {
      /* 한 곳이 넘어져도 나머지는 알린다. */
    }
  }
}
