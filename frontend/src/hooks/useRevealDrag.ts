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
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("mouseup", onEnd);
        window.removeEventListener("touchend", onEnd);
        window.removeEventListener("touchcancel", onEnd);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("touchmove", onMove, { passive: true });
      window.addEventListener("mouseup", onEnd);
      window.addEventListener("touchend", onEnd);
      window.addEventListener("touchcancel", onEnd);
    },
    [setRevealed]
  );
}
