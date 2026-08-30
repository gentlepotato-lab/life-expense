import { useEffect, useState } from "react";
import ArrowUpIcon from "./ArrowUpIcon";

/**
 * 맨 위로 — 화면 오른쪽 아래에 붙어 있는 단추.
 *
 * 오른쪽 위 네 단추(새로 고침 · 만년필 · 계산기 · 종)와 한 식구지만 자리가
 * 다르다. 한참 내려온 손이 오른쪽 위까지 올라가는 것보다 아래에서 바로 닿는
 * 편이 빠르다.
 *
 * 맨 위에 있을 때는 나타나지 않는다. 갈 곳이 없는 단추가 떠 있으면 자리만
 * 차지한다. 사라지고 나타나는 것은 CSS가 맡는다(.is-on).
 */

/** 이만큼 내려와야 나타난다 */
const SHOW_AT = 200;

export default function ScrollTopButton() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    let ticking = false;
    const read = () => {
      ticking = false;
      setOn(window.scrollY > SHOW_AT);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(read);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      className={`scroll-top${on ? " is-on" : ""}`}
      aria-label="맨 위로"
      title="맨 위로"
      tabIndex={on ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <ArrowUpIcon />
    </button>
  );
}
