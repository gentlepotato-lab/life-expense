import { useCallback, useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { LONG_PRESS_DELAY } from "./useLongPress";

/**
 * 카드 왼쪽 위 접은 자국을 잡아 오른쪽으로 끌면, 그 귀퉁이가 포스트잇처럼
 * 접혀 넘어온다.
 *
 * - 끄는 만큼만 접힌다. 중간에 놓으면 제자리로 펴져 붙는다.
 * - 끝까지 끌고 놓으면 꾹 눌렀을 때처럼 편집 팝업을 연다.
 * - 잡은 채 가만히 있으면 역시 편집 팝업을 연다 — 귀퉁이만 꾹 누르기가 빠지지 않게.
 * - 위아래로 먼저 움직이면 목록을 굴리려는 것으로 보고 손을 뗀다.
 *
 * 접는 모양은 매 틀마다 셈한다. 귀퉁이가 손가락이 닿은 자리까지 넘어오도록
 * 두 점(원래 귀퉁이 · 끌린 귀퉁이)의 수직이등분선을 접는 선으로 삼고,
 *   ① 카드에서 그 선 바깥(귀퉁이 쪽)을 바탕색으로 덮어 떼어진 것처럼 비우고
 *   ② 그 조각을 선 너머로 뒤집어 종이 뒷면으로 그린다.
 * 뒤집은 조각은 조금 짧게 그려 납작하게 접힌 것이 아니라 둥글게 말린 것처럼 보이게 한다.
 *
 * 손가락이 움직일 때마다 React를 다시 그리면 끊긴다. 카드 요소에 CSS 변수만
 * 한 틀에 한 번 적고, 그리는 것은 index.css 119절이 맡는다.
 */

/** 끝까지 떼었다고 볼 거리 — 카드 폭에 곱한다. */
const PEEL_FULL = 0.55;

/** 이만큼 움직이기 전에는 떼는 중으로 보지 않는다. */
const PEEL_SLOP = 5;

/** 옆으로 끌 때 귀퉁이가 아래로 처지는 정도 — 0이면 책장 넘기듯 세로로 접힌다. */
const SLOPE = 0.42;

/** 뒤집어 넘어온 조각을 얼마나 짧게 그릴지 — 1이면 납작하게 접힌 종이다. */
const CURL = 0.84;

/** 놓았을 때 펴져 붙는 시간 */
const SETTLE_MS = 360;

type Pt = [number, number];
type Drag = { x: number; y: number; w: number; h: number; p: number; moved: boolean };

const VARS = ["--peel", "--peel-cut", "--peel-flap", "--peel-grad", "--peel-shade", "--peel-sx", "--peel-sy"];

function polygon(pts: Pt[]): string {
  if (pts.length < 3) return "polygon(0 0, 0 0, 0 0)";
  return `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})`;
}

/** 귀퉁이를 d만큼 끌었을 때 — 비울 자리 · 넘어온 조각 · 그 위의 명암 */
function shape(w: number, h: number, d: number) {
  const px = d;
  const py = d * SLOPE;
  const len = Math.hypot(px, py);
  if (len < 0.5) return null;

  const nx = px / len;
  const ny = py / len;
  const fold = len / 2;
  /* 음수면 접는 선 바깥, 곧 떼어져 넘어가는 쪽이다. */
  const side = ([x, y]: Pt) => x * nx + y * ny - fold;

  /* 카드 네모를 접는 선으로 한 번 자른다. */
  const rect: Pt[] = [[0, 0], [w, 0], [w, h], [0, h]];
  const cut: Pt[] = [];
  for (let i = 0; i < rect.length; i++) {
    const a = rect[i];
    const b = rect[(i + 1) % rect.length];
    const sa = side(a);
    const sb = side(b);
    if (sa < 0) cut.push(a);
    if (sa < 0 !== sb < 0) {
      const t = sa / (sa - sb);
      cut.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }

  /* 잘린 조각을 선 너머로 뒤집는다. 선 위의 점은 그대로 있다. */
  const flap: Pt[] = cut.map((pt) => {
    const s = side(pt);
    return [pt[0] - (1 + CURL) * s * nx, pt[1] - (1 + CURL) * s * ny];
  });

  /* 명암은 접힌 자리에서 끝으로 한 방향 — 접힌 골은 어둡고, 말린 등성이는 밝고,
     끝으로 갈수록 빛을 덜 받아 다시 어둡다. CSS 그라데이션 선 위의 px 자리로 셈한다. */
  const deg = (Math.atan2(nx, -ny) * 180) / Math.PI;
  const lineLen = Math.abs(w * nx) + Math.abs(h * ny);
  const origin = (w / 2) * nx + (h / 2) * ny - lineLen / 2;
  const at = fold - origin;
  const tip = Math.max(...flap.map(([x, y]) => x * nx + y * ny)) - origin;
  const span = Math.max(1, tip - at);
  const px1 = (k: number) => `${(at + span * k).toFixed(1)}px`;
  const grad =
    `linear-gradient(${deg.toFixed(2)}deg, rgba(0,0,0,0) ${px1(0.15)}, var(--peel-tint) ${px1(1)}), ` +
    `linear-gradient(${deg.toFixed(2)}deg, rgba(16,24,40,0.2) ${px1(0)}, #FFFFFF ${px1(0.24)}, ` +
    `#F4F5F7 ${px1(0.62)}, #E3E6EA ${px1(1)})`;

  /* 종이가 들린 바닥 — 접힌 선 가까이는 넘어온 조각의 그늘이 진다. */
  const shade =
    `linear-gradient(${deg.toFixed(2)}deg, rgba(16,24,40,0) ${(at - 42).toFixed(1)}px, ` +
    `rgba(16,24,40,0.1) ${at.toFixed(1)}px)`;

  return { cut: polygon(cut), flap: polygon(flap), grad, shade, nx, ny };
}

function paint(card: HTMLElement, p: number, w: number, h: number) {
  const g = shape(w, h, p * w * PEEL_FULL);
  if (!g) {
    VARS.forEach((v) => card.style.removeProperty(v));
    return;
  }
  card.style.setProperty("--peel", p.toFixed(4));
  card.style.setProperty("--peel-cut", g.cut);
  card.style.setProperty("--peel-flap", g.flap);
  card.style.setProperty("--peel-grad", g.grad);
  card.style.setProperty("--peel-shade", g.shade);
  card.style.setProperty("--peel-sx", `${(g.nx * 3).toFixed(2)}px`);
  card.style.setProperty("--peel-sy", `${(g.ny * 3).toFixed(2)}px`);
  card.classList.toggle("is-peeled", p >= 1);
}

function clean(card: HTMLElement) {
  card.classList.remove("is-peeling", "is-peeled", "is-settling");
  VARS.forEach((v) => card.style.removeProperty(v));
}

export default function usePeel(onPeeled: () => void, disabled = false) {
  const cardRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const frameRef = useRef<number | null>(null);
  const holdRef = useRef<number | null>(null);
  const settleRef = useRef<number | null>(null);

  const clearHold = useCallback(() => {
    if (holdRef.current !== null) {
      window.clearTimeout(holdRef.current);
      holdRef.current = null;
    }
  }, []);

  const clearFrame = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const clearSettle = useCallback(() => {
    if (settleRef.current !== null) {
      window.cancelAnimationFrame(settleRef.current);
      settleRef.current = null;
    }
  }, []);

  /** 펴져 붙는다. 움직임 줄이기를 켠 사람에게는 바로 붙인다. */
  const settle = useCallback(
    (card: HTMLElement, from: number, w: number, h: number) => {
      clearSettle();
      card.classList.remove("is-peeling", "is-peeled");
      card.classList.add("is-settling");
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        clean(card);
        return;
      }
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / SETTLE_MS);
        const eased = 1 - Math.pow(1 - t, 3);
        paint(card, from * (1 - eased), w, h);
        if (t < 1) {
          settleRef.current = window.requestAnimationFrame(step);
        } else {
          settleRef.current = null;
          clean(card);
        }
      };
      settleRef.current = window.requestAnimationFrame(step);
    },
    [clearSettle]
  );

  useEffect(
    () => () => {
      clearHold();
      clearFrame();
      clearSettle();
    },
    [clearHold, clearFrame, clearSettle]
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (disabled || e.button !== 0) return;
      const card = e.currentTarget.closest<HTMLElement>(".card--entry");
      if (!card) return;

      cardRef.current = card;
      /* 겉 테두리 안쪽(padding box) 크기 — 덮개와 조각이 그 안에 깔린다. */
      dragRef.current = {
        x: e.clientX,
        y: e.clientY,
        w: card.clientWidth,
        h: card.clientHeight,
        p: 0,
        moved: false,
      };
      e.currentTarget.setPointerCapture(e.pointerId);

      clearHold();
      holdRef.current = window.setTimeout(() => {
        holdRef.current = null;
        const d = dragRef.current;
        if (d && !d.moved) {
          dragRef.current = null;
          onPeeled();
        }
      }, LONG_PRESS_DELAY);
    },
    [disabled, clearHold, onPeeled]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const d = dragRef.current;
      const card = cardRef.current;
      if (!d || !card) return;

      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;

      if (!d.moved) {
        if (Math.abs(dx) < PEEL_SLOP && Math.abs(dy) < PEEL_SLOP) return;
        clearHold();
        if (Math.abs(dy) > Math.abs(dx)) {
          dragRef.current = null;
          return;
        }
        d.moved = true;
        clearSettle();
        card.classList.remove("is-settling");
        card.classList.add("is-peeling");
      }

      d.p = Math.max(0, Math.min(1, dx / (d.w * PEEL_FULL)));
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(() => {
          frameRef.current = null;
          const live = dragRef.current;
          if (live && cardRef.current) paint(cardRef.current, live.p, live.w, live.h);
        });
      }
    },
    [clearHold, clearSettle]
  );

  const finish = useCallback(
    (fire: boolean) => {
      clearHold();
      clearFrame();
      const d = dragRef.current;
      const card = cardRef.current;
      dragRef.current = null;
      if (!d || !card || !d.moved) return;

      settle(card, d.p, d.w, d.h);
      if (fire && d.p >= 1) onPeeled();
    },
    [clearHold, clearFrame, settle, onPeeled]
  );

  const onPointerUp = useCallback(() => finish(true), [finish]);
  const onPointerCancel = useCallback(() => finish(false), [finish]);

  /* 잡은 채 길게 누를 때 뜨는 컨텍스트 메뉴를 막는다. */
  const onContextMenu = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    e.preventDefault();
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onContextMenu };
}
