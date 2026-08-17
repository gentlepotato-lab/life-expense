import type { GroupSummary } from "../../utils/dateGroup";

/** 날짜 단 머리말 — 날짜 · 건수 · 그날의 순합계(수입 − 지출) */
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

  // 가려진 항목이 섞여 있으면 합계로 금액이 드러나지 않도록 함께 가린다
  const title = hasMasked ? "금액이 가려진 항목이 포함되어 있습니다." : undefined;

  return (
    <div className="date-group__head">
      <span className="date-group__label">{label}</span>

      <span className="date-group__meta">
        <span className="date-group__count">{count}건</span>
        <span
          className={`date-group__sum ${sign} ${hasMasked ? "masked" : ""}`}
          title={title}
        >
          {prefix}
          {Math.abs(net).toLocaleString("ko-KR")}
        </span>
      </span>
    </div>
  );
}
