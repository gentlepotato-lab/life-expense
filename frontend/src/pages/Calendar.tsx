import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../api/client";
import useBackClose from "../hooks/useBackClose";
import CalculatorPopup from "./components/CalculatorPopup";
import MultiSelect from "./components/MultiSelect";
import SingleSelect from "./components/SingleSelect";
import { EditField, EditDivider } from "./components/CardEditModal";
import { visible } from "../utils/visible";
import {
  EMPTY_FILTER,
  hasCondition,
  pass,
  type Filter,
  type Row,
  type Src,
} from "../utils/calendarFilter";

/**
 * 달력.
 *
 * 지출 내역이 카드로 훑는 화면이라면, 여기는 한 달을 한눈에 보는 화면이다.
 * 그래서 기간 조건이 없다 — 달력은 늘 한 달치다.
 *
 * 지출 · 대기 · 정기 세 가지를 겹쳐 볼 수 있다. 날짜의 기준은 각각
 * 지출·대기는 거래일(tx_date), 정기는 다음 예정일(next_run_at)이다.
 */

const SOURCES: { key: Src; label: string }[] = [
  { key: "expense", label: "지출" },
  { key: "pending", label: "대기" },
  { key: "scheduled", label: "정기" },
];

/** [전체] 항목이 쓰는 값 — 실제 id 와 겹치지 않는다 */
const ALL = -1;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-08-17" 의 날짜 부분만 숫자로 */
function dayOf(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(v);
  return m ? Number(m[2]) : null;
}

export default function Calendar() {
  const [yearMonth, setYearMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  /* 겹쳐 볼 자료 — 처음에는 셋 다 켠다 */
  const [on, setOn] = useState<Record<Src, boolean>>({
    expense: true,
    pending: true,
    scheduled: true,
  });

  const [rows, setRows] = useState<Row[]>([]);

  /* 눌러서 고른 기간.
     한 번 누르면 시작일만 잡히고(end === null), 한 번 더 누르면 끝일까지 잡힌다.
     시작일만 잡힌 상태에서 같은 날 또는 달력 바깥을 누르면 고르기를 접는다. */
  const [pick, setPick] = useState<{ start: number; end: number | null } | null>(null);
  const calRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [appliedFilter, setAppliedFilter] = useState<Filter>(EMPTY_FILTER);

  /* 고르는 목록들 */
  const [cat1List, setCat1List] = useState<{ id: number; name: string; is_active?: number }[]>([]);
  const [cat2List, setCat2List] = useState<{ id: number; name: string; cat1_id: number; is_active?: number }[]>([]);
  const [cat3List, setCat3List] = useState<{ id: number; name: string; cat2_id: number; is_active?: number }[]>([]);
  const [payList, setPayList] = useState<{ code: string; name: string; is_active?: number }[]>([]);
  const [cpList, setCpList] = useState<{ counterpart_id: number; name: string }[]>([]);

  const isFilterActive = useMemo(() => hasCondition(appliedFilter), [appliedFilter]);

  useEffect(() => {
    axios.get("/categories/lvl1").then((r) => setCat1List(r.data));
    axios.get("/categories/lvl2").then((r) => setCat2List(r.data));
    axios.get("/categories/lvl3").then((r) => setCat3List(r.data));
    axios.get("/counterparts").then((r) => setCpList(r.data));
    axios.get("/payment-methods").then((r) =>
      setPayList(
        r.data.map((p: { method_id: number; method_name: string; is_active?: number }) => ({
          code: String(p.method_id),
          name: p.method_name,
          is_active: p.is_active,
        }))
      )
    );
  }, []);

  /* 세 자료를 한 달치로 모은다 */
  useEffect(() => {
    let alive = true;
    const [y, m] = yearMonth.split("-");
    const prefix = `${y}-${m}`;

    Promise.all([
      axios.get("/entries/month", { params: { ym: yearMonth } }).then((r) => r.data).catch(() => []),
      axios.get("/pending-entries").then((r) => r.data).catch(() => []),
      axios.get("/scheduled-entries").then((r) => r.data).catch(() => []),
    ]).then(([ex, pe, sc]) => {
      if (!alive) return;
      const out: Row[] = [];

      type Raw = Record<string, unknown>;
      const push = (src: Src, list: Raw[], dateField: string, idField: string) => {
        list.forEach((x) => {
          const raw = String(x[dateField] ?? "");
          if (!raw.startsWith(prefix)) return;
          const d = dayOf(raw);
          if (!d) return;
          out.push({
            key: `${src}-${x[idField]}`,
            src,
            day: d,
            inout: (x.inout as number) ?? null,
            net: Number(x.net_amount ?? x.amount ?? 0),
            amount: Number(x.amount ?? 0),
            cat1_id: x.cat1_id as number,
            cat2_id: x.cat2_id as number,
            cat3_id: x.cat3_id as number,
            pay_method: x.pay_method as number,
            memo: x.memo as string,
            place_name: x.place_name as string,
            counterpart_ids: (x.counterpart_ids as number[]) ?? [],
          });
        });
      };

      push("expense", ex, "tx_date", "entry_id");
      push("pending", pe, "tx_date", "entry_id");
      push("scheduled", sc, "next_run_at", "schedule_id");
      setRows(out);
    });

    return () => {
      alive = false;
    };
  }, [yearMonth]);

  /* 켠 자료 + 걸린 조건을 통과한 줄만 */
  const shown = useMemo(
    () => rows.filter((r) => on[r.src] && pass(r, appliedFilter)),
    [rows, on, appliedFilter]
  );

  /* 날짜별로 모은다 */
  const byDay = useMemo(() => {
    const map = new Map<number, Row[]>();
    shown.forEach((r) => {
      const list = map.get(r.day);
      if (list) list.push(r);
      else map.set(r.day, [r]);
    });
    return map;
  }, [shown]);

  /* 달력 칸 — 앞뒤로 빈 칸을 채워 7의 배수로 맞춘다 */
  const cells = useMemo(() => {
    const [y, m] = yearMonth.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0).getDate();
    const lead = first.getDay();
    const total = Math.ceil((lead + last) / 7) * 7;

    return Array.from({ length: total }, (_, i) => {
      const day = i - lead + 1;
      return day >= 1 && day <= last ? day : null;
    });
  }, [yearMonth]);

  const monthLabel = useMemo(() => {
    const [y, m] = yearMonth.split("-").map(Number);
    return `${y}년 ${m}월`;
  }, [yearMonth]);

  const shiftMonth = (step: number) => {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + step, 1);
    /* 고른 날은 그 달의 날이다. 달을 넘기면 뜻을 잃으므로 접는다 */
    setPick(null);
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const today = useMemo(() => {
    const d = new Date();
    return {
      ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      day: d.getDate(),
    };
  }, []);

  /* 한 달 합계 */
  const monthSum = useMemo(() => {
    let inSum = 0;
    let outSum = 0;
    shown.forEach((r) => (r.inout === 1 ? (inSum += r.net) : (outSum += r.net)));
    return { inSum, outSum, net: inSum - outSum };
  }, [shown]);

  /** 날짜 한 칸을 눌렀을 때 */
  const pickDay = useCallback((day: number) => {
    setPick((prev) => {
      /* 처음 누름 — 시작일 */
      if (!prev) return { start: day, end: null };
      /* 시작일만 잡혀 있을 때 */
      if (prev.end === null) {
        if (day === prev.start) return null; // 같은 날 다시 누르면 접는다
        return { start: Math.min(prev.start, day), end: Math.max(prev.start, day) };
      }
      /* 기간이 다 잡힌 뒤 누르면 새로 고르기 시작 */
      return { start: day, end: null };
    });
  }, []);

  /* 시작일만 잡힌 채 달력 바깥을 누르면 접는다.
     기간이 다 잡힌 뒤에는 [상세]를 눌러야 하므로 바깥 누름으로 접지 않는다. */
  useEffect(() => {
    if (!pick || pick.end !== null) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const el = calRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      /* [상세]는 달력 바깥이지만 접어서는 안 된다 — 누르는 순간 고르기가
         풀리면 버튼이 사라져 클릭이 갈 곳을 잃는다 */
      if (e.target instanceof Element && e.target.closest("[data-keep-pick]")) return;
      setPick(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [pick]);

  /** 고른 기간의 상세 화면으로 넘어간다 */
  const openDetail = useCallback(() => {
    if (!pick) return;
    const pad = (n: number) => String(n).padStart(2, "0");
    const from = `${yearMonth}-${pad(pick.start)}`;
    /* 끝일을 고르지 않았으면 그 하루만 본다 */
    const to = `${yearMonth}-${pad(pick.end ?? pick.start)}`;
    const src = SOURCES.filter((s) => on[s.key]).map((s) => s.key).join(",");
    navigate(`/calendar/detail?from=${from}&to=${to}&src=${src}`, {
      /* 걸린 조건도 함께 넘긴다 — 달력에 보이던 것과 상세가 어긋나면 안 된다 */
      state: { filter: appliedFilter },
    });
  }, [pick, yearMonth, on, appliedFilter, navigate]);

  const closeFilter = useCallback(() => {
    setFilter(appliedFilter);
    setFilterOpen(false);
  }, [appliedFilter]);

  useBackClose(filterOpen, closeFilter);

  useEffect(() => {
    if (filterOpen) document.documentElement.classList.add("modal-open");
    else document.documentElement.classList.remove("modal-open");
    return () => document.documentElement.classList.remove("modal-open");
  }, [filterOpen]);

  /* 고르기 목록 — 상위에서 고른 것만 아래로 좁힌다.
     맨 위의 [전체]는 지출·대기 내역 필터와 같은 방식으로 다룬다 —
     누르면 전부 켜지고, 이미 전부 켜져 있으면 전부 꺼진다. */
  const cat1Pool = useMemo(() => visible(cat1List), [cat1List]);
  const cat2Pool = useMemo(() => {
    const base = filter.cat1.length
      ? cat2List.filter((c) => filter.cat1.includes(c.cat1_id))
      : cat2List;
    return visible(base);
  }, [cat2List, filter.cat1]);
  const cat3Pool = useMemo(() => {
    const base = filter.cat2.length
      ? cat3List.filter((c) => filter.cat2.includes(c.cat2_id))
      : cat3List;
    return visible(base);
  }, [cat3List, filter.cat2]);
  const payPool = useMemo(() => visible(payList), [payList]);

  const cat1Options = useMemo(
    () => [{ value: ALL, label: "[전체]" }, ...cat1Pool.map((c) => ({ value: c.id, label: c.name }))],
    [cat1Pool]
  );
  const cat2Options = useMemo(
    () => [{ value: ALL, label: "[전체]" }, ...cat2Pool.map((c) => ({ value: c.id, label: c.name }))],
    [cat2Pool]
  );
  const cat3Options = useMemo(
    () => [{ value: ALL, label: "[전체]" }, ...cat3Pool.map((c) => ({ value: c.id, label: c.name }))],
    [cat3Pool]
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
    []
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

  return (
    <div className="page-wrap">
      {/* 월 넘기기 + 필터 — 내역 세 화면과 같은 툴바 */}
      <div className="toolbar-wrap">
        <div className="toolbar">
          <div className="month-nav">
            <button type="button" className="month-nav__arrow" aria-label="지난달" onClick={() => shiftMonth(-1)}>
              ‹
            </button>
            <span className="month-nav__label">{monthLabel}</span>
            <button type="button" className="month-nav__arrow" aria-label="다음 달" onClick={() => shiftMonth(1)}>
              ›
            </button>
          </div>

          <div className="toolbar-btns">
            {/* 날짜를 고르면 필터 왼쪽에 나타난다.
                끝일을 고르지 않았으면 그 하루만 본다 */}
            {pick && (
              <button
                type="button"
                className="filter-pill on"
                data-keep-pick
                onClick={openDetail}
                title={
                  pick.end === null ? `${pick.start}일 내역을 본다.` : "고른 기간의 내역을 본다."
                }
              >
                상세
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className={`filter-pill${isFilterActive ? " on" : ""}`}
              aria-pressed={isFilterActive}
              title={isFilterActive ? "필터가 걸려 있다. 눌러서 고친다." : "필터"}
            >
              필터
            </button>
          </div>
        </div>
      </div>

      {/* 무엇을 겹쳐 볼지 */}
      <div className="cal-sources">
        {SOURCES.map((s) => (
          <label key={s.key} className={`cal-source cal-source--${s.key}${on[s.key] ? " on" : ""}`}>
            <input
              type="checkbox"
              checked={on[s.key]}
              onChange={() => setOn((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
            />
            <span className="cal-source__dot" aria-hidden="true" />
            {s.label}
          </label>
        ))}

        <span className="cal-sum">
          {monthSum.net !== 0 && (
            <span className={monthSum.net > 0 ? "cal-sum__in" : "cal-sum__out"}>
              {monthSum.net > 0 ? "+" : "−"}
              {Math.abs(monthSum.net).toLocaleString("ko-KR")}
            </span>
          )}
        </span>
      </div>

      {/* 달력 */}
      <div className="cal" ref={calRef}>
        <div className="cal__head">
          {WEEKDAYS.map((w, i) => (
            <span key={w} className={`cal__weekday${i === 0 ? " sun" : i === 6 ? " sat" : ""}`}>
              {w}
            </span>
          ))}
        </div>

        <div className="cal__grid">
          {cells.map((day, i) => {
            if (day === null) return <div key={`e${i}`} className="cal__cell cal__cell--empty" />;

            const items = byDay.get(day) ?? [];
            let net = 0;
            const kinds = new Set<Src>();
            items.forEach((r) => {
              net += r.inout === 1 ? r.net : -r.net;
              kinds.add(r.src);
            });

            const dow = i % 7;
            const isToday = today.ym === yearMonth && today.day === day;

            /* 고른 기간 표시 — 시작·끝은 끝을 둥글게, 사이는 이어지는 선으로 */
            const lo = pick ? pick.start : 0;
            const hi = pick ? pick.end ?? pick.start : 0;
            const inRange = !!pick && day >= lo && day <= hi;
            const rangeClass = inRange
              ? ` is-in-range${day === lo ? " is-range-start" : ""}${day === hi ? " is-range-end" : ""}`
              : "";

            return (
              <div
                key={day}
                role="button"
                tabIndex={0}
                aria-pressed={inRange}
                title={`${day}일`}
                onClick={() => pickDay(day)}
                className={`cal__cell cal__cell--pick${isToday ? " is-today" : ""}${items.length ? " has-items" : ""}${rangeClass}`}
              >
                <span className={`cal__day${dow === 0 ? " sun" : dow === 6 ? " sat" : ""}`}>
                  {day}
                </span>

                {items.length > 0 && (
                  <>
                    <span className={`cal__net ${net > 0 ? "plus" : net < 0 ? "minus" : "zero"}`}>
                      {net > 0 ? "+" : net < 0 ? "−" : ""}
                      {Math.abs(net).toLocaleString("ko-KR")}
                    </span>
                    <span className="cal__dots">
                      {SOURCES.filter((s) => kinds.has(s.key)).map((s) => (
                        <span key={s.key} className={`cal__dot cal__dot--${s.key}`} title={s.label} />
                      ))}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 필터 — 기간만 빼고 내역 화면과 같다 */}
      {filterOpen && (
        <div className="popup-overlay" onClick={closeFilter}>
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
                  onSpecialClick={toggleAll("cat2", cat2Pool.map((c) => c.id))}
                  isOptionChecked={isAllChecked("cat2", cat2Pool.map((c) => c.id))}
                  onChange={(v: number[]) => setFilter({ ...filter, cat2: v })}
                  placeholder="(전체)"
                />
              </EditField>

              <EditField label="세분류" span={4}>
                <MultiSelect
                  options={cat3Options}
                  selected={filter.cat3}
                  onSpecialClick={toggleAll("cat3", cat3Pool.map((c) => c.id))}
                  isOptionChecked={isAllChecked("cat3", cat3Pool.map((c) => c.id))}
                  onChange={(v: number[]) => setFilter({ ...filter, cat3: v })}
                  placeholder="(전체)"
                />
              </EditField>

              <EditDivider />

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

              <EditField label="결제 수단" span={6}>
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
              <button
                className="ui-btn primary"
                onClick={() => {
                  setAppliedFilter(filter);
                  setFilterOpen(false);
                }}
              >
                적용
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        className="calculator-trigger-button"
        onClick={() => setCalculatorOpen(!calculatorOpen)}
        aria-label="Calculator"
      >
        계산기
      </button>
      {calculatorOpen && (
        <CalculatorPopup onClose={() => setCalculatorOpen(false)} />
      )}
    </div>
  );
}
