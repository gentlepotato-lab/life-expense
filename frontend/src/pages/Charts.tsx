import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import axios from "../api/client";
import useRevealDrag from "../hooks/useRevealDrag";
import EntryFilterPopup from "./components/EntryFilterPopup";
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
 * 씀씀이.
 *
 * 달력이 한 달을 날짜로 훑는 화면이라면, 여기는 같은 한 달을 그림으로 본다.
 * 고르는 조건과 겹쳐 보는 자료는 달력과 똑같다 — 두 화면이 같은 달을
 * 다르게 그리는 것뿐이라, 조건이 어긋나면 서로를 못 믿게 된다.
 *
 * 그림 하나에 축은 하나만 둔다. 날짜별과 누적은 자릿수가 열 배쯤 달라
 * 한 판에 겹치면 둘 다 못 읽는다. 그래서 판을 나눴다.
 */

const SOURCES: { key: Src; label: string }[] = [
  { key: "expense", label: "지출" },
  { key: "pending", label: "대기" },
  { key: "scheduled", label: "정기" },
];

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/* 갈래 색 — 맑고 쨍한 파스텔. 위 알약(지출 남보라 · 대기 주황 · 정기 청록)과
   헷갈리지 않도록 그 셋을 피해 분홍 · 하늘 · 민트 · 라벤더 · 살구로 돈다.
   눈으로 고르지 않고 검사기에 걸었다 — 밝기 범위 · 채도 바닥 · 색각 이상에서의
   이웃 구분(11.6) · 정상 시야 구분(18.9)을 넉넉히 통과한다.
   분홍과 민트를 붙이면 적록색각에서 붙어 버려 그 사이에 하늘을 넣었다.
   회색은 갈래 색이 아니라 "기타" 전용이다 — 눈에 덜 띄어야 하는 자리다. */
const PALETTE = ["#FF7FA8", "#4FB0F5", "#22C97E", "#B47CFF", "#FF8A5C"];
const ETC_COLOR = "#94A3B8";

/* 한 갈래짜리 그림도 같은 톤으로 — 나간 돈은 분홍, 쌓인 돈은 라벤더 */
const SPEND = "#FF7FA8";
const ACC = "#B47CFF";
const WEEKDAY = "#E3D3FF";

const AXIS = { fontSize: 10, fill: "#ADB5BD" };

/** 1,234,567 → "123만". 축에는 자리가 없다 */
function shortWon(v: number): string {
  const n = Math.abs(v);
  if (n >= 100000000) return `${Math.round(n / 100000000)}억`;
  if (n >= 10000) return `${Math.round(n / 10000)}만`;
  if (n >= 1000) return `${Math.round(n / 1000)}천`;
  return String(Math.round(n));
}

const won = (v: number) => `${Math.round(v).toLocaleString("ko-KR")}원`;

/** "2026-08-17" 의 날짜 부분만 숫자로 */
function dayOf(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(v);
  return m ? Number(m[2]) : null;
}

type Slice = { name: string; value: number };

/** 큰 것부터 몇 개만 남기고 나머지는 "기타" 로 묶는다 */
function topN(map: Map<string, number>, n: number): Slice[] {
  const all = [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
  if (all.length <= n) return all;
  const rest = all.slice(n).reduce((sum, s) => sum + s.value, 0);
  return [...all.slice(0, n), { name: "기타", value: rest }];
}

const colorOf = (name: string, i: number) =>
  name === "기타" ? ETC_COLOR : PALETTE[i % PALETTE.length];

/** 넓은 화면인지 — 값 이름표를 붙일지 말지를 여기서 정한다 */
function useWide(query = "(min-width: 640px)") {
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return wide;
}

/** 그림 위에 뜨는 말풍선 — 화면 톤에 맞춰 우리가 그린다 */
type TipItem = {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: { name?: string; color?: string };
};
function Tip({
  active,
  payload,
  label,
  suffix = "",
  useSliceName = false,
}: {
  active?: boolean;
  payload?: TipItem[];
  label?: string | number;
  suffix?: string;
  /** 도넛처럼 이름이 조각에 붙어 있는 그림 */
  useSliceName?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const head = useSliceName ? payload[0]?.payload?.name : `${label ?? ""}${suffix}`;
  return (
    <div className="chart-tip">
      {head && <div className="chart-tip__head">{head}</div>}
      {payload.map((p, i) => (
        <div key={i} className="chart-tip__row">
          {/* 빛깔은 그 조각이 들고 있는 것을 그대로 쓴다 — 말풍선 차례로
              고르면 조각이 하나뿐인 그림에서 늘 첫 빛깔만 나온다 */}
          <span
            className="chart-tip__dot"
            style={{ background: p.payload?.color ?? p.color ?? ETC_COLOR }}
          />
          <span className="chart-tip__value">{won(Number(p.value ?? 0))}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * 가려 둔 갈래가 섞인 금액.
 *
 * 덮개는 숫자마다 따로 걷힌다 — 하나를 끌었다고 다른 것까지 드러나면
 * 가린 뜻이 없다. 그래서 드러난 상태를 이 부품이 저마다 들고 있다.
 */
function MaskedAmount({
  value,
  className,
  hide,
}: {
  value: string;
  className: string;
  /** 가려야 할 줄이 섞여 있는지 */
  hide: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const startReveal = useRevealDrag(setRevealed);
  const covered = hide && !revealed;
  return (
    <span
      className={`${className}${hide ? (covered ? " masked" : " revealed") : ""}`}
      title={hide ? "끌면 잠깐 보인다." : undefined}
      onMouseDown={hide ? startReveal : undefined}
      onTouchStart={hide ? startReveal : undefined}
    >
      {value}
    </span>
  );
}

const TIP_PROPS = {
  animationDuration: 160,
  cursor: { fill: "rgba(180, 124, 255, 0.12)" },
  wrapperStyle: { outline: "none" },
};

export default function Charts() {
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

  /* Blur 를 걸어 둔 갈래를 셈에 넣을지. 처음에는 빼 둔다 */
  const [blurOn, setBlurOn] = useState(false);

  /* Exclude 를 걸어 둔 갈래를 뺄지. 처음에는 뺀다(켜짐) */
  const [excludeOn, setExcludeOn] = useState(true);

  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [appliedFilter, setAppliedFilter] = useState<Filter>(EMPTY_FILTER);

  const wide = useWide();

  /* 고르는 목록들 — 그림에 이름을 붙이는 데도 쓴다 */
  const [cat1List, setCat1List] = useState<{ id: number; name: string; exclude?: number; is_active?: number }[]>([]);
  const [cat2List, setCat2List] = useState<{ id: number; name: string; cat1_id: number; blur?: number; inout?: number | null; exclude?: number; is_active?: number }[]>([]);
  const [cat3List, setCat3List] = useState<{ id: number; name: string; cat2_id: number; exclude?: number; is_active?: number }[]>([]);
  const [payList, setPayList] = useState<{ code: string; name: string; category?: string; is_active?: number }[]>([]);
  const [cpList, setCpList] = useState<{ counterpart_id: number; name: string }[]>([]);

  const isFilterActive = useMemo(() => hasCondition(appliedFilter), [appliedFilter]);

  useEffect(() => {
    axios.get("/categories/lvl1").then((r) => setCat1List(r.data));
    axios.get("/categories/lvl2").then((r) => setCat2List(r.data));
    axios.get("/categories/lvl3").then((r) => setCat3List(r.data));
    axios.get("/counterparts").then((r) => setCpList(r.data));
    axios.get("/payment-methods").then((r) =>
      setPayList(
        r.data.map(
          (p: {
            method_id: number;
            method_name: string;
            category?: string;
            is_active?: number;
          }) => ({
            code: String(p.method_id),
            name: p.method_name,
            /* 카드 실적은 구분이 `카드` 인 것만 센다 */
            category: p.category,
            is_active: p.is_active,
          })
        )
      )
    );
  }, []);

  /* 세 자료를 한 달치로 모은다 — 달력과 같은 방식이다 */
  useEffect(() => {
    let alive = true;
    const prefix = yearMonth;

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

  const blurSets = useMemo(
    () => blurSetsFrom(cat1List, cat2List, cat3List),
    [cat1List, cat2List, cat3List]
  );

  /* 들어오는 갈래(수입 · 캐쉬백 …). 씀씀이는 나가는 돈만 다루므로
     줄의 IN/OUT 뿐 아니라 갈래 자체가 IN 이면 아예 뺀다. */
  const inSet = useMemo(
    () => new Set(cat2List.filter((c) => c.inout === 1).map((c) => c.id)),
    [cat2List]
  );

  const excSets = useMemo(
    () => excludeSetsFrom(cat1List, cat2List, cat3List),
    [cat1List, cat2List, cat3List]
  );

  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          on[r.src] &&
          r.inout !== 1 &&
          !inSet.has(Number(r.cat2_id)) &&
          (blurOn || !isBlurred(r, blurSets)) &&
          !(excludeOn && isExcluded(r, excSets)) &&
          pass(r, appliedFilter)
      ),
    [rows, on, appliedFilter, blurOn, blurSets, inSet, excludeOn, excSets]
  );

  const monthLabel = useMemo(() => {
    const [y, m] = yearMonth.split("-").map(Number);
    return `${y}년 ${m}월`;
  }, [yearMonth]);

  const shiftMonth = (step: number) => {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + step, 1);
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const daysInMonth = useMemo(() => {
    const [y, m] = yearMonth.split("-").map(Number);
    return new Date(y, m, 0).getDate();
  }, [yearMonth]);

  const firstDow = useMemo(() => {
    const [y, m] = yearMonth.split("-").map(Number);
    return new Date(y, m - 1, 1).getDay();
  }, [yearMonth]);

  /* 한 달 합계. 가려야 할 줄이 섞였으면 숫자도 함께 덮는다 —
     달력의 한 달 합계와 같은 규칙이다. */
  const sum = useMemo(() => {
    let out = 0;
    let hasBlur = false;
    shown.forEach((r) => {
      out += r.net;
      if (isBlurred(r, blurSets)) hasBlur = true;
    });
    return { out, count: shown.length, hasBlur };
  }, [shown, blurSets]);

  /* ─── 날짜별 · 누적 ───────────────────────────────────────── */
  const byDay = useMemo(() => {
    const spend = new Array<number>(daysInMonth + 1).fill(0);
    shown.forEach((r) => {
      if (r.day <= daysInMonth) spend[r.day] += r.net;
    });

    /* 돈이 있는 마지막 날까지만 그린다. 이번 달을 보면 남은 날이
       0 으로 길게 깔려 그림이 오른쪽으로 납작해진다. */
    let last = 0;
    for (let d = 1; d <= daysInMonth; d += 1) if (spend[d] > 0) last = d;
    if (last === 0) last = daysInMonth;

    let acc = 0;
    return Array.from({ length: last }, (_, i) => {
      const day = i + 1;
      acc += spend[day];
      return { day, 지출: Math.round(spend[day]), 누적: Math.round(acc), dow: (firstDow + i) % 7 };
    });
  }, [shown, daysInMonth, firstDow]);

  /* ─── 중분류별 ────────────────────────────────────────────── */
  const byCat = useMemo(() => {
    const name = new Map(cat1List.map((c) => [c.id, c.name]));
    const m = new Map<string, number>();
    shown.forEach((r) => {
      const k = name.get(Number(r.cat1_id)) ?? "분류 없음";
      m.set(k, (m.get(k) ?? 0) + r.net);
    });
    return topN(m, 5).map((s, i) => ({ ...s, color: colorOf(s.name, i) }));
  }, [shown, cat1List]);

  /* ─── 결제 수단별 ─────────────────────────────────────────── */
  const byPay = useMemo(() => {
    const name = new Map(payList.map((p) => [p.code, p.name]));
    const m = new Map<string, number>();
    shown.forEach((r) => {
      const k = name.get(String(r.pay_method)) ?? "수단 없음";
      m.set(k, (m.get(k) ?? 0) + r.net);
    });
    return topN(m, 5).map((s, i) => ({ ...s, color: colorOf(s.name, i) }));
  }, [shown, payList]);

  /* ─── 요일별 ──────────────────────────────────────────────── */
  const byDow = useMemo(() => {
    const sums = new Array<number>(7).fill(0);
    byDay.forEach((d) => (sums[d.dow] += d.지출));
    /* 주말만 색을 달리해 한 주의 마디가 보이게 한다.
       빛깔을 자료에 실어 두면 막대 · 말풍선이 한 값을 본다 */
    return WEEKDAYS.map((w, i) => ({
      요일: w,
      지출: Math.round(sums[i]),
      color: i === 0 ? SPEND : i === 6 ? ACC : WEEKDAY,
    }));
  }, [byDay]);

  const catTotal = useMemo(() => byCat.reduce((s, c) => s + c.value, 0), [byCat]);

  /* ─── 카드 실적 ───────────────────────────────────────────────
     쓴 돈이 아니라 카드에 그은 돈이다. 열 명이 먹은 값 10만 원을 내가
     긁고 2만 원만 부담했다면, 실적은 10만 원이고 내 몫은 2만 원이다.
     그래서 여기서만 r.amount(원래 결제액)를 쓴다 — 다른 그림은 모두
     r.net(쪼갠 뒤 내 몫)을 본다.

     결제 수단 구분이 `카드` 인 것만 센다. 걸러 낸 조건 · Exclude · Blur 는
     다른 그림과 똑같이 받는다(shown 을 그대로 쓴다). */
  const byCard = useMemo(() => {
    const cards = payList.filter((p) => p.category === "카드");
    if (!cards.length) return [];
    const seen = new Map<string, { charged: number; mine: number; count: number; hasBlur: boolean }>();
    shown.forEach((r) => {
      const code = String(r.pay_method);
      if (!cards.some((c) => c.code === code)) return;
      const cur = seen.get(code) ?? { charged: 0, mine: 0, count: 0, hasBlur: false };
      cur.charged += r.amount;
      cur.mine += r.net;
      cur.count += 1;
      if (isBlurred(r, blurSets)) cur.hasBlur = true;
      seen.set(code, cur);
    });
    return cards.map((c) => ({
      code: c.code,
      name: c.name,
      ...(seen.get(c.code) ?? { charged: 0, mine: 0, count: 0, hasBlur: false }),
    }));
  }, [shown, payList, blurSets]);

  /* 카드 실적은 접어 둔다. 요약 판과 그림 사이에 늘 펼쳐져 있으면
     지출 흐름을 읽다가 다른 얘기에 걸려 넘어진다. 볼 때만 편다. */
  const [cardOpen, setCardOpen] = useState(false);

  /* 지금 보고 있는 카드 — 옆으로 넘겨 하나씩 본다 */
  const [cardAt, setCardAt] = useState(0);
  const cardStripRef = useRef<HTMLDivElement | null>(null);

  /* 카드 수가 줄면 보던 자리가 목록 밖으로 나갈 수 있다 */
  useEffect(() => {
    if (cardAt > byCard.length - 1) setCardAt(0);
  }, [byCard.length, cardAt]);

  /* 넓은 화면에서는 한 장이 판 전체를 차지하지 않고 요약 판 한 칸 너비다.
     그래서 넘김 단위는 화면 너비가 아니라 "한 장 + 사이 여백" 이다. */
  const cardStep = () => {
    const el = cardStripRef.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return 1;
    const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
    return first.getBoundingClientRect().width + gap;
  };

  /** 넘긴 만큼 점을 옮긴다 — 손가락으로 쓸든 단추를 누르든 한 곳에서 센다 */
  const onCardScroll = useCallback(() => {
    const el = cardStripRef.current;
    if (!el) return;
    setCardAt(Math.round(el.scrollLeft / cardStep()));
  }, []);

  const goCard = useCallback((i: number) => {
    const el = cardStripRef.current;
    if (!el) return;
    el.scrollTo({ left: i * cardStep(), behavior: "smooth" });
  }, []);

  /* 다 들어가면 넘길 것이 없다 — 그때는 점도 화살표도 두지 않는다.
     카드가 둘인데 넉넉한 화면에서 점 두 개가 떠 있으면 못 본 장이 있는 줄 안다. */
  const [cardOverflow, setCardOverflow] = useState(false);
  useEffect(() => {
    const el = cardStripRef.current;
    if (!cardOpen || !el) {
      setCardOverflow(false);
      return;
    }
    const check = () => setCardOverflow(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cardOpen, byCard.length]);

  /** 한 달 중 가장 많이 쓴 하루 */
  const peak = useMemo(
    () => byDay.reduce((best, d) => (d.지출 > best.지출 ? d : best), { day: 0, 지출: 0 }),
    [byDay]
  );
  const empty = shown.length === 0;

  /* [적용]을 누르지 않고 닫으면 고치던 값은 버린다 */
  const closeFilter = useCallback(() => {
    setFilter(appliedFilter);
    setFilterOpen(false);
  }, [appliedFilter]);

  return (
    <div className="page-wrap">
      {/* 월 넘기기 + 필터 — 달력과 같은 툴바 */}
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

      {/* 무엇을 겹쳐 볼지 — 달력과 같다 */}
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
      </div>

      {/* ─── 카드 실적 — 한 장씩 옆으로 넘겨 본다 ───────────────── */}
      {byCard.length > 0 && (
        <section className={`card-perf${cardOpen ? " open" : ""}`}>
          <header className="card-perf__head">
            <button
              type="button"
              className="card-perf__toggle"
              aria-expanded={cardOpen}
              onClick={() => {
                /* 다시 펼 때는 첫 장부터 — 접힌 사이 자리가 어긋나 있을 수 있다 */
                if (!cardOpen) setCardAt(0);
                setCardOpen((v) => !v);
              }}
            >
              <span className="card-perf__caret" aria-hidden="true">
                ›
              </span>
              <h3 className="card-perf__title">카드 실적</h3>
            </button>
            {cardOpen && cardOverflow && byCard.length > 1 && (
              <span className="card-perf__nav">
                <button
                  type="button"
                  className="card-perf__arrow"
                  aria-label="이전 카드"
                  disabled={cardAt === 0}
                  onClick={() => goCard(cardAt - 1)}
                >
                  ‹
                </button>
                <span className="card-perf__dots" aria-hidden="true">
                  {byCard.map((c, i) => (
                    <span key={c.code} className={`card-perf__dot${i === cardAt ? " on" : ""}`} />
                  ))}
                </span>
                <button
                  type="button"
                  className="card-perf__arrow"
                  aria-label="다음 카드"
                  disabled={cardAt >= byCard.length - 1}
                  onClick={() => goCard(cardAt + 1)}
                >
                  ›
                </button>
              </span>
            )}
          </header>

          {cardOpen && (
          <div
            className="card-perf__strip"
            ref={cardStripRef}
            onScroll={onCardScroll}
          >
            {byCard.map((c) => (
              <article key={c.code} className="card-perf__item">
                <div className="card-perf__line">
                  <span className="card-perf__name">{c.name}</span>
                  <MaskedAmount
                    className="card-perf__value"
                    hide={c.hasBlur}
                    value={Math.round(c.charged).toLocaleString("ko-KR")}
                  />
                </div>

                {/* 넓은 줄을 숫자 하나로 비워 두지 않고, 이 판이 말하려는 바로
                    그것을 담는다 — 그은 돈 가운데 얼마가 내 돈이었는지.
                    비율만 보이고 금액은 드러나지 않으므로 덮개가 덮여 있어도 그린다. */}
                <div className="card-perf__bar" aria-hidden="true">
                  <span
                    className="card-perf__bar-fill"
                    style={{
                      width: `${c.charged > 0 ? Math.min(100, (c.mine / c.charged) * 100) : 0}%`,
                    }}
                  />
                </div>

                <div className="card-perf__line card-perf__line--sub">
                  <span className="card-perf__sub">{c.count}건</span>
                  <span className="card-perf__sub">
                    내 몫 {Math.round(c.mine).toLocaleString("ko-KR")}
                  </span>
                </div>
              </article>
            ))}
          </div>
          )}
        </section>
      )}

      {/* 한 달 요약 — 이 화면은 나간 돈만 센다 */}
      <div className="chart-tiles">
        <div className="chart-tile">
          <span className="chart-tile__label">지출</span>
          <MaskedAmount
            className="chart-tile__value"
            hide={sum.hasBlur}
            value={Math.round(sum.out).toLocaleString("ko-KR")}
          />
          <span className="chart-tile__sub">{sum.count}건</span>
        </div>
        <div className="chart-tile">
          <span className="chart-tile__label">일 평균</span>
          <MaskedAmount
            className="chart-tile__value"
            hide={sum.hasBlur}
            value={Math.round(sum.out / daysInMonth).toLocaleString("ko-KR")}
          />
          <span className="chart-tile__sub">/{daysInMonth}</span>
        </div>
        <div className="chart-tile">
          <span className="chart-tile__label">일 최고</span>
          <MaskedAmount
            className="chart-tile__value"
            hide={sum.hasBlur}
            value={Math.round(peak.지출).toLocaleString("ko-KR")}
          />
          <span className="chart-tile__sub">{peak.day ? `${peak.day}일` : " "}</span>
        </div>
      </div>


      {empty ? (
        <p className="chart-empty">지출 내역이 없다.</p>
      ) : (
        <div className="chart-grid">
          {/* ─── 날짜별 ───────────────────────────────────────── */}
          <section className="chart-card chart-card--wide">
            <header className="chart-card__head">
              <h3 className="chart-card__title">날짜별</h3>
            </header>
            <div className="chart-card__body">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDay} margin={{ top: 8, right: 6, bottom: 0, left: -6 }}>
                  <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={false} interval={4} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={shortWon} />
                  <Tooltip {...TIP_PROPS} content={<Tip suffix="일" />} />
                  <Bar dataKey="지출" fill={SPEND} radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* ─── 누적 ────────────────────────────────────────── */}
          <section className="chart-card chart-card--wide">
            <header className="chart-card__head">
              <h3 className="chart-card__title">누적</h3>
            </header>
            <div className="chart-card__body chart-card__body--short">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={byDay} margin={{ top: 8, right: 6, bottom: 0, left: -6 }}>
                  <defs>
                    <linearGradient id="acc-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACC} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={ACC} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={false} interval={4} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={shortWon} />
                  <Tooltip {...TIP_PROPS} cursor={{ stroke: WEEKDAY, strokeWidth: 2 }} content={<Tip suffix="일까지" />} />
                  <Area
                    type="monotone"
                    dataKey="누적"
                    stroke={ACC}
                    strokeWidth={3}
                    strokeLinecap="round"
                    fill="url(#acc-fill)"
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "#FFFFFF" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* ─── 중분류별 ─────────────────────────────────────── */}
          <section className="chart-card">
            <header className="chart-card__head">
              <h3 className="chart-card__title">중분류별</h3>
            </header>
            <div className="chart-donut">
              <div className="chart-donut__plot">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byCat}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="52%"
                      outerRadius="94%"
                      cornerRadius={6}
                      paddingAngle={2}
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {byCat.map((c) => (
                        <Cell key={c.name} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip {...TIP_PROPS} cursor={false} content={<Tip useSliceName />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <ul className="chart-legend">
                {byCat.map((c) => (
                  <li key={c.name} className="chart-legend__row">
                    <span className="chart-legend__key" style={{ background: c.color }} />
                    <span className="chart-legend__name">{c.name}</span>
                    <span className="chart-legend__pct">
                      {catTotal ? Math.round((c.value / catTotal) * 100) : 0}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ─── 결제 수단별 ──────────────────────────────────── */}
          <section className="chart-card">
            <header className="chart-card__head">
              <h3 className="chart-card__title">결제 수단별</h3>
            </header>
            <div
              className="chart-card__body chart-card__body--rows"
              style={{ "--rows": byPay.length } as React.CSSProperties}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={byPay}
                  layout="vertical"
                  margin={{ top: 0, right: wide ? 64 : 10, bottom: 0, left: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ ...AXIS, fill: "#6C757D" }}
                    tickLine={false}
                    axisLine={false}
                    width={wide ? 124 : 82}
                    tickFormatter={(v: string) => {
                      const max = wide ? 13 : 9;
                      return v.length <= max ? v : `${v.slice(0, max - 1)}…`;
                    }}
                  />
                  <Tooltip {...TIP_PROPS} content={<Tip />} />
                  <Bar dataKey="value" name="지출" radius={[0, 8, 8, 0]} maxBarSize={22}>
                    {byPay.map((p) => (
                      <Cell key={p.name} fill={p.color} />
                    ))}
                    {/* 자리가 넉넉할 때만 값을 적는다. 좁으면 눌러서 본다 */}
                    {wide && (
                      <LabelList
                        dataKey="value"
                        position="right"
                        offset={8}
                        formatter={(v: unknown) => shortWon(Number(v))}
                        style={{ fontSize: 13, fontWeight: 700, fill: "#6C757D" }}
                      />
                    )}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* ─── 요일별 ───────────────────────────────────────── */}
          <section className="chart-card chart-card--wide">
            <header className="chart-card__head">
              <h3 className="chart-card__title">요일별</h3>
            </header>
            <div className="chart-card__body chart-card__body--short">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDow} margin={{ top: wide ? 18 : 8, right: 6, bottom: 0, left: -6 }}>
                  <XAxis dataKey="요일" tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={shortWon} />
                  <Tooltip {...TIP_PROPS} content={<Tip suffix="요일" />} />
                  <Bar dataKey="지출" radius={[8, 8, 0, 0]} maxBarSize={44}>
                    {byDow.map((d) => (
                      <Cell key={d.요일} fill={d.color} />
                    ))}
                    {wide && (
                      <LabelList
                        dataKey="지출"
                        position="top"
                        offset={6}
                        formatter={(v: unknown) => (Number(v) ? shortWon(Number(v)) : "")}
                        style={{ fontSize: 13, fontWeight: 700, fill: "#6C757D" }}
                      />
                    )}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      {/* 필터 — 달력과 같은 부품을 쓴다 */}
      {filterOpen && (
        <EntryFilterPopup
          filter={filter}
          setFilter={setFilter}
          cat1List={cat1List}
          cat2List={cat2List}
          cat3List={cat3List}
          payList={payList}
          cpList={cpList}
          /* 이 화면은 나가는 돈만 다룬다 — 고를 것이 없어 칸을 빼 둔다 */
          showInout={false}
          onClose={closeFilter}
          onApply={() => {
            setAppliedFilter(filter);
            setFilterOpen(false);
          }}
        />
      )}
    </div>
  );
}
