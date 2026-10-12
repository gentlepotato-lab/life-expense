import { useEffect, useState } from "react";

/**
 * 기다림 — 만년필이 줄을 그어 나간다.
 *
 * 300ms가 지나서야 나타난다. 대개는 그보다 빨리 끝나는데, 그때마다 번쩍이면
 * 없느니만 못하다. 늦게 뜨는 대신 한 번 뜨면 일이 끝날 때까지 돈다.
 *
 * 움직이는 것은 transform과 opacity뿐이다. 건수가 많아 본줄이 막히는 동안에도
 * 합성기가 돌리므로, 정작 기다릴 때 그림이 얼지 않는다. 줄을 긋는 데 흔히 쓰는
 * stroke-dashoffset은 본줄이 돌리는 것이라 쓰지 않았다.
 *
 * 줄은 덮개로 가리지 않고 왼쪽 끝을 축으로 늘인다. 덮개를 두면 바탕이 비치는
 * 자리에서 그 네모가 그대로 드러난다.
 */
export default function Waiting({ overlay = false }: { overlay?: boolean }) {
  const [보임, set보임] = useState(false);

  useEffect(() => {
    const 시계 = window.setTimeout(() => set보임(true), 300);
    return () => window.clearTimeout(시계);
  }, []);

  if (!보임) return null;

  return (
    <div className={`wait${overlay ? " wait--over" : ""}`} role="status" aria-live="polite">
      <svg className="wait__art" viewBox="0 0 240 80" aria-hidden="true">
        {/* 그어 놓은 줄 — 왼쪽 끝에서 오른쪽으로 늘어난다. */}
        <path className="wait__line" d="M24 58 H214" />
        {/* 닙 — 끝을 줄 위에 두고 그 자리를 축으로 기울인다. 틈과 숨구멍이
            있어야 만년필로 읽힌다. */}
        <g className="wait__pen">
          <g transform="translate(24 58) rotate(26)">
            <path className="wait__nib" d="M0 0 L-9 -27 Q0 -36 9 -27 Z" />
            <path className="wait__slit" d="M0 0 V-21" />
            <circle className="wait__hole" cx="0" cy="-25" r="3" />
            <path className="wait__barrel" d="M0 -37 V-52" />
          </g>
        </g>
      </svg>
      <p className="wait__say">쓰는 중입니다.</p>
    </div>
  );
}
