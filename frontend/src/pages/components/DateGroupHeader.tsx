import { useState } from "react";
import type { GroupSummary } from "../../utils/dateGroup";
import useRevealDrag from "../../hooks/useRevealDrag";
import CollapseToggle from "./CollapseToggle";

export default function DateGroupHeader({
  label,
  summary,
  open,
  onToggle,
}: {
  label: string;
  summary: GroupSummary;
  /** 그날의 카드가 펼쳐져 있는지. 넘기지 않으면 접기 기능 없이 그린다. */
  open?: boolean;
  onToggle?: () => void;
}) {
  const { count, net, hasMasked } = summary;

  const sign = net > 0 ? "plus" : net < 0 ? "minus" : "zero";
  const prefix = net > 0 ? "+" : net < 0 ? "−" : "";

  /* 가려진 항목이 섞여 있으면 합계로 금액이 드러나지 않도록 함께 가린다.
     카드와 마찬가지로 끌면 잠깐 보인다. */
  const [revealed, setRevealed] = useState(false);
  const startReveal = useRevealDrag(setRevealed);

  const masked = hasMasked && !revealed;
  const collapsible = onToggle !== undefined;

  return (
    <div className={`date-group__head${collapsible ? " is-collapsible" : ""}`}>
      {/* 접기 손잡이는 날짜 앞에 둔다. 카드마다 두면 카드 왼쪽에 빈 칸이
          늘 생기지만, 단 머리말은 한 날에 하나뿐이라 자리를 거의 안 먹는다. */}
      {collapsible && (
        <CollapseToggle open={!!open} onToggle={onToggle} label={label} />
      )}

      {/* 날짜를 눌러도 접힌다 — 손가락으로 겨누기 쉬운 넓은 자리 */}
      <span
        className="date-group__label"
        onClick={collapsible ? onToggle : undefined}
        role={collapsible ? "button" : undefined}
      >
        {label}
      </span>
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
