import { useCallback, useRef } from "react";

/**
 * 가려 둔 금액을 "끌어서 잠깐 보기".
 *
 * 손을 대고 옆으로 조금 끌면 테이프가 밀려나고, 떼면 도로 덮인다.
 *
 * 전에는 30px를 끌어야 반응해서 뻑뻑했다. 12px로 줄였다.
 * 세로로 끄는 건 화면 스크롤이므로 가로로 더 많이 움직였을 때만 연다.
 */
const THRESHOLD = 12;

export default function useRevealDrag(setRevealed: (on: boolean) => void) {
  /* 이미 열렸으면 같은 값을 거듭 넣지 않는다 — 끄는 동안 다시 그리지 않게 */
  const openRef = useRef(false);

  return useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const start =
        "touches" in e ? e.touches[0]?.clientX : (e as React.MouseEvent).clientX;
      const startY =
        "touches" in e ? e.touches[0]?.clientY : (e as React.MouseEvent).clientY;
      if (start === undefined) return;

      openRef.current = false;

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const p = "touches" in ev ? ev.touches[0] : (ev as MouseEvent);
        if (!p) return;
        const dx = Math.abs(p.clientX - start);
        const dy = Math.abs(p.clientY - startY);
        if (!openRef.current && dx > THRESHOLD && dx > dy) {
          openRef.current = true;
          setRevealed(true);
        }
      };

      const onEnd = () => {
        setRevealed(false);
        window.removeEventListener("mousemove", onMove, true);
        window.removeEventListener("touchmove", onMove, true);
        window.removeEventListener("mouseup", onEnd, true);
        window.removeEventListener("touchend", onEnd, true);
        window.removeEventListener("touchcancel", onEnd, true);
      };

      /* 잡는 단계로 듣는다. 씀씀이의 말풍선처럼 중간에서 손짓을 끊어야 하는
         자리가 있어서다 — 거기서 끊기면 거품 단계로 듣는 이 손은 못 듣는다.
         끊는 곳이 없는 다른 화면에서는 듣는 차례만 앞설 뿐 하는 일이 같다. */
      window.addEventListener("mousemove", onMove, true);
      window.addEventListener("touchmove", onMove, { passive: true, capture: true });
      window.addEventListener("mouseup", onEnd, true);
      window.addEventListener("touchend", onEnd, true);
      window.addEventListener("touchcancel", onEnd, true);
    },
    [setRevealed]
  );
}
