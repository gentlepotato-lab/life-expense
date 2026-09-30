import { useEffect, useState } from "react";

/**
 * 어떤 칸 아래에 붙여 띄우는 판의 자리를 셈한다.
 *
 * 고르개(SingleSelect)가 쓰던 셈을 그대로 뽑아 왔다. 연월 고르개가 같은
 * 자리 셈을 또 적으면 언젠가 한쪽만 고쳐져, 같은 앱 안에서 어떤 판은
 * 화면을 넘고 어떤 판은 안 넘게 된다.
 *
 * 판은 `position: fixed` 기준으로 놓인다 — 칸이 스크롤되는 통 안에 있어도
 * 판이 잘리지 않게 하려는 것이다. 그래서 스크롤이 일어나면 다시 셈한다.
 */
export default function useAnchoredPanel(
  open: boolean,
  ref: React.RefObject<HTMLElement | null>,
  opts: { minWidth?: number; maxHeight?: number } = {}
): React.CSSProperties {
  const { minWidth = 200, maxHeight: cap = 260 } = opts;
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!open || !ref.current) return;

    const place = () => {
      const el = ref.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const GUTTER = 8; // 화면 가장자리 최소 여백

      // 칸이 좁아도 읽을 수 있는 너비는 확보하되, 화면을 넘지 않게 자른다.
      const width = Math.min(
        Math.max(rect.width, minWidth),
        window.innerWidth - GUTTER * 2
      );

      // 오른쪽으로 삐져나가면 왼쪽으로 당긴다.
      let left = rect.left;
      if (left + width > window.innerWidth - GUTTER) {
        left = window.innerWidth - GUTTER - width;
      }
      if (left < GUTTER) left = GUTTER;

      // 아래 공간이 부족하면 위로 펼친다.
      const below = window.innerHeight - rect.bottom - GUTTER;
      const above = rect.top - GUTTER;
      const openUp = below < 140 && above > below;
      const maxHeight = Math.max(120, Math.min(cap, openUp ? above : below));

      setStyle(
        openUp
          ? { bottom: window.innerHeight - rect.top + 4, left, width, maxHeight }
          : { top: rect.bottom + 4, left, width, maxHeight }
      );
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, ref, minWidth, cap]);

  return style;
}
