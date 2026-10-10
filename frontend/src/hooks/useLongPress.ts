import { useCallback, useEffect, useRef, useState } from "react";

/** 꾹 누르는 시간. index.css의 --longpress-delay와 값을 맞출 것 */
export const LONG_PRESS_DELAY = 500;

/** 이 픽셀 이상 움직이면 스크롤/드래그로 보고 취소한다. */
const MOVE_TOLERANCE = 10;

/**
 * 누르는 동안 글이 끌려 잡히지 않게 한다.
 *
 * 글 위에서 꾹 누르면 그 글이 끌려 잡혔다. 손가락은 움직이지 않고 누르고만
 * 있어도 운영체제가 글을 집고 선택 손잡이를 띄우는데, 그 시간이 꾹 누르기를
 * 기다리는 500ms와 그대로 겹친다.
 *
 * 누름표(pressing) 클래스에 거는 것으로도 듣기는 하지만, 그것은 React가 한 틀
 * 뒤에 붙이는 것이라 기기에 따라 이미 늦는다. 눌린 그 자리에서 요소에 바로
 * 적는다 — pointerdown이 끝나고 나서야 브라우저가 글을 집기 시작하므로, 그
 * 사이에 적으면 아예 시작되지 않는다.
 *
 * 떼거나 취소되면 곧바로 푼다. 끌어서 복사하는 길은 이 자리에서만 막히고,
 * 누르지 않는 동안에는 쓰던 그대로다.
 */
function 글잠그기(el: HTMLElement | null): void {
  if (!el) return;
  el.style.userSelect = "none";
  el.style.webkitUserSelect = "none";
}

function 글풀기(el: HTMLElement | null): void {
  if (!el) return;
  el.style.userSelect = "";
  el.style.webkitUserSelect = "";
}

/**
 * 팝업이 뜬 뒤, 손을 뗄 때까지만 화면 전체의 글을 잠근다.
 *
 * 꾹 누르기가 터지는 순간 손은 아직 닿아 있는데 그 자리에 팝업이 뜬다.
 * 마침 누른 자리에 팝업 글이 걸리면, 이어지는 누름이 그 글을 바로 집어
 * 선택 손잡이가 떠 버렸다. 누른 요소만 잠가 두었던 것으로는 막을 수 없다 —
 * 팝업은 그 요소 밖에 그려지기 때문이다.
 *
 * 그래서 잠깐 body에 건다. 손을 떼면 곧바로 푸므로, 팝업 안의 글을 나중에
 * 긁어 가는 길은 그대로다. 떼는 신호가 끝내 오지 않는 일(요소가 사라지며
 * 누름이 끊기는 경우 등)에 대비해 시계도 함께 걸어 둔다.
 */
const 늦게풀기 = 3000;

function 손뗄때까지잠그기(): void {
  const b = document.body;
  /* 누가 이미 적어 둔 값이 있으면 그대로 되돌려 준다. */
  const 전 = { us: b.style.userSelect, wk: b.style.webkitUserSelect };
  b.style.userSelect = "none";
  b.style.webkitUserSelect = "none";

  let 시계: number | null = null;
  const 풀기 = () => {
    b.style.userSelect = 전.us;
    b.style.webkitUserSelect = 전.wk;
    if (시계 !== null) window.clearTimeout(시계);
    window.removeEventListener("pointerup", 풀기);
    window.removeEventListener("pointercancel", 풀기);
    window.removeEventListener("touchend", 풀기);
  };
  시계 = window.setTimeout(풀기, 늦게풀기);
  window.addEventListener("pointerup", 풀기);
  window.addEventListener("pointercancel", 풀기);
  window.addEventListener("touchend", 풀기);
}

/**
 * 길게 누르기 제스처. 마우스와 터치를 Pointer Event로 함께 처리한다.
 *
 * - 버튼·입력·링크, 그리고 [data-no-longpress]가 붙은 요소에서 시작한 누름은 무시한다.
 *   (금액 마스킹 드래그처럼 자체 제스처를 가진 영역을 보호하기 위함)
 * - pressing을 CSS 클래스로 넘기면 누르는 동안 진행 피드백을 줄 수 있다.
 * - 누르는 동안에는 글이 끌려 잡히지 않는다(아래 글잠그기).
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
  /** 글을 잠가 둔 요소. 떼거나 취소될 때 이것만 푼다. */
  const 잠근것 = useRef<HTMLElement | null>(null);
  const [pressing, setPressing] = useState(false);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    originRef.current = null;
    글풀기(잠근것.current);
    잠근것.current = null;
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
      /* 눌린 그 자리에서 잠근다. 한 틀이라도 늦으면 글이 이미 집힌다. */
      잠근것.current = e.currentTarget as HTMLElement;
      글잠그기(잠근것.current);
      setPressing(true);

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        originRef.current = null;
        firedRef.current = true;
        /* 누른 요소의 잠금은 여기서 푼다 — 팝업 안의 글은 그대로 긁을 수
           있어야 하므로, 손을 뗄 때까지만 따로 잠근다(손뗄때까지잠그기). */
        글풀기(잠근것.current);
        잠근것.current = null;
        setPressing(false);
        손뗄때까지잠그기();
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
