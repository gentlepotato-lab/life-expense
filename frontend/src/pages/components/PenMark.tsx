import { useEffect, useState } from "react";

/**
 * 안내 한 줄 오른쪽 끝에 서는 만년필 자국.
 *
 * 기다림 그림(Waiting)과 같은 손놀림인데 쓰임이 다르다. 저쪽은 일이 끝날
 * 때까지 돌고, 이쪽은 한 번 쓰고 한참 쉰다 — 7초에 한 번, 쓰는 데는 2.5초쯤
 * 걸린다. 눈을 붙잡으려는 것이 아니라 화면이 살아 있다는 것만 알린다.
 *
 * 폭은 화면 폭을 따라간다. 안내 한 줄이 아래로 접히지만 않으면 되는데 그
 * 여유가 화면마다 다르다 — 가장 긴 안내(설정 첫 화면)를 두고 재니 360px에서
 * 42px, 390px에서 72px, 412px에서 94px이 남았다. 한 값으로 못 박으면 가장
 * 좁은 쪽에 맞춰야 해서 넓은 화면에서 쓸데없이 짧다.
 *
 * 늘어나는 것은 줄뿐이고 별은 크기가 그대로다. viewBox를 픽셀과 1:1로 두어
 * 늘려도 별이 찌그러지지 않는다.
 *
 * 머리말 높이에는 손대지 않는다. 띄워서 얹으므로 이것이 있어도 없어도 아래
 * 내용이 서는 자리가 같다.
 *
 * 알려 줄 뜻이 없는 꾸밈이라 읽는 장치에서는 숨긴다.
 */

/**
 * 자국의 폭.
 *
 * 설정 첫 화면의 안내를 두고 재니 한 줄을 지키면서 내줄 수 있는 자리가
 * 360px에서 42px, 390px에서 72px, 412px에서 94px이었다 — 화면 폭에서 318을
 * 뺀 값이다. 2px을 더 접어 두고, 자국과 글 사이 틈 8px을 뺀다.
 */
function 자국폭(화면: number): number {
  return Math.max(32, Math.min(112, Math.round(화면 - 328)));
}

/** 별의 반지름과 줄이 놓이는 높이. */
const R = 7;
const YB = 23;

/**
 * 쭉 그은 줄에 오각별을 이어 붙인 한 획.
 *
 * 별은 꼭짓점을 하나 건너뛰며 돌면 다섯 선으로 제자리에 돌아온다. 그래서
 * 펜을 떼지 않고 줄에서 별까지 이어 그을 수 있다. 줄이 끝나는 자리를 별의
 * 왼쪽 아래 꼭짓점으로 잡아 별이 줄 위로 솟게 둔다.
 */
function 한획(폭: number): string {
  const 끝 = 폭 - 1.5 - 1.5389 * R;
  const cx = 끝 + 0.5878 * R;
  const cy = YB - 0.809 * R;
  const 점 = (x: number, y: number) => `L${x.toFixed(1)} ${y.toFixed(1)}`;
  return [
    `M2 ${YB}`,
    점(끝, YB),
    점(cx, cy - R),
    점(cx + 0.5878 * R, YB),
    점(cx - 0.9511 * R, cy - 0.309 * R),
    점(cx + 0.9511 * R, cy - 0.309 * R),
    점(끝, YB),
  ].join(" ");
}

export default function PenMark() {
  const [폭, set폭] = useState(() =>
    자국폭(typeof document === "undefined" ? 360 : document.documentElement.clientWidth)
  );

  /* 안내 글이 비워 둘 자리도 여기서 정한다. CSS가 100vw로 따로 셈하면
     굴림대가 있는 화면에서 둘이 어긋나, 글이 자국 밑으로 깔린다. */
  useEffect(() => {
    const 재기 = () => {
      const w = 자국폭(document.documentElement.clientWidth);
      set폭(w);
      document.documentElement.style.setProperty("--doodle-room", `${w + 8}px`);
    };
    재기();
    window.addEventListener("resize", 재기);
    return () => window.removeEventListener("resize", 재기);
  }, []);

  const 길 = 한획(폭);

  return (
    <span className="page-doodle" aria-hidden="true" style={{ width: `${폭}px` }}>
      <svg viewBox={`0 0 ${폭} 26`} focusable="false">
        <path className="page-doodle__line" pathLength={100} d={길} />
        <g className="page-doodle__pen" style={{ offsetPath: `path("${길}")` }}>
          <g transform="rotate(26) scale(0.52)">
            {/* 펜대 — 아래가 굵고 위로 좁아지는 몸통. 잉크와 같은 빛깔이면
                그은 줄과 구분이 안 되므로 닙과 같은 빛깔로 채운다. */}
            <path className="page-doodle__body" d="M-2.6 -14 L-2.2 -29 Q0 -31.5 2.2 -29 L2.6 -14 Z" />
            <path className="page-doodle__nib" d="M0 0 L-4.2 -11.5 Q0 -15.5 4.2 -11.5 Z" />
            <path className="page-doodle__slit" d="M0 0 V-9" />
          </g>
        </g>
      </svg>
    </span>
  );
}
