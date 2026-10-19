import type { GroupSummary } from "../../utils/dateGroup";
import CollapseToggle from "./CollapseToggle";

export default function DateGroupHeader({
  label,
  summary,
  open,
  onToggle,
  hideSum = false,
}: {
  label: string;
  summary: GroupSummary;
  /** 그날의 카드가 펼쳐져 있는지. 넘기지 않으면 접기 기능 없이 그린다. */
  open?: boolean;
  onToggle?: () => void;
  /**
   * 합계를 접는다.
   *
   * 정기 내역의 `감춘 항목` 단이 쓴다. 안 나갈 돈이라 더하는 것이 뜻이
   * 없고, 숫자가 서 있으면 곧 빠져나갈 돈처럼 읽힌다.
   */
  hideSum?: boolean;
}) {
  const { count, net } = summary;

  const sign = net > 0 ? "plus" : net < 0 ? "minus" : "zero";
  const prefix = net > 0 ? "+" : net < 0 ? "−" : "";

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
        {/* 집계에는 테이프를 붙이지 않는다. 덮는 것은 개별 내역뿐이다. */}
        {!hideSum && (
          <span className={`date-group__sum ${sign}`}>
            {prefix}
            {Math.abs(net).toLocaleString("ko-KR")}
          </span>
        )}
      </span>
    </div>
  );
}
