/**
 * 설치해 쓰는 창이 바닥보다 좁거나 낮아지면 도로 늘린다.
 *
 * web에는 창의 최소 크기를 적는 길이 없다. manifest에도 그런 칸이 없고,
 * CSS는 알맹이가 접히는 것만 막을 뿐 창 자체는 계속 줄어든다. 손으로 줄여도
 * 400px 아래로는 안 가게 하려면, 줄어든 뒤에 도로 늘리는 수밖에 없다.
 *
 * 손을 놓고 나서 늘린다. 끄는 동안 매 틀마다 늘리면 창이 손끝과 다투어
 * 덜덜거린다.
 *
 * 설치해 쓰는 창에서만 돈다. 보통 탭에서는 브라우저가 창 크기 고치기를
 * 받지 않고, 받는다 해도 탭 하나 때문에 창 전체를 늘리는 것은 지나치다.
 * 손가락으로 쓰는 기기도 집지 않는다. 거기는 창을 줄일 일이 없다.
 *
 * 브라우저가 창 크기 고치기를 막아 두었으면 아무 일도 일어나지 않는다.
 * 그때는 CSS 바닥(index.css의 min-width)까지가 할 수 있는 전부다.
 */

/** 창이 가질 수 있는 가장 작은 크기. CSS 바닥과 같은 값을 쓴다. */
export const 창바닥 = { 폭: 400, 높이: 760 };

/** 손을 놓은 것으로 볼 틈(ms). */
const 기다림 = 120;

/** 설치해 쓰는 창인가. */
function 앱창인가(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches
  );
}

export default function 창바닥걸기(): void {
  if (!앱창인가()) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  let 시계: number | null = null;

  const 늘리기 = () => {
    const 폭 = Math.max(window.outerWidth, 창바닥.폭);
    const 높이 = Math.max(window.outerHeight, 창바닥.높이);
    if (폭 === window.outerWidth && 높이 === window.outerHeight) return;
    try {
      window.resizeTo(폭, 높이);
    } catch {
      /* 막아 둔 판에서는 조용히 넘어간다. */
    }
  };

  window.addEventListener("resize", () => {
    if (시계) window.clearTimeout(시계);
    시계 = window.setTimeout(늘리기, 기다림);
  });

  /* 열 때 이미 작으면 그 자리에서 늘린다. 지난번에 작게 두고 닫았으면
     브라우저가 그 크기를 기억해 그대로 열기 때문이다. */
  늘리기();
}
