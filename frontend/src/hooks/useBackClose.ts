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

    const onPop = () => {
      popped = true;
      closeRef.current();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && (e.key !== "Backspace" || !backspace)) return;

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
      /* 뒤로 가기가 아니라 버튼으로 닫은 경우 — 끼워 둔 칸을 걷어 낸다 */
      if (!popped) {
        const state = window.history.state as { __overlay?: boolean } | null;
        if (state?.__overlay) window.history.back();
      }
    };
  }, [open, backspace]);
}
