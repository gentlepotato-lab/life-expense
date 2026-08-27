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
const openStack: { close: () => void }[] = [];

/**
 * 지금 열려 있는 것을 모두 닫는다 — 나중에 열린 것부터.
 *
 * 화면 위에 늘 떠 있는 네 단추(새로 고침 · 쓰기 · 계산기 · 잔소리)가
 * 팝업 위에서도 눌리게 되면서 필요해졌다. 팝업이 떠 있는데 다른 단추를
 * 누르면 두 팝업이 겹쳐 뜨는 대신 앞것이 물러나야 한다.
 *
 * 닫는 일은 저마다 자기 방식이 있으므로(고르던 것 되돌리기 · 기록 칸
 * 걷어 내기) 여기서는 그 함수를 부르기만 한다.
 */
export function closeOverlays(): Promise<void> {
  const waiting = openStack.length;
  /* 닫으면 목록이 줄어드니 베껴 두고 돈다 */
  [...openStack].reverse().forEach((t) => t.close());
  if (waiting === 0) return Promise.resolve();

  /* 다 걷힐 때까지 기다렸다가 알린다.
     닫히는 쪽은 끼워 둔 칸을 history.back() 으로 걷는데 그게 늦게 오고,
     여는 쪽의 pushState 는 먼저 간다. 그대로 두면 늦게 온 back 이 새로 끼운
     칸을 도로 걷어 버려, 새 팝업이 떠 있는데 뒤로 가기로는 닫을 수 없게 된다.
     걷는 만큼 popstate 가 울리니 그 수를 세고 나서 다음 것을 연다. */
  return new Promise((done) => {
    let seen = 0;
    const finish = () => {
      window.removeEventListener("popstate", onPop);
      clearTimeout(timer);
      done();
    };
    const onPop = () => {
      /* 닫힌 쪽은 이미 귀를 닫았다 — 삼키려고 올려 둔 수를 여기서 내린다.
         그대로 두면 다음에 열린 팝업이 진짜 뒤로 가기 한 번을 삼켜버린다. */
      if (unwinding > 0) unwinding -= 1;
      seen += 1;
      if (seen >= waiting) finish();
    };
    window.addEventListener("popstate", onPop);
    /* 걷을 칸이 없어 울림이 오지 않는 경우도 있다 — 마냥 기다리지 않는다 */
    const timer = setTimeout(finish, 400);
  });
}

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

    /* 차례를 가리는 이름표. 밖에서 닫을 수 있도록 닫는 함수도 함께 든다 */
    const token = { close: () => closeRef.current() };
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
