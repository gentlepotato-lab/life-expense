import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../api/client";
import useRevealDrag from "../hooks/useRevealDrag";
import EntryFilterPopup from "./components/EntryFilterPopup";
import QuickActions from "./components/QuickActions";
import {
  EMPTY_FILTER,
  blurSetsFrom,
  excludeSetsFrom,
  hasCondition,
  isBlurred,
  isExcluded,
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

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-08-17"의 날짜 부분만 숫자로 */
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

  /* 겹쳐 볼 자료 — 처음에는 셋 다 켠다. */
  const [on, setOn] = useState<Record<Src, boolean>>({
    expense: true,
    pending: true,
    scheduled: true,
  });

  const [rows, setRows] = useState<Row[]>([]);

  /* Blur를 걸어 둔 갈래를 셈에 넣을지. 처음에는 빼 둔다 —
     가릴 것이 아예 없으면 테이프도 뜨지 않는다. */
  const [blurOn, setBlurOn] = useState(false);

  /* Exclude를 걸어 둔 갈래를 뺄지. 처음에는 뺀다(켜짐) —
     끄면 수입 · 저축까지 들어와 Net이 보인다. */
  const [excludeOn, setExcludeOn] = useState(true);

  /* 눌러서 고른 기간.
     한 번 누르면 시작일만 잡히고(end === null), 한 번 더 누르면 끝일까지 잡힌다.
     시작일만 잡힌 상태에서 같은 날 또는 달력 바깥을 누르면 고르기를 접는다. */
  const [pick, setPick] = useState<{ start: number; end: number | null } | null>(null);
  const calRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  /* 적고 나면 그 날 칸에 바로 드러나야 한다 — 한 달치를 다시 읽는다. */
  const [reloadKey, setReloadKey] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [appliedFilter, setAppliedFilter] = useState<Filter>(EMPTY_FILTER);

  /* 고르는 목록들 */
  const [cat1List, setCat1List] = useState<{ id: number; name: string; exclude?: number; is_active?: number }[]>([]);
  const [cat2List, setCat2List] = useState<{ id: number; name: string; cat1_id: number; blur?: number; exclude?: number; is_active?: number }[]>([]);
  const [cat3List, setCat3List] = useState<{ id: number; name: string; cat2_id: number; exclude?: number; is_active?: number }[]>([]);
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

  /* 세 자료를 한 달치로 모은다. */
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
  }, [yearMonth, reloadKey]);

  /* Blur가 걸린 갈래 — 그런 지출이 낀 날은 칸의 금액도 덮는다.
     중 · 소 · 세 어디에 걸려도 함께 덮인다. */
  const blurSets = useMemo(
    () => blurSetsFrom(cat1List, cat2List, cat3List),
    [cat1List, cat2List, cat3List]
  );

  const excSets = useMemo(
    () => excludeSetsFrom(cat1List, cat2List, cat3List),
    [cat1List, cat2List, cat3List]
  );

  /* 켠 자료 + 걸린 조건을 통과한 줄만.
     Blur를 끄면 가려야 할 갈래는 셈에서 아예 뺀다.
     Exclude가 켜져 있으면 집계에서 빼 둔 갈래도 뺀다. */
  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          on[r.src] &&
          (blurOn || !isBlurred(r, blurSets)) &&
          !(excludeOn && isExcluded(r, excSets)) &&
          pass(r, appliedFilter)
      ),
    [rows, on, appliedFilter, blurOn, blurSets, excludeOn, excSets]
  );

  /* 날짜별로 모은다. */
  const byDay = useMemo(() => {
    const map = new Map<number, Row[]>();
    shown.forEach((r) => {
      const list = map.get(r.day);
      if (list) list.push(r);
      else map.set(r.day, [r]);
    });
    return map;
  }, [shown]);

  /* 달력 칸 — 앞뒤로 빈 칸을 채워 7의 배수로 맞춘다. */
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
    /* 고른 날은 그 달의 날이다. 달을 넘기면 뜻을 잃으므로 접는다. */
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

  /* 끌면 그 날 하나만 잠깐 드러난다 — 카드·날짜 합계와 같은 손짓이다. */
  const [revealDay, setRevealDay] = useState<number | null>(null);
  const dragDay = useRef<number | null>(null);
  const startReveal = useRevealDrag((on) => setRevealDay(on ? dragDay.current : null));

  /* 한 달 합계. 가려야 할 줄이 하나라도 섞였으면 합계도 함께 덮는다 —
     날마다 가려 놓고 합계로 드러나면 가린 뜻이 없다. */
  const monthSum = useMemo(() => {
    let inSum = 0;
    let outSum = 0;
    let hasBlur = false;
    shown.forEach((r) => {
      if (r.inout === 1) inSum += r.net;
      else outSum += r.net;
      if (isBlurred(r, blurSets)) hasBlur = true;
    });
    return { inSum, outSum, net: inSum - outSum, hasBlur };
  }, [shown, blurSets]);

  const [sumRevealed, setSumRevealed] = useState(false);
  const startSumReveal = useRevealDrag(setSumRevealed);
  const sumMasked = monthSum.hasBlur && !sumRevealed;

  /** 날짜 한 칸을 눌렀을 때 */
  const pickDay = useCallback((day: number) => {
    setPick((prev) => {
      /* 처음 누름 — 시작일 */
      if (!prev) return { start: day, end: null };
      /* 시작일만 잡혀 있을 때 */
      if (prev.end === null) {
        if (day === prev.start) return null; // 같은 날 다시 누르면 접는다.
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
         풀리면 버튼이 사라져 클릭이 갈 곳을 잃는다. */
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

  /** 고른 기간의 상세 화면으로 넘어간다. */
  const openDetail = useCallback(() => {
    if (!pick) return;
    const pad = (n: number) => String(n).padStart(2, "0");
    const from = `${yearMonth}-${pad(pick.start)}`;
    /* 끝일을 고르지 않았으면 그 하루만 본다. */
    const to = `${yearMonth}-${pad(pick.end ?? pick.start)}`;
    const src = SOURCES.filter((s) => on[s.key]).map((s) => s.key).join(",");
    navigate(
      `/calendar/detail?from=${from}&to=${to}&src=${src}&blur=${blurOn ? 1 : 0}&exclude=${excludeOn ? 1 : 0}`,
      {
      /* 걸린 조건도 함께 넘긴다 — 달력에 보이던 것과 상세가 어긋나면 안 된다. */
      state: { filter: appliedFilter },
    });
  }, [pick, yearMonth, on, blurOn, excludeOn, appliedFilter, navigate]);

  const closeFilter = useCallback(() => {
    setFilter(appliedFilter);
    setFilterOpen(false);
  }, [appliedFilter]);

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
                끝일을 고르지 않았으면 그 하루만 본다. */}
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

        {/* Blur를 켜야 가려 둔 갈래까지 셈에 든다. */}
        <button
          type="button"
          className={`cal-source cal-source--blur${blurOn ? " on" : ""}`}
          aria-pressed={blurOn}
          onClick={() => setBlurOn((v) => !v)}
        >
          Blur
        </button>

        <button
          type="button"
          className={`cal-source cal-source--exclude${excludeOn ? " on" : ""}`}
          aria-pressed={excludeOn}
          onClick={() => setExcludeOn((v) => !v)}
        >
          Exclude
        </button>

        <span className="cal-sum">
          {monthSum.net !== 0 && (
            <span
              className={`${monthSum.net > 0 ? "cal-sum__in" : "cal-sum__out"}${
                monthSum.hasBlur ? (sumMasked ? " masked" : " revealed") : ""
              }`}
              title={monthSum.hasBlur ? "끌면 잠깐 보인다." : undefined}
              onMouseDown={monthSum.hasBlur ? startSumReveal : undefined}
              onTouchStart={monthSum.hasBlur ? startSumReveal : undefined}
            >
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
            let hasBlur = false;
            const kinds = new Set<Src>();
            items.forEach((r) => {
              net += r.inout === 1 ? r.net : -r.net;
              kinds.add(r.src);
              if (isBlurred(r, blurSets)) hasBlur = true;
            });
            const netMasked = hasBlur && revealDay !== day;

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
                    <span
                      className={`cal__net ${net > 0 ? "plus" : net < 0 ? "minus" : "zero"}${
                        hasBlur ? (netMasked ? " masked" : " revealed") : ""
                      }`}
                      title={hasBlur ? "끌면 잠깐 보인다." : undefined}
                      /* 덮인 금액은 제 손짓이 있으므로 날짜 고르기로 넘기지 않는다. */
                      onClick={hasBlur ? (e) => e.stopPropagation() : undefined}
                      onMouseDown={
                        hasBlur
                          ? (e) => {
                              dragDay.current = day;
                              startReveal(e);
                            }
                          : undefined
                      }
                      onTouchStart={
                        hasBlur
                          ? (e) => {
                              dragDay.current = day;
                              startReveal(e);
                            }
                          : undefined
                      }
                    >
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

      {/* 필터 — 기간만 빼고 내역 화면과 같다. 씀씀이와 같은 부품을 쓴다. */}
      {filterOpen && (
        <EntryFilterPopup
          filter={filter}
          setFilter={setFilter}
          cat1List={cat1List}
          cat2List={cat2List}
          cat3List={cat3List}
          payList={payList}
          cpList={cpList}
          onClose={closeFilter}
          onApply={() => {
            setAppliedFilter(filter);
            setFilterOpen(false);
          }}
        />
      )}

      <QuickActions onSaved={() => setReloadKey((k) => k + 1)} />
    </div>
  );
}
