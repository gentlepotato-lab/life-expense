import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "../api/client";
import DateGroupHeader from "./components/DateGroupHeader";
import GroupPopup from "./components/GroupPopup";
import GroupFilterPopup from "./components/GroupFilterPopup";
import {
  EMPTY_GROUP_FILTER,
  hasGroupCondition,
  type GroupFilter,
} from "../utils/groupFilter";
import EntryEditHost, { type EditMeta } from "./components/EntryEditHost";
import MemoPad from "./components/MemoPad";
import PickBar from "./components/PickBar";
import QuickActions from "./components/QuickActions";
import GroupBrief from "./components/GroupBrief";
import GroupTap from "./components/GroupTap";
import GroupHead from "./components/GroupHead";
import ReceiptPopup from "./components/ReceiptPopup";
import type { ReceiptRow } from "../utils/receipt";
import { CollapseAllButtons } from "./components/CollapseToggle";
import { EntryCard } from "./Entries";
import type { GroupMeta } from "./components/GroupItemList";
import { groupByDate } from "../utils/dateGroup";
import { type EntryGroup, type GroupItem, type GroupKind } from "../utils/groups";
import { say } from "../utils/notify";
import { apiErrorMessage } from "../utils/apiError";

/** 이번 달 'YYYY-MM' */
function ymNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 묶음 내역.
 *
 * 지출 내역과 한 짜임이다. 달 이동 줄도, 모두 펼치기와 접기도, 날짜 단
 * 머리말도, 내역 카드도 그대로 쓴다. 다른 것은 날짜 단을 묶음이 한 겹 더
 * 싸고 있다는 것뿐이다.
 *
 * 묶음은 세 화면(지출, 대기, 정기)에서 저마다 만들어지는데, 보는 자리는 여기
 * 하나다. 갈래를 나눠 탭을 더 두지 않는다 — 한 화면에 탭이 둘이면 어느 쪽이
 * 무엇을 가르는지 헷갈린다.
 *
 * 달 이동은 걸친 달로 고른다. 담긴 내역의 첫날과 끝날 사이에 그 달이 들면
 * 보인다. 그래서 날이 걸쳐 있는 여행은 시작한 달과 끝난 달 모두에서 보인다.
 * 정기 묶음은 날짜가 없어 달과 상관없이 늘 보인다.
 */
export default function EntryGroups() {
  const [yearMonth, setYearMonth] = useState(ymNow);
  const [groups, setGroups] = useState<EntryGroup[]>([]);
  const [ready, setReady] = useState(false);
  /* 펼쳐 둔 묶음. 비어 있으면 모두 접힌 것이다 — 묶음 내역은 접힌 채로
     연다. 묶음이 여럿이면 저마다 날짜 단과 카드를 거느려, 다 펼쳐 두면
     무엇이 몇 개인지가 한 화면에 안 들어온다. 접으면 더미 한 장씩이라
     훑기 쉽고, 볼 것만 펼친다. */
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [openId, setOpenId] = useState<number | null>(null);
  /* 꾹 눌러 편집을 열면 손을 뗄 때 click이 뒤따라 온다. 그대로 두면 편집
     팝업이 뜨면서 뒤에서 묶음이 접힌다. 한 번만 삼킨다. */
  const 방금편집 = useRef(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  /* 팝업에서 고치는 중인 값과 실제로 걸려 있는 값을 나눠 둔다. 하나로 두면
     [적용]을 누르기도 전에 뒤 화면이 먼저 바뀐다 — 지출 내역과 같은 짜임이다. */
  const [filter, setFilter] = useState<GroupFilter>(EMPTY_GROUP_FILTER);
  const [applied, setApplied] = useState<GroupFilter>(EMPTY_GROUP_FILTER);
  /* 꾹 눌러 고치는 중인 한 건. 어느 갈래인지는 담긴 묶음이 안다. */
  const [editing, setEditing] = useState<{ kind: GroupKind; row: GroupItem } | null>(null);

  const [cat1List, setCat1List] = useState<{ id: number; name: string }[]>([]);
  const [cat2List, setCat2List] = useState<
    { id: number; name: string; cat1_id: number; blur?: number; inout: number | null }[]
  >([]);
  const [cat3List, setCat3List] = useState<{ id: number; name: string; cat2_id: number }[]>([]);
  const [payList, setPayList] = useState<{ code: string; name: string; category?: string }[]>([]);

  /* 기준 자료 — 카드가 분류와 결제 수단 이름을 적는 데 쓴다. */
  useEffect(() => {
    const 메타실패 = () => say.warn("기준 자료를 불러오지 못했습니다. 새로 고쳐 주세요.");
    Promise.all([
      axios.get("/categories/lvl1"),
      axios.get("/categories/lvl2"),
      axios.get("/categories/lvl3"),
      axios.get("/payment-methods"),
    ])
      .then(([c1, c2, c3, pm]) => {
        setCat1List(c1.data);
        setCat2List(c2.data);
        setCat3List(c3.data);
        setPayList(
          pm.data.map((p: { method_id: number; method_name: string; category?: string }) => ({
            code: String(p.method_id),
            name: p.method_name,
            category: p.category,
          }))
        );
      })
      .catch(메타실패);
  }, []);

  const 걸림 = useMemo(() => hasGroupCondition(applied), [applied]);

  const load = useCallback(() => {
    setReady(false);
    /* 거는 조건이 있으면 달은 보내지 않는다. 달 단위를 넘어 보려고 거는 것이다. */
    const 공통 = 걸림
      ? {
          date_from: applied.dateFrom || undefined,
          date_to: applied.dateTo || undefined,
          name: applied.name.trim() || undefined,
          memo: applied.memo.trim() || undefined,
        }
      : { ym: yearMonth };
    /* 세 갈래를 함께 받는다. 보는 자리가 하나라 한 번에 다 있어야 한다. */
    Promise.all([
      axios.get("/entry-groups", { params: { kind: "entry", ...공통 } }),
      axios.get("/entry-groups", { params: { kind: "pending", ...공통 } }),
      axios.get("/entry-groups", { params: { kind: "scheduled", ...공통 } }),
    ])
      .then(([a, b, c]) => setGroups([...a.data, ...b.data, ...c.data]))
      .catch((err: unknown) => {
        setGroups([]);
        say.warn(apiErrorMessage(err, "묶음을 불러오지 못했습니다."));
      })
      .finally(() => setReady(true));
  }, [yearMonth, 걸림, applied]);

  useEffect(load, [load]);

  const shiftMonth = (step: number) => {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + step, 1);
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const monthLabel = `${Number(yearMonth.slice(0, 4))}년 ${Number(yearMonth.slice(5, 7))}월`;

  /* 걸린 기간을 적는 한 줄. 지출 내역이 적는 꼴과 같다. */
  const rangeLabel = useMemo(() => {
    const 날 = (v: string) => new Date(v).toLocaleDateString("ko-KR");
    if (applied.dateFrom && applied.dateTo) return `${날(applied.dateFrom)} ~ ${날(applied.dateTo)}`;
    if (applied.dateFrom) return `${날(applied.dateFrom)} ~ `;
    if (applied.dateTo) return ` ~ ${날(applied.dateTo)}`;
    return "";
  }, [applied]);

  const meta: GroupMeta = useMemo(
    () => ({ cat1List, cat2List, payList }),
    [cat1List, cat2List, payList]
  );

  const editMeta: EditMeta = useMemo(
    () => ({ cat1List, cat2List, cat3List, payList }),
    [cat1List, cat2List, cat3List, payList]
  );

  const toggleGroup = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const togglePick = (id: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* 영수증은 고른 묶음에 담긴 내역을 모두 모아 끊는다. 지출 내역의 영수증과
     같은 꼴이라, 받는 쪽이 쓰는 모양으로 맞춰 넘긴다. */
  const receiptRows = useMemo(() => {
    const cat1 = new Map(cat1List.map((c) => [c.id, c.name]));
    const cat2 = new Map(cat2List.map((c) => [c.id, c.name]));
    const cat3 = new Map(cat3List.map((c) => [c.id, c.name]));
    const pay = new Map(payList.map((p) => [String(p.code), p.name]));
    const 갈래이름: Record<string, ReceiptRow["src"]> = {
      entry: "지출",
      pending: "대기",
      scheduled: "정기",
    };
    const rows: ReceiptRow[] = [];
    for (const g of groups) {
      if (!picked.has(g.group_id)) continue;
      for (const r of g.items) {
        rows.push({
          key: `${g.kind}-${r.entry_id}`,
          src: 갈래이름[g.kind],
          date: r.tx_date ?? "",
          cat: [cat1.get(r.cat1_id ?? -1), cat2.get(r.cat2_id ?? -1), cat3.get(r.cat3_id ?? -1)]
            .filter(Boolean)
            .join(" > "),
          place: r.place_name ?? "",
          pay: pay.get(String(r.pay_method ?? "")) ?? "",
          amount: Number(r.net_amount ?? r.amount),
          inout: r.inout,
        });
      }
    }
    return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [groups, picked, cat1List, cat2List, cat3List, payList]);

  const opened = groups.find((g) => g.group_id === openId) ?? null;

  return (
    <div className="page-wrap">
      <div className="toolbar-wrap">
        <div className="toolbar">
          {/* 조건이 걸리면 달 단위가 아니므로 달 넘기기를 감춘다.
              지출 내역과 같은 자리, 같은 꼴이다. */}
          {걸림 ? (
            <div className="filter-range-label">{rangeLabel || "전체 기간"}</div>
          ) : (
            <div className="month-nav">
              <button
                type="button"
                className="month-nav__arrow"
                aria-label="지난달"
                onClick={() => shiftMonth(-1)}
              >
                ‹
              </button>
              <span className="month-nav__label">{monthLabel}</span>
              <button
                type="button"
                className="month-nav__arrow"
                aria-label="다음 달"
                onClick={() => shiftMonth(1)}
              >
                ›
              </button>
            </div>
          )}

          <div className="toolbar-btns">
            <CollapseAllButtons
              onExpandAll={() => setExpanded(new Set(groups.map((g) => g.group_id)))}
              onCollapseAll={() => setExpanded(new Set())}
            />
            <button
              type="button"
              onClick={() => {
                setFilter(applied);
                setFilterOpen(true);
              }}
              className={`filter-pill${걸림 ? " on" : ""}`}
              aria-pressed={걸림}
              title={걸림 ? "필터가 걸려 있다. 눌러서 고친다." : "필터"}
            >
              필터
            </button>
          </div>
        </div>
      </div>

      <div className="card-list">
        {!ready && <p className="page-empty">불러오는 중입니다.</p>}
        {ready && groups.length === 0 && (
          <p className="page-empty">묶은 내역이 없습니다.</p>
        )}

        {groups.map((group) => {
          const open = expanded.has(group.group_id);
          return (
            <section key={group.group_id} className="date-group mk-group">
              {/* 머리말은 접든 펼치든 늘 그 자리다. 접고 펼 때 생김새가
                  통째로 바뀌면 목록이 흔들린다. 바뀌는 것은 그 아래뿐이다 —
                  접었을 때는 기간 한 줄, 펼쳤을 때는 날짜 단과 카드. */}
              <GroupHead
                group={group}
                open={open}
                onToggle={() => toggleGroup(group.group_id)}
                onOpen={() => setOpenId(group.group_id)}
                picked={picked.has(group.group_id)}
                onTogglePick={() => togglePick(group.group_id)}
              />

              {/* 메모도 묶음을 가리키는 자리다 — 머리말과 같게 눌린다. */}
              <GroupTap
                className="mk-memo"
                label={open ? `묶음 ${group.name} 접기` : `묶음 ${group.name} 펼치기`}
                onToggle={() => toggleGroup(group.group_id)}
                onOpen={() => setOpenId(group.group_id)}
              >
                <MemoPad memo={group.memo} />
              </GroupTap>

              {group.items.length === 0
                ? open && <p className="page-empty">담긴 내역이 없습니다.</p>
                : !open && (
                    <GroupBrief
                      group={group}
                      onToggle={() => toggleGroup(group.group_id)}
                      onOpen={() => setOpenId(group.group_id)}
                    />
                  )}

              {/* 펼친 몸통은 점선 난간이 왼쪽에서 받친다. 날짜 단이 여럿
                  서면 어디까지가 한 묶음인지 눈으로 잡히지 않는다. */}
              {open && (
                <div className="mk-body">
                  {groupByDate(group.items as GroupItem[]).map((day) => (
                  <section key={day.date || "no-date"} className="date-group">
                    <DateGroupHeader label={day.label} summary={day.summary} />
                    {day.items.map((row) => (
                      <EntryCard
                        key={row.entry_id}
                        row={row}
                        cat1List={cat1List}
                        cat2List={cat2List}
                        payList={payList}
                        clipped
                        /* 정기는 여기서 고치지 않는다. 한 건이 아니라 앞으로 계속 올
                           약속이라, 주기와 휴일 처리와 끝 달과 감추기를 함께
                           봐야 고친 뜻이 온전해진다. 그 자리는 정기 내역 한
                           곳으로 둔다. */
                        readOnly={group.kind === "scheduled"}
                        onOpenEditor={(r) => {
                          if (group.kind === "scheduled") return;
                          방금편집.current = true;
                          setEditing({ kind: group.kind, row: r });
                        }}
                        /* 펼친 묶음은 카드를 눌러도 접힌다 — 펼친 자리에서
                           손이 가장 먼저 닿는 곳이 카드다. */
                        onTap={() => {
                          if (방금편집.current) {
                            방금편집.current = false;
                            return;
                          }
                          toggleGroup(group.group_id);
                        }}
                        onStartReveal={() => {}}
                      />
                    ))}
                    </section>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <PickBar
        count={picked.size}
        all={groups.length}
        onAll={() => setPicked(new Set(groups.map((g) => g.group_id)))}
        onClear={() => setPicked(new Set())}
        onReceipt={() => setReceiptOpen(true)}
        unit="묶음"
      />

      {receiptOpen && (
        <ReceiptPopup rows={receiptRows} onClose={() => setReceiptOpen(false)} />
      )}

      {opened && (
        <GroupPopup
          group={opened}
          meta={meta}
          ym={yearMonth}
          onChanged={load}
          onClose={() => setOpenId(null)}
        />
      )}

      {filterOpen && (
        <GroupFilterPopup
          filter={filter}
          setFilter={setFilter}
          onClose={() => setFilterOpen(false)}
          onApply={() => {
            setApplied(filter);
            setFilterOpen(false);
          }}
        />
      )}

      {editing && (
        <EntryEditHost
          kind={editing.kind}
          row={editing.row}
          meta={editMeta}
          onSaved={load}
          onClose={() => setEditing(null)}
        />
      )}

      <QuickActions onSaved={load} />
    </div>
  );
}
