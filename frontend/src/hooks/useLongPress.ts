import { useCallback, useEffect, useRef, useState } from "react";

/** 꾹 누르는 시간. index.css의 --longpress-delay와 값을 맞출 것 */
export const LONG_PRESS_DELAY = 500;

/** 이 픽셀 이상 움직이면 스크롤/드래그로 보고 취소한다. */
const MOVE_TOLERANCE = 10;

/**
 * 길게 누르기 제스처. 마우스와 터치를 Pointer Event로 함께 처리한다.
 *
 * - 버튼·입력·링크, 그리고 [data-no-longpress]가 붙은 요소에서 시작한 누름은 무시한다.
 *   (금액 마스킹 드래그처럼 자체 제스처를 가진 영역을 보호하기 위함)
 * - pressing을 CSS 클래스로 넘기면 누르는 동안 진행 피드백을 줄 수 있다.
 */
export default function useLongPress(
  onLongPress: () => void,
  options?: { delay?: number; disabled?: boolean }
) {
  const delay = options?.delay ?? LONG_PRESS_DELAY;
  const disabled = options?.disabled ?? false;

  const timerRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);
  const [pressing, setPressing] = useState(false);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    originRef.current = null;
    setPressing(false);
  }, []);

  // 언마운트 시 타이머 정리
  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      if (e.button !== 0) return; // 좌클릭 / 터치만

      const target = e.target as HTMLElement | null;
      if (
        target?.closest?.(
          "[data-no-longpress], button, a, input, select, textarea, label"
        )
      ) {
        return;
      }

      firedRef.current = false;
      originRef.current = { x: e.clientX, y: e.clientY };
      setPressing(true);

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        originRef.current = null;
        firedRef.current = true;
        setPressing(false);
        onLongPress();
      }, delay);
    },
    [disabled, delay, onLongPress]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const origin = originRef.current;
      if (!origin) return;
      if (
        Math.abs(e.clientX - origin.x) > MOVE_TOLERANCE ||
        Math.abs(e.clientY - origin.y) > MOVE_TOLERANCE
      ) {
        cancel();
      }
    },
    [cancel]
  );

  // 누르는 도중 뜨는 컨텍스트 메뉴(모바일 길게 누르기 메뉴 포함)를 막는다.
  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (pressing || firedRef.current) e.preventDefault();
    },
    [pressing]
  );

  return {
    pressing,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
      onContextMenu,
    },
  };
}
