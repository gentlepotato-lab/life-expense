import { EntryCard } from "../Entries";
import DateGroupHeader from "./DateGroupHeader";
import { groupByDate } from "../../utils/dateGroup";
import { KIND_NAME, type GroupItem, type GroupKind } from "../../utils/groups";

/**
 * 내역 카드가 분류와 결제 수단 이름을 적는 데 쓰는 기준 자료.
 *
 * 세 화면이 저마다 조금씩 다른 모양으로 들고 있다(정기는 cat1_id를 쓰지
 * 않는다). 넘기는 쪽을 고치면 그 화면의 기존 동작을 건드리게 되므로,
 * 여기서 넉넉히 받고 카드에 넘길 때 한 모양으로 맞춘다.
 */
export type GroupMeta = {
  cat1List: { id: number; name: string }[];
  cat2List: { id: number; name: string; cat1_id?: number; blur?: number; inout?: number | null }[];
  payList: { code: string; name: string; category?: string }[];
};

/**
 * 묶음 팝업들이 함께 쓰는 내역 목록.
 *
 * 날짜 단 머리말과 내역 카드를 그대로 쓴다. 팝업이라고 다른 꼴로 그리면
 * 같은 내역이 화면마다 달라 보인다 — 네 내역 화면이 이미 이 짜임이다.
 * 정기 내역은 날짜가 없어 한 단으로 모인다("날짜 없음").
 */
export default function GroupItemList({
  items,
  meta,
  kind,
  picked,
  onTogglePick,
}: {
  items: GroupItem[];
  meta: GroupMeta;
  /** 어느 화면의 내역인지. 뜯었을 때 어디서 고치는지를 알리는 데 쓴다. */
  kind?: GroupKind;
  /** 고른 건들. 넘기지 않으면 고르기 상자가 서지 않는다. */
  picked?: Set<number>;
  onTogglePick?: (id: number) => void;
}) {
  const groups = groupByDate(items);

  /* 카드가 바라는 모양으로 맞춘다. 빠진 칸은 카드가 이름을 찾을 때만 쓰므로
     채워 넣어도 보이는 것이 달라지지 않는다. */
  const cat2List = meta.cat2List.map((c) => ({
    ...c,
    cat1_id: c.cat1_id ?? 0,
    inout: c.inout ?? null,
  }));

  return (
    <>
      {groups.map((group) => (
        <section key={group.date || "no-date"} className="date-group">
          <DateGroupHeader label={group.label} summary={group.summary} />
          {group.items.map((row) => (
            <EntryCard
              key={row.entry_id}
              row={row}
              cat1List={meta.cat1List}
              cat2List={cat2List}
              payList={meta.payList}
              /* 팝업에서는 꾹 눌러 고치지 않는다. 고치는 자리는 그 내역이
                 본래 서 있던 화면이다. */
              readOnly
              /* 여기서는 고치지 않으니, 뜯었을 때 뜨는 한 줄이 그 내역이
                 본래 선 화면을 가리킨다. */
              peelTip={kind ? `${KIND_NAME[kind]}에서 고칠 수 있습니다.` : undefined}
              onOpenEditor={() => {}}
              onStartReveal={() => {}}
              picked={picked ? picked.has(row.entry_id) : undefined}
              onTogglePick={onTogglePick}
              clipped={row.group_id != null}
            />
          ))}
        </section>
      ))}
    </>
  );
}
