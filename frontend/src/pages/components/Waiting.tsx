import { useEffect, useState } from "react";

/**
 * 기다림 — 만년필이 실타래를 풀어 놓듯 긋는다.
 *
 * 300ms가 지나서야 나타난다. 대개는 그보다 빨리 끝나는데, 그때마다 번쩍이면
 * 없느니만 못하다. 늦게 뜨는 대신 한 번 뜨면 일이 끝날 때까지 돈다.
 *
 * 줄은 stroke-dashoffset으로 긋고 펜은 offset-path로 그 길을 탄다. 둘이 같은
 * 길과 같은 박자를 쓰므로 펜 끝과 잉크 끝이 붙어 간다. 길을 한 곳(YARN)에만
 * 두고 d와 offset-path에 함께 넘긴다 — 두 군데에 적으면 한쪽만 고쳐 어긋난다.
 *
 * 곧은 줄이던 때는 transform(scaleX) 하나로 늘여서, 메인 스레드가 막혀도
 * 합성기가 따로 돌렸다. 고리를 그리려면 그 길을 버려야 한다 — 두 성질 모두
 * 메인 스레드가 돌린다. 대신 이제 이 판이 뜨는 자리는 서버를 기다리는
 * 동안이라 그때 메인 스레드는 한가하다.
 *
 * pathLength를 100으로 두면 길이를 재지 않아도 dasharray를 100으로 쓸 수
 * 있다. 길 모양을 고쳐도 CSS는 건드릴 것이 없다.
 */

/**
 * 쭉 그은 줄과, 끝에 붙는 별 하나.
 *
 * 별은 한 획으로 그어지는 오각별이다 — 꼭짓점을 하나 건너뛰며 돌면 다섯
 * 선으로 제자리에 돌아온다. 그래서 펜을 떼지 않고 줄에서 별까지 이어 그을 수
 * 있다. 줄이 끝나는 자리를 별의 왼쪽 아래 꼭짓점으로 잡아, 별이 줄 위로
 * 솟게 두었다.
 *
 * 실타래로도 해 봤는데(그어 나가는 꼴, 한자리에서 감기는 꼴) 쓰는 손놀림으로
 * 읽히지 않아 접었다.
 */
const YARN = "M14 86 L152 86 L166.1 42.6 L180.2 86 L143.3 59.2 L188.9 59.2 L152 86";

export default function Waiting({ overlay = false }: { overlay?: boolean }) {
  const [보임, set보임] = useState(false);

  useEffect(() => {
    const 시계 = window.setTimeout(() => set보임(true), 300);
    return () => window.clearTimeout(시계);
  }, []);

  if (!보임) return null;

  return (
    <div className={`wait${overlay ? " wait--over" : ""}`} role="status" aria-live="polite">
      <svg className="wait__art" viewBox="0 0 202 96" aria-hidden="true">
        <path className="wait__line" pathLength={100} d={YARN} />
        {/* 닙 끝을 길 위에 얹는다. 틈과 숨구멍이 있어야 만년필로 읽힌다. */}
        <g className="wait__pen" style={{ offsetPath: `path("${YARN}")` }}>
          <g transform="rotate(26) scale(0.7)">
            {/* 펜대 — 아래가 굵고 위로 좁아지는 몸통. 잉크와 같은 빛깔이면
                그은 줄과 구분이 안 되므로 닙과 같은 빛깔로 채운다. */}
            <path className="wait__body" d="M-4.6 -33 L-4 -57 Q0 -61.5 4 -57 L4.6 -33 Z" />
            <path className="wait__nib" d="M0 0 L-9 -27 Q0 -36 9 -27 Z" />
            <path className="wait__slit" d="M0 0 V-21" />
            <circle className="wait__hole" cx="0" cy="-25" r="3" />
          </g>
        </g>
      </svg>
      <p className="wait__say">쓰는 중입니다.</p>
    </div>
  );
}
