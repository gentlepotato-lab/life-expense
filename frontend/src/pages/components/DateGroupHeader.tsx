import { useState } from "react";
import type { GroupSummary } from "../../utils/dateGroup";
import useRevealDrag from "../../hooks/useRevealDrag";

export default function DateGroupHeader({
  label,
  summary,
}: {
  label: string;
  summary: GroupSummary;
}) {
  const { count, net, hasMasked } = summary;

  const sign = net > 0 ? "plus" : net < 0 ? "minus" : "zero";
  const prefix = net > 0 ? "+" : net < 0 ? "−" : "";

  /* 가려진 항목이 섞여 있으면 합계로 금액이 드러나지 않도록 함께 가린다.
     카드와 마찬가지로 끌면 잠깐 보인다 — 전에는 가리기만 하고 끌 수 없었다. */
  const [revealed, setRevealed] = useState(false);
  const startReveal = useRevealDrag(setRevealed);

  const masked = hasMasked && !revealed;

  return (
    <div className="date-group__head">
      <span className="date-group__label">{label}</span>
      {/* 건수는 날짜 바로 옆에 붙인다. 합계 옆에 끼어 있으면 어느 쪽에도
          속하지 않은 채 떠 보인다. 모양은 설정 화면의 항목 수 배지와 같다 */}
      <span className="date-group__count" title={`${count}건`}>
        {count}
      </span>

      <span className="date-group__meta">
        <span
          className={`date-group__sum ${sign} ${masked ? "masked" : "revealed"}`}
          title={hasMasked ? "끌면 잠깐 보인다." : undefined}
          onMouseDown={hasMasked ? startReveal : undefined}
          onTouchStart={hasMasked ? startReveal : undefined}
        >
          {prefix}
          {Math.abs(net).toLocaleString("ko-KR")}
        </span>
      </span>
    </div>
  );
}
