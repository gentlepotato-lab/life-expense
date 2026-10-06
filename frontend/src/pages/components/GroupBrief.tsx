import GroupTap from "./GroupTap";
import { formatDateLabel } from "../../utils/dateGroup";
import type { EntryGroup } from "../../utils/groups";

/** 끝날은 해를 떼고 적는다 — 앞에 이미 해가 적혀 있다. */
function 짧게(d: string): string {
  const [, m, day] = d.split("-");
  return `${Number(m)}. ${Number(day)}.`;
}

/**
 * 접어 둔 묶음이 보이는 한 줄.
 *
 * 카드로 세우지 않는다. 카드로 두면 펼쳤을 때의 카드 목록과 생김새가 겹쳐,
 * 접은 것인지 펼친 것인지가 흐려진다. 기간 딱지 하나만 선다.
 */
export default function GroupBrief({
  group,
  onToggle,
  onOpen,
}: {
  group: EntryGroup;
  onToggle: () => void;
  onOpen: () => void;
}) {
  /* 기간 — 하루면 그 날, 여러 날이면 첫날부터 끝날까지. */
  const 기간 = !group.date_from
    ? "날짜 없음"
    : group.date_from === group.date_to
      ? formatDateLabel(group.date_from)
      : `${formatDateLabel(group.date_from)} ~ ${짧게(group.date_to!)}`;

  return (
    <GroupTap
      className="mk-brief"
      label={`묶음 ${group.name} 펼치기`}
      onToggle={onToggle}
      onOpen={onOpen}
    >
      {/* 날짜 딱지는 쓰기(beta)의 그것을 그대로 쓴다(.ws-tag--now). */}
      <span className="ws-tag ws-tag--now mk-brief__when">{기간}</span>
    </GroupTap>
  );
}
