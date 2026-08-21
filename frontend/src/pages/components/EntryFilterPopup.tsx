import { useCallback, useEffect, useMemo } from "react";
import useBackClose from "../../hooks/useBackClose";
import MultiSelect from "./MultiSelect";
import SingleSelect from "./SingleSelect";
import { EditField, EditDivider } from "./CardEditModal";
import { visible } from "../../utils/visible";
import { EMPTY_FILTER, type Filter } from "../../utils/calendarFilter";

/**
 * 날짜를 뺀 걸러 내기 팝업.
 *
 * 달력과 씀씀이가 똑같은 조건을 쓴다. 같은 것을 두 벌 만들어 두면
 * 언젠가 한쪽만 고쳐져 서로 달라지므로 여기 한 자리에 둔다.
 *
 * 목록은 밖에서 받는다 — 부르는 쪽이 이미 받아 둔 것들이라
 * 여기서 다시 부르면 같은 것을 두 번 묻게 된다.
 */

/** [전체] 항목이 쓰는 값 — 실제 id 와 겹치지 않는다 */
const ALL = -1;

/** "(식비 전체)" 처럼 한 부모의 자식을 통째로 집는 항목의 값.
    실제 id 와 겹치지 않도록 −1000 아래로 내려 둔다 — 내역 세 화면과 같은 규칙이다. */
const parentAll = (id: number) => -(1000 + id);
const parentOf = (v: number) => -(v + 1000);

type Cat1 = { id: number; name: string; is_active?: number };
type Cat2 = { id: number; name: string; cat1_id: number; blur?: number; is_active?: number };
type Cat3 = { id: number; name: string; cat2_id: number; is_active?: number };
type Pay = { code: string; name: string; is_active?: number };
type Cp = { counterpart_id: number; name: string };

export default function EntryFilterPopup({
  filter,
  setFilter,
  cat1List,
  cat2List,
  cat3List,
  payList,
  cpList,
  onClose,
  onApply,
  showInout = true,
}: {
  filter: Filter;
  setFilter: React.Dispatch<React.SetStateAction<Filter>>;
  cat1List: Cat1[];
  cat2List: Cat2[];
  cat3List: Cat3[];
  payList: Pay[];
  cpList: Cp[];
  /** 적용하지 않고 닫을 때 — 고치던 값을 되돌리는 것은 부르는 쪽 몫이다 */
  onClose: () => void;
  onApply: () => void;
  /** IN/OUT 칸을 둘지. 씀씀이는 나가는 돈만 다루므로 고를 것이 없다 */
  showInout?: boolean;
}) {
  useBackClose(true, onClose);

  useEffect(() => {
    document.documentElement.classList.add("modal-open");
    return () => document.documentElement.classList.remove("modal-open");
  }, []);

  /* 고르기 목록 — 상위에서 고른 것만 아래로 좁힌다.
     맨 위의 [전체]는 지출·대기 내역 필터와 같은 방식으로 다룬다 —
     누르면 전부 켜지고, 이미 전부 켜져 있으면 전부 꺼진다. */
  const cat1Pool = useMemo(() => visible(cat1List), [cat1List]);
  const payPool = useMemo(() => visible(payList), [payList]);

  /* 고른 중분류의 소분류만. 고른 것이 없으면 목록은 비운다 —
     상위를 고르기 전에 아래 갈래를 늘어놓으면 어디에 딸린 것인지 알 수 없다.
     내역 세 화면의 필터와 같은 짜임이다. */
  const cat2Pool = useMemo(
    () =>
      filter.cat1.length
        ? visible(cat2List.filter((c) => filter.cat1.includes(c.cat1_id)))
        : [],
    [cat2List, filter.cat1]
  );
  const cat3Pool = useMemo(
    () =>
      filter.cat2.length
        ? visible(cat3List.filter((c) => filter.cat2.includes(c.cat2_id)))
        : [],
    [cat3List, filter.cat2]
  );

  /** 부모별로 "(부모 전체)" 를 앞세우고 그 자식을 잇는다 */
  function nested<P extends { id: number; name: string }>(
    parentIds: number[],
    parents: P[],
    childrenOf: (id: number) => { id: number; name: string }[]
  ) {
    if (!parentIds.length) return [];
    const out: { value: number; label: string }[] = [{ value: ALL, label: "[전체]" }];
    parentIds.forEach((pid) => {
      const parent = parents.find((p) => p.id === pid);
      if (!parent) return;
      out.push({ value: parentAll(pid), label: `(${parent.name} 전체)` });
      childrenOf(pid).forEach((c) => out.push({ value: c.id, label: c.name }));
    });
    return out;
  }

  const cat1Options = useMemo(
    () => [{ value: ALL, label: "[전체]" }, ...cat1Pool.map((c) => ({ value: c.id, label: c.name }))],
    [cat1Pool]
  );
  const cat2Options = useMemo(
    () =>
      nested(filter.cat1, cat1List, (pid) =>
        visible(cat2List.filter((c) => c.cat1_id === pid))
      ),
    [filter.cat1, cat1List, cat2List]
  );
  const cat3Options = useMemo(
    () =>
      nested(filter.cat2, cat2List, (pid) =>
        visible(cat3List.filter((c) => c.cat2_id === pid))
      ),
    [filter.cat2, cat2List, cat3List]
  );
  const payOptions = useMemo(
    () => [{ value: "__ALL__", label: "[전체]" }, ...payPool.map((p) => ({ value: p.code, label: p.name }))],
    [payPool]
  );
  const cpOptions = useMemo(
    () => [{ value: ALL, label: "[전체]" }, ...cpList.map((c) => ({ value: c.counterpart_id, label: c.name }))],
    [cpList]
  );

  /** [전체]를 눌렀을 때 — 전부 켜거나 전부 끈다 */
  const toggleAll = useCallback(
    <T,>(key: keyof Filter, all: T[]) =>
      (v: T | number) => {
        if (v !== ALL && v !== "__ALL__") return false;
        setFilter((prev) => {
          const cur = prev[key] as unknown as T[];
          const next = cur.length === all.length ? [] : all;
          /* 상위를 바꾸면 아래 갈래의 선택은 비운다 — 다른 화면과 같다 */
          if (key === "cat1") return { ...prev, cat1: next as number[], cat2: [], cat3: [] };
          if (key === "cat2") return { ...prev, cat2: next as number[], cat3: [] };
          return { ...prev, [key]: next } as Filter;
        });
        return true;
      },
    [setFilter]
  );

  const isAllChecked = useCallback(
    <T,>(key: keyof Filter, all: T[]) =>
      (v: T | number) => {
        const cur = filter[key] as unknown as T[];
        if (v === ALL || v === "__ALL__") return cur.length === all.length && all.length > 0;
        return cur.includes(v as T);
      },
    [filter]
  );

  /* 소분류 · 세분류는 [전체] 말고 "(부모 전체)" 도 함께 다룬다.
     그 항목을 누르면 그 부모에 딸린 것만 통째로 켜지고 꺼진다. */
  const cat2Children = useCallback(
    (pid: number) => visible(cat2List.filter((c) => c.cat1_id === pid)).map((c) => c.id),
    [cat2List]
  );
  const cat3Children = useCallback(
    (pid: number) => visible(cat3List.filter((c) => c.cat2_id === pid)).map((c) => c.id),
    [cat3List]
  );

  const nestedSpecial = useCallback(
    (key: "cat2" | "cat3", pool: { id: number }[], childrenOf: (pid: number) => number[]) =>
      (v: number) => {
        if (v === ALL) {
          const all = pool.map((c) => c.id);
          setFilter((prev) => ({
            ...prev,
            [key]: (prev[key] as number[]).length === all.length ? [] : all,
          }));
          return true;
        }
        if (v <= -1000) {
          const ids = childrenOf(parentOf(v));
          setFilter((prev) => {
            const cur = prev[key] as number[];
            const on = ids.length > 0 && ids.every((id) => cur.includes(id));
            return {
              ...prev,
              [key]: on
                ? cur.filter((id) => !ids.includes(id))
                : Array.from(new Set([...cur, ...ids])),
            };
          });
          return true;
        }
        return false;
      },
    [setFilter]
  );

  const nestedChecked = useCallback(
    (key: "cat2" | "cat3", pool: { id: number }[], childrenOf: (pid: number) => number[]) =>
      (v: number) => {
        const cur = filter[key] as number[];
        if (v === ALL) return pool.length > 0 && cur.length === pool.length;
        if (v <= -1000) {
          const ids = childrenOf(parentOf(v));
          return ids.length > 0 && ids.every((id) => cur.includes(id));
        }
        return cur.includes(v);
      },
    [filter]
  );

  /** 고르기 값에서 가짜 항목([전체] · (부모 전체))은 걸러 낸다 */
  const realIds = (v: number[]) => v.filter((x) => x > 0);

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel popup-panel--framed"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="popup-head">
          <h3 className="popup-head__title">필터</h3>
        </header>

        <div className="popup-body edit-grid">
          <EditField label="중분류" span={4}>
            <MultiSelect
              options={cat1Options}
              selected={filter.cat1}
              onSpecialClick={toggleAll("cat1", cat1Pool.map((c) => c.id))}
              isOptionChecked={isAllChecked("cat1", cat1Pool.map((c) => c.id))}
              onChange={(v: number[]) => setFilter({ ...filter, cat1: v })}
              placeholder="(전체)"
            />
          </EditField>

          <EditField label="소분류" span={4}>
            <MultiSelect
              options={cat2Options}
              selected={filter.cat2}
              onSpecialClick={nestedSpecial("cat2", cat2Pool, cat2Children)}
              isOptionChecked={nestedChecked("cat2", cat2Pool, cat2Children)}
              onChange={(v: number[]) => setFilter({ ...filter, cat2: realIds(v) })}
              placeholder="(전체)"
            />
          </EditField>

          <EditField label="세분류" span={4}>
            <MultiSelect
              options={cat3Options}
              selected={filter.cat3}
              onSpecialClick={nestedSpecial("cat3", cat3Pool, cat3Children)}
              isOptionChecked={nestedChecked("cat3", cat3Pool, cat3Children)}
              onChange={(v: number[]) => setFilter({ ...filter, cat3: realIds(v) })}
              placeholder="(전체)"
            />
          </EditField>

          <EditDivider />

          {showInout && (
            <EditField label="IN/OUT" span={6}>
              <SingleSelect
                options={[
                  { value: "0", label: "(전체)" },
                  { value: "-1", label: "OUT(−)" },
                  { value: "1", label: "IN(+)" },
                ]}
                selected={String(filter.inout)}
                onChange={(v) => setFilter({ ...filter, inout: Number(v) })}
                placeholder="(전체)"
              />
            </EditField>
          )}

          {/* IN/OUT 이 빠지면 혼자 남으므로 줄을 다 쓴다 */}
          <EditField label="결제 수단" span={showInout ? 6 : 12}>
            <MultiSelect
              options={payOptions}
              selected={filter.pay}
              onSpecialClick={toggleAll("pay", payPool.map((p) => p.code))}
              isOptionChecked={isAllChecked("pay", payPool.map((p) => p.code))}
              onChange={(v: string[]) => setFilter({ ...filter, pay: v })}
              placeholder="(전체)"
            />
          </EditField>

          <EditField label="금액" span={12}>
            <div className="filter-range">
              <input
                type="number"
                className="amount-input"
                value={filter.amountMin}
                placeholder="(최소)"
                onChange={(e) => setFilter({ ...filter, amountMin: e.target.value })}
              />
              <span className="filter-range__tilde">~</span>
              <input
                type="number"
                className="amount-input"
                value={filter.amountMax}
                placeholder="(최대)"
                onChange={(e) => setFilter({ ...filter, amountMax: e.target.value })}
              />
            </div>
          </EditField>

          <EditDivider />

          <EditField label="장소" span={6}>
            <input
              type="text"
              value={filter.place}
              placeholder="(장소)"
              onChange={(e) => setFilter({ ...filter, place: e.target.value })}
            />
          </EditField>

          <EditField label="함께한 상대" span={6}>
            <MultiSelect
              options={cpOptions}
              selected={filter.cp}
              onSpecialClick={toggleAll("cp", cpList.map((c) => c.counterpart_id))}
              isOptionChecked={isAllChecked("cp", cpList.map((c) => c.counterpart_id))}
              onChange={(v: number[]) => setFilter({ ...filter, cp: v })}
              placeholder="(전체)"
            />
          </EditField>

          <EditField label="메모" span={12}>
            <input
              type="text"
              value={filter.memo}
              placeholder="(메모)"
              onChange={(e) => setFilter({ ...filter, memo: e.target.value })}
            />
          </EditField>
        </div>

        <div className="btn-row popup-foot">
          <button className="ui-btn" onClick={() => setFilter(EMPTY_FILTER)}>
            초기화
          </button>
          <button className="ui-btn primary" onClick={onApply}>
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
