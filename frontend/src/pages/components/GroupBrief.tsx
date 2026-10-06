import GroupTap from "./GroupTap";
import { formatDateLabel } from "../../utils/dateGroup";
import type { EntryGroup, GroupItem } from "../../utils/groups";

/**
 * 겹쳐 보일 장 수.
 *
 * 석 장에서 멈춘다. 담긴 건수만큼 겹치면 열 건짜리는 종이 뭉치가 되어 기간이
 * 묻히고, 두 건짜리와 스무 건짜리의 두께 차이도 거기서는 더 읽히지 않는다.
 * 건수는 머리말의 동그라미가 이미 정확히 적고 있다. 여기 겹은 "여러 장이
 * 집혀 있다"는 것만 말한다. 다만 한 건짜리는 한 장으로 둔다 — 한 장뿐인데
 * 겹쳐 보이면 적힌 건수와 어긋난다.
 */
function 겹칠장(건: number): number {
  return Math.min(3, Math.max(1, 건));
}

/** 맨 위 장에 곁들일 한마디. 카드가 먼저 적는 차례를 그대로 따른다. */
function 첫줄(it: GroupItem | undefined): string {
  if (!it) return "";
  return it.place_name || it.cat3_name || it.memo || "";
}

/**
 * 접어 둔 묶음이 보이는 자리.
 *
 * 집어 둔 종이 더미로 그린다. 기간 한 줄만 적어 두었더니 안에 무엇이
 * 들었는지 짐작할 거리가 없어, 펼쳐 볼 생각이 들지 않았다. 아래로 삐져나온
 * 가장자리가 "여러 장이 집혀 있다"를 글자 없이 말한다.
 *
 * 카드 목록으로 세우지는 않는다. 그러면 펼쳤을 때와 생김새가 겹쳐 접은
 * 것인지 펼친 것인지가 흐려진다. 여기 겹은 테와 모서리만 카드에서 빌려 올
 * 뿐 속을 적지 않는다.
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
  /* 기간 — 하루면 그 날, 여러 날이면 첫날부터 끝날까지. 두 끝을 같은 꼴로
     적는다. 끝날의 해와 요일을 떼어 보았더니 한 줄 안에서 두 날짜가 서로
     다른 꼴이 되어, 같은 기간의 두 끝으로 읽히지 않았다. */
  const 기간 = !group.date_from
    ? "날짜 없음"
    : group.date_from === group.date_to
      ? formatDateLabel(group.date_from)
      : `${formatDateLabel(group.date_from)} ~ ${formatDateLabel(group.date_to!)}`;

  const 장 = 겹칠장(group.count);
  const 한마디 = 첫줄(group.items[0]);

  return (
    <GroupTap
      className={`mk-brief mk-brief--${장}`}
      label={`묶음 ${group.name} 펼치기`}
      onToggle={onToggle}
      onOpen={onOpen}
    >
      <span className="mk-stack">
        {장 >= 3 && <span className="mk-stack__leaf mk-stack__leaf--back" aria-hidden="true" />}
        {장 >= 2 && <span className="mk-stack__leaf mk-stack__leaf--mid" aria-hidden="true" />}
        <span className="mk-stack__leaf mk-stack__leaf--top">
          <span className="mk-stack__when">{기간}</span>
          {한마디 && <span className="mk-stack__what">{한마디}</span>}
        </span>
      </span>
    </GroupTap>
  );
}
