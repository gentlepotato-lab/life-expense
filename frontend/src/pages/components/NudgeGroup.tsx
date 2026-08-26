import { useState } from "react";
import useLongPress from "../../hooks/useLongPress";
import useRevealDrag from "../../hooks/useRevealDrag";
import type { Nudge } from "../../utils/nudges";

/**
 * 잔소리 한 묶음 — 이름표와 그 아래 줄들.
 *
 * 잔소리 화면과 종 단추 팝업이 같은 모습이어야 해서 여기 한 벌만 둔다.
 * 화면 쪽은 이것을 그림 칸(.chart-card)으로 감싸고, 팝업은 그대로 쓴다.
 *
 * onPick 을 주면 줄을 꾹 눌러 상세를 펼 수 있다. 종 단추 팝업은 이미 팝업
 * 안이라 더 파고들 자리가 없어 넘기지 않는다.
 */
export default function NudgeGroup({
  title,
  list,
  onPick,
}: {
  title: string;
  list: Nudge[];
  onPick?: (n: Nudge) => void;
}) {
  return (
    <>
      <header className="chart-card__head nudge-head">
        <h3 className="chart-card__title">{title}</h3>
        {/* 항목 수는 내역 · 분류와 같은 알약으로. 숫자만 적는다 */}
        <span className="nudge-count" title={`${list.length}가지`}>
          {list.length}
        </span>
      </header>
      <div className="nudge-list">
        {list.map((n) => (
          <NudgeLine key={n.key} nudge={n} onPick={onPick} />
        ))}
      </div>
    </>
  );
}

/** 한 줄. 왼쪽 색 막대는 내역 카드가 쓰던 어법 그대로다 */
function NudgeLine({ nudge, onPick }: { nudge: Nudge; onPick?: (n: Nudge) => void }) {
  /* 가려 둔 갈래가 섞이면 테이프를 붙인다. 옆으로 끌면 잠깐 걷힌다 —
     내역 카드의 금액과 같은 손놀림이다. */
  const [revealed, setRevealed] = useState(false);
  const onDrag = useRevealDrag(setRevealed);
  const { pressing, handlers } = useLongPress(() => onPick?.(nudge), {
    disabled: !onPick || !nudge.items?.length,
  });

  const taped = !!nudge.blur && !revealed;

  return (
    <article
      className={
        `nudge nudge--${nudge.level}` +
        (nudge.blur ? " nudge--taped" : "") +
        (revealed ? " is-revealed" : "") +
        (pressing ? " is-pressing" : "")
      }
      {...handlers}
    >
      <span className="nudge__bar" aria-hidden="true" />
      <div
        className="nudge__body"
        onMouseDown={nudge.blur ? onDrag : undefined}
        onTouchStart={nudge.blur ? onDrag : undefined}
      >
        <p className="nudge__say">{nudge.say}</p>
        {nudge.meta && <p className="nudge__meta">{nudge.meta}</p>}
        {taped && <span className="nudge__tape" aria-hidden="true" />}
      </div>
    </article>
  );
}
