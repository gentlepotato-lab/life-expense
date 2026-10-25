import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * 머리말과 첫 줄 도구를 위에 붙인다.
 *
 * 내용이 긴 화면에서는 [편집]이나 [필터]를 한 번 누르려고 맨 위까지 되감아
 * 올라가야 했다. 그렇다고 늘 붙이면 좁은 화면에서 볼 자리를 그만큼
 * 빼앗는다. 그래서 내릴 때는 함께 밀려 올라가 사라지고, 올릴 때 다시
 * 내려온다. 되감으려는 손짓이 곧 부르는 손짓이다.
 *
 * 붙일 것은 화면마다 이름이 다르지만 자리는 늘 같다. 머리말 다음, 본문 맨
 * 앞에 오는 도구 줄이다. 그 줄들을 위에서부터 차례로 쌓아 저마다 몇 픽셀에
 * 설지 정해 준다. 화면마다 도구가 하나이기도 둘이기도 해서 CSS 한 값으로는
 * 정할 수 없다.
 *
 * 자리(top)만 정하고 감추고 드러내는 일은 CSS가 한다. 여기서는 어느 쪽으로
 * 굴렸는지만 알려 준다(html.pin-off).
 */

/** 붙일 도구 줄. 본문 맨 앞에 오는 것만 선택한다.
 *
 * 관리자 쪽은 머리말이 쪽 안에 있다. 사용자 쪽은 .page-wrap 바깥에 서는데
 * (App.tsx), 관리자 쪽은 틀이 쪽 안에서 그리기 때문이다(pages/Admin.tsx).
 * 그래서 .page-head도 여기 적고 DOM 차례대로 모은다. 바깥에 선 것을 먼저
 * 밀어 넣고 그다음에 자식을 훑으면, 관리자 쪽에서 머리말이 두 번 잡힌다. */
const TOOLS = [
  ".page-head",
  ".toolbar-wrap",
  ".cat-toolbar",
  ".cal-sources",
];

/** 손이 흔들리는 정도로는 감추지 않는다. */
const NUDGE = 6;

/** 이만큼 내려가기 전에는 늘 보인다. 위쪽에서는 감출 것이 없다. */
const FREE = 8;

const PIN_OFF = "pin-off";

/** 머리말 다음에 붙일 것들을 위에서부터 차례로 모은다. */
function pinnedNow(): HTMLElement[] {
  const out: HTMLElement[] = [];
  /* 쪽 바깥에 선 머리말만 먼저 밀어 넣는다. 쪽 안에 있는 것(관리자 쪽)은
     아래 자식 훑기가 DOM 차례대로 잡는다. */
  const head = document.querySelector<HTMLElement>(".page-head");
  if (head && !head.closest(".page-wrap")) out.push(head);

  const wrap = document.querySelector<HTMLElement>(".page-wrap");
  if (!wrap) return out;

  for (const el of Array.from(wrap.children)) {
    if (!(el instanceof HTMLElement)) continue;
    // 함께한 상대는 도구 줄이 한 겹 안에 들어 있다.
    if (el.classList.contains("cp-page")) {
      const inner = el.querySelector<HTMLElement>(":scope > .cp-toolbar");
      if (inner) out.push(inner);
      break;
    }
    if (!TOOLS.some((c) => el.matches(c))) break;
    out.push(el);
  }
  return out;
}

export default function useHeadPin() {
  const { pathname } = useLocation();

  useEffect(() => {
    const docEl = document.documentElement;
    let marked: HTMLElement[] = [];

    /** 몇 픽셀에 설지 위에서부터 쌓아 정한다. */
    const measure = () => {
      const now = pinnedNow();

      // 화면을 옮기면 지난 화면의 자국을 지운다.
      for (const el of marked) {
        if (now.includes(el)) continue;
        el.classList.remove("is-pinned");
        el.style.top = "";
      }
      marked = now;

      let acc = 0;
      for (const el of now) {
        el.classList.add("is-pinned");
        el.style.top = `${acc}px`;
        acc += el.getBoundingClientRect().height;
      }
      docEl.style.setProperty("--pin-h", `${Math.round(acc)}px`);
    };

    // 도구 줄이 늦게 붙거나 두 줄로 접히면 다시 잰다.
    const ro = new ResizeObserver(() => measure());
    const head = document.querySelector<HTMLElement>(".page-head");
    if (head) ro.observe(head);

    /* 본문 껍데기는 통째로 갈리기도 한다. 씀씀이는 무거워서 따로 받아 오므로
       받는 동안 빈 껍데기가 섰다가 다 받으면 새것으로 바뀐다. 갈린 뒤에도
       옛것을 보고 있으면 그 화면만 붙지 않는다. */
    let wrap: HTMLElement | null = null;
    const rewatch = () => {
      const now = document.querySelector<HTMLElement>(".page-wrap");
      if (now === wrap) return;
      if (wrap) ro.unobserve(wrap);
      wrap = now;
      if (wrap) ro.observe(wrap);
    };

    const relook = () => {
      rewatch();
      measure();
    };

    relook();

    const root = document.getElementById("root");
    const mo = new MutationObserver(relook);
    if (root) mo.observe(root, { childList: true });

    let last = Math.max(0, window.scrollY);
    let ticking = false;

    const read = () => {
      ticking = false;
      const y = Math.max(0, window.scrollY);
      if (y <= FREE) {
        last = y;
        docEl.classList.remove(PIN_OFF);
        return;
      }
      const dy = y - last;
      if (Math.abs(dy) < NUDGE) return;
      last = y;
      docEl.classList.toggle(PIN_OFF, dy > 0);
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(read);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      ro.disconnect();
      mo.disconnect();
      docEl.classList.remove(PIN_OFF);
      for (const el of marked) {
        el.classList.remove("is-pinned");
        el.style.top = "";
      }
    };
  }, [pathname]);
}
