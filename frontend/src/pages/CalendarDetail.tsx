import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import axios from "../api/client";
import DateGroupHeader from "./components/DateGroupHeader";
import { CollapseAllButtons } from "./components/CollapseToggle";
import { groupByDate } from "../utils/dateGroup";
import { EMPTY_FILTER, pass, type Filter, type Row as CalRow, type Src } from "../utils/calendarFilter";
import { EntryCard } from "./Entries";
import { PendingCard } from "./PendingEntries";
import { ScheduleCard, type CategoryL2Meta, type CategoryL3Meta } from "./ScheduledEntries";

/**
 * 달력에서 고른 기간의 상세.
 *
 * 달력이 하루를 한 칸으로 줄여 보여 주는 화면이라면, 여기는 그 기간을 카드로 펼친다.
 * 카드는 지출 · 대기 · 정기 세 화면의 것을 그대로 가져다 쓴다. 같은 것을 다시
 * 만들면 언젠가 서로 달라지기 때문이다. 다만 여기서는 보기만 하므로
 * 꾹 눌러 편집하거나 전송하는 동작은 끈다(readOnly).
 *
 * 어디를 볼지는 주소가 들고 있다 — `?from=…&to=…&src=expense,pending,scheduled`.
 * 달력에 걸려 있던 필터는 history 에 실려 온다. 달력에 보이던 것과
 * 여기 보이는 것이 어긋나면 안 되기 때문이다.
 */

/** 그날의 카드 한 장 — 어느 자료에서 왔는지 함께 들고 다닌다 */
type Item = {
  src: Src;
  /** 날짜별로 묶기 위한 값. 정기는 다음 예정일에서 뽑는다 */
  tx_date: string;
  inout?: number | null;
  amount?: number | null;
  net_amount?: number | null;
  cat2_id?: number | null;
  raw: Record<string, unknown>;
};

const SRC_ORDER: Src[] = ["expense", "pending", "scheduled"];

/** "2026-08-03" → "8. 3." */
function shortDate(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return v;
  return `${Number(m[2])}. ${Number(m[3])}.`;
}

/** 날짜 부분만 잘라 낸다 — "2026-08-03 09:00:00" 도 받는다 */
function dateOnly(v: unknown): string {
  return v ? String(v).substring(0, 10) : "";
}

export default function CalendarDetail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const srcOn = useMemo(() => {
    const raw = (params.get("src") ?? "").split(",").filter(Boolean) as Src[];
    /* 아무것도 오지 않았으면 셋 다 켠 것으로 본다 */
    return new Set<Src>(raw.length ? raw : SRC_ORDER);
  }, [params]);

  /* 달력에서 Blur 를 켠 채 넘어왔는지. 끄고 왔다면 가려 둔 갈래는 뺀다 */
  const blurOn = params.get("blur") === "1";

  /* 달력에 걸려 있던 조건. 주소만으로 들어왔다면 조건 없이 본다 */
  const filter = useMemo<Filter>(
    () => (location.state as { filter?: Filter } | null)?.filter ?? EMPTY_FILTER,
    [location.state]
  );

  /* 고르는 목록 — 카드가 이름을 찾는 데 쓴다.
     결제 수단은 화면마다 코드를 숫자로도 문자로도 쓰고 있어 두 벌을 만든다.
     카드 안의 비교 방식을 건드리지 않으려면 이쪽에서 맞춰 주는 편이 낫다. */
  const [cat1List, setCat1List] = useState<{ id: number; name: string }[]>([]);
  const [cat2List, setCat2List] = useState<CategoryL2Meta[]>([]);
  const [cat3List, setCat3List] = useState<CategoryL3Meta[]>([]);
  const [payNum, setPayNum] = useState<{ code: string; name: string }[]>([]);
  const [payStr, setPayStr] = useState<{ code: string; name: string }[]>([]);

  const cat2Map = useMemo(() => {
    const m: Record<number, CategoryL2Meta> = {};
    cat2List.forEach((c) => (m[c.id] = c));
    return m;
  }, [cat2List]);

  const cat3Map = useMemo(() => {
    const m: Record<number, CategoryL3Meta> = {};
    cat3List.forEach((c) => (m[c.id] = c));
    return m;
  }, [cat3List]);

  useEffect(() => {
    axios.get("/categories/lvl1").then((r) => setCat1List(r.data)).catch(() => setCat1List([]));
    axios.get("/categories/lvl2").then((r) => setCat2List(r.data)).catch(() => setCat2List([]));
    axios.get("/categories/lvl3").then((r) => setCat3List(r.data)).catch(() => setCat3List([]));
    axios
      .get("/payment-methods")
      .then((r) => {
        type Pay = { method_id: number; method_name: string };
        const list: Pay[] = Array.isArray(r.data) ? r.data : [];
        setPayNum(list.map((p) => ({ code: p.method_id as unknown as string, name: p.method_name })));
        setPayStr(list.map((p) => ({ code: String(p.method_id), name: p.method_name })));
      })
      .catch(() => {
        setPayNum([]);
        setPayStr([]);
      });
  }, []);

  /* 세 자료. 가려 둔 금액을 끌어서 볼 때 그 줄만 바꾸므로 따로 담는다.
     지출과 대기는 entry_id 가 서로 겹칠 수 있어 한 통에 담을 수 없다. */
  const [exRows, setExRows] = useState<Record<string, unknown>[]>([]);
  const [peRows, setPeRows] = useState<Record<string, unknown>[]>([]);
  const [scRows, setScRows] = useState<Record<string, unknown>[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!from || !to) return;
    let alive = true;
    const ym = from.substring(0, 7);
    const inRange = (d: string) => !!d && d >= from && d <= to;

    Promise.all([
      axios.get("/entries/month", { params: { ym } }).then((r) => r.data).catch(() => []),
      axios.get("/pending-entries").then((r) => r.data).catch(() => []),
      axios.get("/scheduled-entries").then((r) => r.data).catch(() => []),
    ]).then(([ex, pe, sc]: Record<string, unknown>[][]) => {
      if (!alive) return;
      setExRows(
        ex.filter((x) => inRange(dateOnly(x.tx_date))).map((x) => ({ ...x, reveal_amount: false }))
      );
      setPeRows(
        pe.filter((x) => inRange(dateOnly(x.tx_date))).map((x) => ({ ...x, reveal_amount: false }))
      );
      /* 정기 카드는 시각 문자열을 들고 있는 편을 좋아한다 — 정기 내역 화면과 같게 맞춘다 */
      setScRows(
        sc.filter((x) => inRange(dateOnly(x.next_run_at))).map((x) => ({
          ...x,
          time: `${String(x.hour ?? 0).padStart(2, "0")}:${String(x.minute ?? 0).padStart(2, "0")}`,
          memo: x.memo || "",
        }))
      );
      setLoaded(true);
    });

    return () => {
      alive = false;
    };
  }, [from, to]);

  /* 달력이 쓰던 판정을 그대로 쓴다 — 달력 칸과 여기 카드가 어긋나지 않게 */
  const passes = useCallback(
    (src: Src, x: Record<string, unknown>, date: string) => {
      const probe: CalRow = {
        key: "",
        src,
        day: Number(date.substring(8, 10)),
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
      };
      return pass(probe, filter);
    },
    [filter]
  );

  /* 한 통에 모아 날짜별로 묶는다. 하루 안에서는 지출 → 대기 → 정기 순서다 */
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const add = (src: Src, list: Record<string, unknown>[], dateField: string) => {
      if (!srcOn.has(src)) return;
      list.forEach((x) => {
        const date = dateOnly(x[dateField]);
        /* 달력과 같은 셈이어야 한다 — 달력에서 뺀 것은 여기서도 뺀다 */
        if (!blurOn && cat2Map[Number(x.cat2_id)]?.blur === 1) return;
        if (!passes(src, x, date)) return;
        out.push({
          src,
          tx_date: date,
          inout: x.inout as number,
          amount: Number(x.amount ?? 0),
          net_amount: Number(x.net_amount ?? x.amount ?? 0),
          cat2_id: x.cat2_id as number,
          raw: x,
        });
      });
    };
    add("expense", exRows, "tx_date");
    add("pending", peRows, "tx_date");
    add("scheduled", scRows, "next_run_at");

    /* 늦은 날이 위로 — 지출 내역과 같은 순서다.
       같은 날 안에서는 자료 순서를 지킨다 */
    return out.sort((a, b) =>
      a.tx_date === b.tx_date
        ? SRC_ORDER.indexOf(a.src) - SRC_ORDER.indexOf(b.src)
        : a.tx_date < b.tx_date
          ? 1
          : -1
    );
  }, [exRows, peRows, scRows, srcOn, passes, blurOn, cat2Map]);

  const dateGroups = useMemo(
    () => groupByDate(items, (r) => cat2Map[Number(r.cat2_id)]?.blur === 1),
    [items, cat2Map]
  );

  /* 접어 둔 날짜. 비어 있으면 전부 펼쳐진 상태다 — 내역 세 화면과 같다 */
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const toggleDay = (d: string) =>
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });

  /* 가려 둔 금액을 끌어서 잠깐 보기 — 자료별로 그 줄만 바꾼다 */
  const reveal = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<Record<string, unknown>[]>>,
      id: number,
      e: { clientX?: number; touches?: { clientX: number }[] }
    ) => {
      const startX = e.clientX ?? e.touches?.[0]?.clientX;
      if (startX === undefined) return;
      const flip = (on: boolean) =>
        setter((prev) => prev.map((r) => (r.entry_id === id ? { ...r, reveal_amount: on } : r)));

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const x = "touches" in ev ? ev.touches[0]?.clientX : (ev as MouseEvent).clientX;
        if (x !== undefined && Math.abs(x - startX) > 12) flip(true);
      };
      const onEnd = () => {
        flip(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("mouseup", onEnd);
        window.removeEventListener("touchend", onEnd);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("touchmove", onMove, { passive: true });
      window.addEventListener("mouseup", onEnd);
      window.addEventListener("touchend", onEnd);
    },
    []
  );

  const rangeLabel = from === to ? shortDate(from) : `${shortDate(from)} ~ ${shortDate(to)}`;
  const noop = useCallback(() => {}, []);
  const toTimeString = useCallback((hour?: number, minute?: number) => {
    if (typeof hour !== "number" || typeof minute !== "number") return "00:00";
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }, []);

  return (
    <div className="page-wrap">
      {/* 되돌아가기 + 고른 기간 — 내역 세 화면과 같은 툴바 */}
      <div className="toolbar-wrap">
        <div className="toolbar">
          <div className="cal-back">
            <button
              type="button"
              className="filter-pill"
              aria-label="달력으로 돌아가기"
              onClick={() => navigate(-1)}
            >
              <span className="cal-back__arrow" aria-hidden="true">‹</span>
              달력
            </button>
            <span className="cal-back__range">{rangeLabel}</span>
          </div>

          <div className="toolbar-btns">
            <CollapseAllButtons
              onExpandAll={() => setCollapsedDays(new Set())}
              onCollapseAll={() => setCollapsedDays(new Set(dateGroups.map((g) => g.date)))}
            />
          </div>
        </div>
      </div>

      {/* 카드 리스트 — 날짜별 단으로 묶어서 표시 */}
      <div className="card-list">
        {dateGroups.map((group) => (
          <section key={group.date || "no-date"} className="date-group">
            <DateGroupHeader
              label={group.label}
              summary={group.summary}
              open={!collapsedDays.has(group.date)}
              onToggle={() => toggleDay(group.date)}
            />
            {!collapsedDays.has(group.date) &&
              group.items.map((item) => {
                const row = item.raw;
                if (item.src === "expense") {
                  return (
                    <EntryCard
                      key={`ex-${row.entry_id}`}
                      row={row}
                      cat1List={cat1List}
                      cat2List={cat2List as never}
                      payList={payNum}
                      onOpenEditor={noop}
                      onStartReveal={(id, e) => reveal(setExRows, id, e)}
                      readOnly
                    />
                  );
                }
                if (item.src === "pending") {
                  return (
                    <PendingCard
                      key={`pe-${row.entry_id}`}
                      row={row}
                      cat1List={cat1List}
                      cat2List={cat2List as never}
                      cat3List={cat3List as never}
                      payList={payNum}
                      onOpenEditor={noop}
                      onStartReveal={(id, e) => reveal(setPeRows, id, e)}
                      readOnly
                    />
                  );
                }
                return (
                  <ScheduleCard
                    key={`sc-${row.schedule_id}`}
                    s={row}
                    cat1List={cat1List}
                    cat2Map={cat2Map}
                    cat3Map={cat3Map}
                    payList={payStr}
                    toTimeString={toTimeString}
                    readOnly
                  />
                );
              })}
          </section>
        ))}
      </div>

      {loaded && dateGroups.length === 0 && (
        <p className="cal-empty">이 기간에는 내역이 없다.</p>
      )}
    </div>
  );
}
