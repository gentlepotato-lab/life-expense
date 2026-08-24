import { useEffect, useRef } from "react";

/**
 * 뒤로 가기(또는 Backspace · Esc)로 "지금 열린 것"만 닫는다.
 *
 * 그동안은 팝업이 떠 있어도 뒤로 가기를 누르면 화면 자체를 떠났다.
 * 열려 있는 동안 방문 기록에 한 칸을 끼워 두고, 뒤로 가기가 그 칸을 무르면
 * 화면은 그대로 둔 채 닫기만 부른다.
 *
 * 끼워 둔 칸은 팝업이 닫힐 때 우리가 도로 걷어 낸다. 그래야 팝업을 여닫은
 * 횟수만큼 뒤로 가기를 눌러야 하는 일이 생기지 않는다.
 *
 * Esc 는 늘 닫는다. Backspace 는 계산기처럼 그 키를 따로 쓰는 화면이 있어
 * 끌 수 있게 해 둔다.
 *
 * @param open      지금 열려 있는지
 * @param close     닫는 함수
 * @param backspace Backspace 로도 닫을지 — 기본은 닫는다
 */
/**
 * 지금 열려 있는 것들. 나중에 열린 것이 뒤에 온다.
 *
 * 뒤로 가기 한 번은 맨 위 하나만 닫아야 한다. popstate 는 창 전체에 울려서
 * 열려 있는 모든 것이 한꺼번에 반응하기 때문에, 여기서 차례를 따져 맨 위만
 * 닫게 한다. 팝업 안에서 장소 고르기를 열고 하나 고르면 팝업까지 함께
 * 닫히던 것이 이 때문이었다.
 */
const openStack: object[] = [];

/**
 * 우리가 스스로 걷어 내는 중인 칸의 수.
 *
 * 단추로 닫으면 끼워 둔 칸을 history.back() 으로 도로 걷는데, 그 back 도
 * popstate 를 울린다. 그 울림은 "뒤로 가기를 눌렀다" 는 뜻이 아니므로
 * 한 번 삼키고 아무것도 닫지 않는다.
 */
let unwinding = 0;

export default function useBackClose(
  open: boolean,
  close: () => void,
  backspace: boolean = true
) {
  /* close 가 매번 새 함수로 와도 효과를 다시 걸지 않도록 담아 둔다 */
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;

    /* 우리가 끼운 칸인지 알아보려고 표시를 남긴다 */
    const mark = { __overlay: true };
    window.history.pushState(mark, "");
    let popped = false;

    /* 차례를 가리는 이름표 — 값은 쓰지 않고 누구인지만 본다 */
    const token = {};
    openStack.push(token);

    const onPop = () => {
      /* 우리가 걷어 낸 칸이 되돌아온 울림이면 아무도 닫지 않는다 */
      if (unwinding > 0) {
        unwinding -= 1;
        return;
      }
      /* 맨 위에 있는 것만 닫는다 — 아래 깔린 것까지 함께 닫히면 안 된다 */
      if (openStack[openStack.length - 1] !== token) return;

      popped = true;
      closeRef.current();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && (e.key !== "Backspace" || !backspace)) return;

      /* 키도 맨 위 하나만 받는다. 겹쳐 있을 때 저마다 뒤로 가기를 부르면
         한 번 눌러 여러 개가 닫힌다. */
      if (openStack[openStack.length - 1] !== token) return;

      /* 글자를 지우는 중이라면 건드리지 않는다 */
      const el = document.activeElement as HTMLElement | null;
      const typing =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);
      if (e.key === "Backspace" && typing) return;

      e.preventDefault();
      window.history.back();
    };

    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);

      const at = openStack.lastIndexOf(token);
      if (at >= 0) openStack.splice(at, 1);

      /* 뒤로 가기가 아니라 버튼으로 닫은 경우 — 끼워 둔 칸을 걷어 낸다.
         이때 울리는 popstate 는 삼켜야 아래 깔린 팝업이 함께 닫히지 않는다. */
      if (!popped) {
        const state = window.history.state as { __overlay?: boolean } | null;
        if (state?.__overlay) {
          unwinding += 1;
          window.history.back();
        }
      }
    };
  }, [open, backspace]);
}
