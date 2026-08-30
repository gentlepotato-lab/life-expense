import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import axios from "../api/client";
import useRevealDrag from "../hooks/useRevealDrag";
import useBackClose from "../hooks/useBackClose";
import QuickActions from "./components/QuickActions";
import EntryFilterPopup from "./components/EntryFilterPopup";
import type { DragEndEvent } from "@dnd-kit/core";
import { apiErrorMessage } from "../utils/apiError";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

/* 축 눈금. 10은 그림 옆에 두면 유난히 작아 보여 한 단 올렸다 —
   본문 가장 작은 글씨(--font-size-xs)와 같은 크기다. */
const AXIS = { fontSize: 11, fill: "#ADB5BD" };

/* 추이에서 볼 수 있는 달 수. 받아 오는 것은 늘 이 최대치다. */
const TREND_MIN = 2;
const TREND_MAX = 18;

/** 1,234,567 → "123만". 축에는 자리가 없다. */
function shortWon(v: number): string {
  const n = Math.abs(v);
  if (n >= 100000000) return `${Math.round(n / 100000000)}억`;
  if (n >= 10000) return `${Math.round(n / 10000)}만`;
  if (n >= 1000) return `${Math.round(n / 1000)}천`;
  return String(Math.round(n));
}

const won = (v: number) => `${Math.round(v).toLocaleString("ko-KR")}원`;

/** "2026-08-17"의 날짜 부분만 숫자로 */
function dayOf(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(v);
  return m ? Number(m[2]) : null;
}

type Slice = { name: string; value: number };

/** 큰 것부터 몇 개만 남기고 나머지는 "기타"로 묶는다. */
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

/** 넓은 화면인지 — 값 이름표를 붙일지 말지를 여기서 정한다. */
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

/** 그림 위에 뜨는 말풍선 — 화면 톤에 맞춰 우리가 그린다. */
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
  labelFormat,
}: {
  active?: boolean;
  payload?: TipItem[];
  label?: string | number;
  suffix?: string;
  /** 도넛처럼 이름이 조각에 붙어 있는 그림 */
  useSliceName?: boolean;
  /** 축에 담긴 값과 말풍선에 쓸 말이 다를 때 */
  labelFormat?: (v: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  const head = useSliceName
    ? payload[0]?.payload?.name
    : labelFormat
    ? labelFormat(label ?? "")
    : `${label ?? ""}${suffix}`;
  return (
    <div className="chart-tip">
      {head && <div className="chart-tip__head">{head}</div>}
      {payload.map((p, i) => (
        <div key={i} className="chart-tip__row">
          {/* 빛깔은 그 조각이 들고 있는 것을 그대로 쓴다 — 말풍선 차례로
              고르면 조각이 하나뿐인 그림에서 늘 첫 빛깔만 나온다. */}
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

/** 그림 카드 하나가 들고 있는 것 — 껍데기는 ChartCardBox 가 씌운다 */
type CardDef = { key: string; name: string; node: React.ReactNode };

/* 카드 열쇠와 그 차례. 그림은 달마다 새로 그려지지만 열쇠는 그대로라
   바깥에 둔다 — 안에 두면 그릴 때마다 새 배열이 되어 훅이 헛돈다 */
const CARD_KEYS = ["daily", "cumulative", "trend", "cat1", "pay", "weekday"];

/* 처음 넓이 — 사람이 고치기 전까지 쓰는 값. 가로로 긴 그림은 한 줄을 다 쓴다 */
const CARD_WIDE = ["daily", "cumulative", "trend", "weekday"];

/**
 * 그림 카드 한 장.
 *
 * 평소에는 예전과 똑같은 <section> 하나다. 편집 모드에서만 위에 한 줄이
 * 생겨 손잡이와 감추기가 나온다 — 그림 안쪽은 건드리지 않는다.
 *
 * 끌어 옮기기는 편집 모드에서만 산다. 그림 위에는 이미 손짓이 있어
 * (도넛 누르기 · 막대 눌러 파고들기) 평소에도 끌리면 서로 밟는다.
 */
function ChartCardBox({
  def,
  editMode,
  hidden,
  wide,
  onToggleHide,
  onToggleWide,
}: {
  def: CardDef;
  editMode: boolean;
  hidden: boolean;
  /** 한 줄을 다 쓰는가. 좁은 화면에서는 어차피 한 줄에 하나씩이라 뜻이 없다 */
  wide: boolean;
  onToggleHide: () => void;
  onToggleWide: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: def.key,
    disabled: !editMode,
  });

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={
        "chart-card" +
        (wide ? " chart-card--wide" : "") +
        (editMode ? " is-editing" : "") +
        (hidden ? " is-hidden-card" : "") +
        (isDragging ? " is-dragging" : "")
      }
    >
      {editMode && (
        <div className="chart-edit">
          <button
            type="button"
            className="drag-handle"
            aria-label={`${def.name} 자리 옮기기`}
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
          <button
            type="button"
            className="set-hide-btn"
            onClick={onToggleWide}
            title={
              wide
                ? "한 줄을 다 쓰고 있다. 눌러서 반 칸으로."
                : "반 칸을 쓰고 있다. 눌러서 한 줄 전체로."
            }
          >
            {wide ? "한 줄" : "반 칸"}
          </button>
          <button
            type="button"
            className={`set-hide-btn${hidden ? " on" : ""}`}
            onClick={onToggleHide}
            title={hidden ? "다시 보이게 한다." : "감춘다 — 씀씀이에서 빠진다."}
          >
            {hidden ? "감춤" : "감추기"}
          </button>
        </div>
      )}

      {def.node}
    </section>
  );
}

export default function Charts() {
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

  /* Blur를 걸어 둔 갈래를 셈에 넣을지. 처음에는 빼 둔다. */
  const [blurOn, setBlurOn] = useState(false);

  /* Exclude를 걸어 둔 갈래를 뺄지. 처음에는 뺀다(켜짐) */
  const [excludeOn, setExcludeOn] = useState(true);

  const [filterOpen, setFilterOpen] = useState(false);

  /* 그림 카드의 차례와 감춤 — 다른 설정 화면처럼 [편집] 을 눌러야 손댈 수 있다 */
  const [editMode, setEditMode] = useState(false);
  const [cardOrder, setCardOrder] = useState<string[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  /* 한 줄을 다 쓰는 카드. 처음 값은 코드가 적어 둔 것을 따른다 */
  const [wideSet, setWideSet] = useState<Set<string>>(new Set());
  /* [편집] 을 누른 순간의 모습 — 바뀐 것이 없으면 그렇게 알린다 */
  const [beforeEdit, setBeforeEdit] = useState("");
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [appliedFilter, setAppliedFilter] = useState<Filter>(EMPTY_FILTER);

  const wide = useWide();

  /* 고르는 목록들 — 그림에 이름을 붙이는 데도 쓴다. */
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
            /* 카드 실적은 구분이 `카드` 인 것만 센다. */
            category: p.category,
            is_active: p.is_active,
          })
        )
      )
    );
  }, []);

  /* 세 자료를 한 달치로 모은다 — 달력과 같은 방식이다. */
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
     줄의 IN/OUT뿐 아니라 갈래 자체가 IN이면 아예 뺀다. */
  const inSet = useMemo(
    () => new Set(cat2List.filter((c) => c.inout === 1).map((c) => c.id)),
    [cat2List]
  );

  const excSets = useMemo(
    () => excludeSetsFrom(cat1List, cat2List, cat3List),
    [cat1List, cat2List, cat3List]
  );

  /* 셈에 넣을 줄인지 가리는 잣대.이 달 그림과 12개월 추이가 같은 것을 봐야
     끝점이 위 요약 판과 어긋나지 않는다. */
  const keep = useCallback(
    (r: Row) =>
      on[r.src] &&
      r.inout !== 1 &&
      !inSet.has(Number(r.cat2_id)) &&
      (blurOn || !isBlurred(r, blurSets)) &&
      !(excludeOn && isExcluded(r, excSets)) &&
      pass(r, appliedFilter),
    [on, inSet, blurOn, blurSets, excludeOn, excSets, appliedFilter]
  );

  const shown = useMemo(
    () => rows.filter(keep),
    [rows, keep]
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
       0으로 길게 깔려 그림이 오른쪽으로 납작해진다. */
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

  /* ─── 12개월 추이 ─────────────────────────────────────────────
     고른 달을 끝으로 열두 달. 달마다 따로 물어 와서 이 화면이 쓰는 잣대(keep)로
     똑같이 거른다. 서버에서 미리 합쳐 오면 걸러 내기 · Exclude · Blur 규칙을
     양쪽에 두 벌로 두게 되고, 언젠가 한쪽만 고쳐져 끝점이 위 요약 판과 어긋난다. */
  /* 몇 달을 볼지. 손잡이를 옮길 때마다 다시 물어 오면 한 칸에 열여덟 번을
     묻게 되므로, 받는 것은 늘 최대치(18달)로 두고 그중 뒤에서 몇 달만 잘라 쓴다. */
  const [monthCount, setMonthCount] = useState(12);

  const allMonths = useMemo(() => {
    const [y, m] = yearMonth.split("-").map(Number);
    const out: string[] = [];
    for (let i = TREND_MAX - 1; i >= 0; i -= 1) {
      const d = new Date(y, m - 1 - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return out;
  }, [yearMonth]);

  const months = useMemo(
    () => allMonths.slice(TREND_MAX - monthCount),
    [allMonths, monthCount]
  );

  const [trendRows, setTrendRows] = useState<(Row & { ym: string })[]>([]);

  useEffect(() => {
    let alive = true;

    Promise.all([
      ...allMonths.map((ym) =>
        axios.get("/entries/month", { params: { ym } }).then((r) => r.data).catch(() => [])
      ),
      axios.get("/pending-entries").then((r) => r.data).catch(() => []),
      axios.get("/scheduled-entries").then((r) => r.data).catch(() => []),
    ]).then((res) => {
      if (!alive) return;
      const out: (Row & { ym: string })[] = [];

      type Raw = Record<string, unknown>;
      const push = (src: Src, list: Raw[], dateField: string, idField: string, ym: string) => {
        list.forEach((x) => {
          const raw = String(x[dateField] ?? "");
          if (!raw.startsWith(ym)) return;
          const d = dayOf(raw);
          if (!d) return;
          out.push({
            key: `${ym}-${src}-${x[idField]}`,
            src,
            ym,
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

      allMonths.forEach((ym, i) => {
        push("expense", res[i] as Raw[], "tx_date", "entry_id", ym);
        push("pending", res[TREND_MAX] as Raw[], "tx_date", "entry_id", ym);
        push("scheduled", res[TREND_MAX + 1] as Raw[], "next_run_at", "schedule_id", ym);
      });
      setTrendRows(out);
    });

    return () => {
      alive = false;
    };
  }, [allMonths]);

  const byMonth = useMemo(() => {
    const sums = new Map<string, number>();
    months.forEach((ym) => sums.set(ym, 0));
    trendRows.forEach((r) => {
      if (keep(r)) sums.set(r.ym, (sums.get(r.ym) ?? 0) + r.net);
    });
    /* 열쇠는 연-월 그대로 둔다. "8월"로 두면 열두 달을 넘길 때
       작년 8월과 올해 8월이 같은 칸으로 뭉쳐 값이 더해진다. */
    return months.map((ym) => ({
      ym,
      지출: Math.round(sums.get(ym) ?? 0),
    }));
  }, [months, trendRows, keep]);

  /* ─── 중분류 하나를 골랐을 때 ─────────────────────────────────
     누르자마자 팝업이 덮으면 도넛을 더 들여다볼 수가 없다.
     누르는 것은 고르는 데까지고, 파고드는 것은 머리말에 뜨는 단추로 한다.
     막대 빛깔은 도넛에서 그 중분류가 쓰던 것 그대로다. */
  const [pickedCat, setPickedCat] = useState<{ name: string; color: string } | null>(null);
  const [drillOpen, setDrillOpen] = useState(false);

  const byCat2 = useMemo(() => {
    if (!pickedCat) return [];
    const cat1Of = new Map(cat1List.map((c) => [c.id, c.name]));
    const cat2Of = new Map(cat2List.map((c) => [c.id, c.name]));
    const m = new Map<string, number>();
    shown.forEach((r) => {
      if ((cat1Of.get(Number(r.cat1_id)) ?? "분류 없음") !== pickedCat.name) return;
      const k = cat2Of.get(Number(r.cat2_id)) ?? "소분류 없음";
      m.set(k, (m.get(k) ?? 0) + r.net);
    });
    return [...m.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value), color: pickedCat.color }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [pickedCat, shown, cat1List, cat2List]);

  /* 소분류 하나를 더 파고들었을 때 쓸 세분류 묶음 — 소분류 이름으로 찾는다.
     세분류를 아예 안 쓰는 소분류는 여기에 담지 않는다. 그래야 팝업에서
     "펼칠 것이 있는 줄"과 없는 줄을 가릴 수 있다.
     하나라도 세분류가 붙어 있으면 나머지는 "세분류 없음"으로 모아 둔다 —
     그러지 않으면 펼친 쪽 합이 왼쪽 막대보다 작아 보인다. */
  const byCat3 = useMemo(() => {
    const out = new Map<string, { name: string; value: number; color: string }[]>();
    if (!pickedCat) return out;
    const cat1Of = new Map(cat1List.map((c) => [c.id, c.name]));
    const cat2Of = new Map(cat2List.map((c) => [c.id, c.name]));
    const cat3Of = new Map(cat3List.map((c) => [c.id, c.name]));

    const nested = new Map<string, Map<string, number>>();
    const named = new Set<string>();
    shown.forEach((r) => {
      if ((cat1Of.get(Number(r.cat1_id)) ?? "분류 없음") !== pickedCat.name) return;
      const k2 = cat2Of.get(Number(r.cat2_id)) ?? "소분류 없음";
      const n3 = cat3Of.get(Number(r.cat3_id));
      if (n3) named.add(k2);
      const inner = nested.get(k2) ?? new Map<string, number>();
      inner.set(n3 ?? "세분류 없음", (inner.get(n3 ?? "세분류 없음") ?? 0) + r.net);
      nested.set(k2, inner);
    });

    nested.forEach((inner, k2) => {
      if (!named.has(k2)) return;
      const list = [...inner.entries()]
        .map(([name, value]) => ({ name, value: Math.round(value), color: pickedCat.color }))
        .filter((x) => x.value > 0)
        .sort((a, b) => b.value - a.value);
      if (list.length) out.set(k2, list);
    });
    return out;
  }, [pickedCat, shown, cat1List, cat2List, cat3List]);

  /* 파고들 것이 있는지 — 단추를 살릴지 자리만 남길지 가른다. */
  const ready = !!pickedCat && byCat2.length > 0;

  /* ─── 요일별 ──────────────────────────────────────────────── */
  const byDow = useMemo(() => {
    const sums = new Array<number>(7).fill(0);
    byDay.forEach((d) => (sums[d.dow] += d.지출));
    /* 주말만 색을 달리해 한 주의 마디가 보이게 한다.
       빛깔을 자료에 실어 두면 막대 · 말풍선이 한 값을 본다. */
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

     결제 수단 구분이 `카드` 인 것만 센다. 걸러 낸 조건 · Exclude · Blur는
     다른 그림과 똑같이 받는다(shown을 그대로 쓴다). */
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

  /* 지금 보고 있는 카드 — 옆으로 넘겨 하나씩 본다. */
  const [cardAt, setCardAt] = useState(0);
  const cardStripRef = useRef<HTMLDivElement | null>(null);

  /* 카드 수가 줄면 보던 자리가 목록 밖으로 나갈 수 있다. */
  useEffect(() => {
    if (cardAt > byCard.length - 1) setCardAt(0);
  }, [byCard.length, cardAt]);

  /* 넓은 화면에서는 한 장이 판 전체를 차지하지 않고 요약 판 한 칸 너비다.
     그래서 넘김 단위는 화면 너비가 아니라 "한 장 + 사이 여백"이다. */
  const cardStep = () => {
    const el = cardStripRef.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return 1;
    const gap = parseFloat(getComputedStyle(el).columnGap || "0") || 0;
    return first.getBoundingClientRect().width + gap;
  };

  /** 넘긴 만큼 점을 옮긴다 — 손가락으로 쓸든 단추를 누르든 한 곳에서 센다. */
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

  /* 그림 카드 여섯. 코드가 적어 둔 이 차례가 기본값이고, 사람이 바꾼 차례는
     서버에 담아 두었다가 덮어쓴다. 껍데기(카드 틀·손잡이)는 ChartCardBox 가
     맡으므로 여기에는 안쪽 그림만 든다 */
  const CARD_DEFS: CardDef[] = [
    {
      key: "daily",
      name: "날짜별",
      node: (
        <>
              <header className="chart-card__head">
                <h3 className="chart-card__title">날짜별</h3>
              </header>
              <div className="chart-card__body">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byDay} margin={{ top: 8, right: 6, bottom: 0, left: -6 }}>
                    <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={false} interval={4} />
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={shortWon} />
                    <Tooltip {...TIP_PROPS} content={<Tip suffix="일" />} />
                    <Bar dataKey="지출" fill={SPEND} radius={[4, 4, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
        </>
      ),
    },
    {
      key: "cumulative",
      name: "누적",
      node: (
        <>
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
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={shortWon} />
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
        </>
      ),
    },
    {
      key: "trend",
      name: "추이",
      node: (
        <>
              <header className="chart-card__head">
                <h3 className="chart-card__title">{monthCount}개월 추이</h3>
                <span className="chart-range-wrap">
                  <span className="chart-range__end">최근 {TREND_MIN}개월</span>
                  <input
                    type="range"
                    className="chart-range"
                    min={TREND_MIN}
                    max={TREND_MAX}
                    step={1}
                    value={monthCount}
                    onChange={(e) => setMonthCount(Number(e.target.value))}
                    aria-label="볼 개월 수"
                  />
                  <span className="chart-range__end">{TREND_MAX}개월</span>
                </span>
              </header>
              <div className="chart-card__body">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={byMonth} margin={{ top: 8, right: 6, bottom: 0, left: -6 }}>
                    <XAxis
                      dataKey="ym"
                      tick={AXIS}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: string) => `${Number(String(v).slice(5))}월`}
                    />
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={shortWon} />
                    <Tooltip
                      {...TIP_PROPS}
                      content={<Tip labelFormat={(v) => `${String(v).slice(0, 4)}. ${Number(String(v).slice(5))}.`} />}
                    />
                    <Line
                      type="linear"
                      dataKey="지출"
                      /* 열두 달을 훑는 그림이라 이 달을 말하는 그림들과 톤을 갈라 둔다.
                         팔레트의 회색은 갈래 색이 아니라 눈에 덜 띄어야 하는 자리의 것이다. */
                      stroke={ETC_COLOR}
                      strokeWidth={3}
                      strokeLinejoin="miter"
                      dot={{ r: 4, fill: ETC_COLOR, stroke: "#FFFFFF", strokeWidth: 2 }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: "#FFFFFF" }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
        </>
      ),
    },
    {
      key: "cat1",
      name: "중분류별",
      node: (
        <>
              <header className="chart-card__head chart-card__head--drill">
                <h3 className="chart-card__title">중분류별</h3>
                {/* 고른 것이 없어도 자리는 늘 잡아 둔다 — 단추가 나타났다 사라질 때마다.
                    머리말 높이가 달라지면 아래 그림이 그만큼 들썩인다. */}
                <button
                  type="button"
                  className={`chart-drill-btn${ready ? "" : " is-empty"}`}
                  onClick={() => setDrillOpen(true)}
                  disabled={!ready}
                  aria-hidden={!ready}
                  tabIndex={ready ? 0 : -1}
                >
                  <span
                    className="chart-legend__key"
                    style={{ background: pickedCat?.color ?? "transparent" }}
                    aria-hidden="true"
                  />
                  {pickedCat?.name ?? ""}
                  <span className="chart-drill-btn__caret" aria-hidden="true">
                    ›
                  </span>
                </button>
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
                        className="chart-pie--pickable"
                        onClick={(slice: { name?: string; color?: string }) => {
                          /* "기타"는 여러 갈래를 묶은 것이라 더 쪼갤 것이 없다. */
                          if (!slice?.name || slice.name === "기타") return;
                          setPickedCat((prev) =>
                            prev?.name === slice.name
                              ? null
                              : { name: slice.name as string, color: slice.color ?? ETC_COLOR }
                          );
                        }}
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
        </>
      ),
    },
    {
      key: "pay",
      name: "결제 수단별",
      node: (
        <>
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
                      {/* 자리가 넉넉할 때만 값을 적는다. 좁으면 눌러서 본다. */}
                      {wide && (
                        <LabelList
                          dataKey="value"
                          position="right"
                          offset={8}
                          formatter={(v: unknown) => shortWon(Number(v))}
                          style={{ fontSize: 14, fontWeight: 700, fill: "#6C757D" }}
                        />
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
        </>
      ),
    },
    {
      key: "weekday",
      name: "요일별",
      node: (
        <>
              <header className="chart-card__head">
                <h3 className="chart-card__title">요일별</h3>
              </header>
              <div className="chart-card__body chart-card__body--short">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byDow} margin={{ top: wide ? 18 : 8, right: 6, bottom: 0, left: -6 }}>
                    <XAxis dataKey="요일" tick={AXIS} tickLine={false} axisLine={false} />
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={shortWon} />
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
                          style={{ fontSize: 14, fontWeight: 700, fill: "#6C757D" }}
                        />
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
        </>
      ),
    },
  ];

  /* 끌기는 편집 모드에서만 산다. 설정 화면들이 쓰는 것과 같은 감지기다 */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } })
  );

  /* 담아 둔 차례와 감춤을 받아 온다. 표에 없는 카드는 코드가 적어 둔
     차례 그대로 맨 뒤에 선다 — 그림을 새로 만들어도 저절로 따라온다 */
  useEffect(() => {
    axios
      .get("/charts/cards")
      .then((r) => {
        const rows = r.data as { card_key: string; is_active: number; span: number }[];
        const saved = rows.map((x) => x.card_key).filter((k) => CARD_KEYS.includes(k));
        setCardOrder([...saved, ...CARD_KEYS.filter((k) => !saved.includes(k))]);
        setHidden(new Set(rows.filter((x) => !x.is_active).map((x) => x.card_key)));
        /* 담아 둔 것이 있으면 그것을, 없으면 코드가 적어 둔 넓이를 쓴다 */
        setWideSet(
          new Set(
            CARD_KEYS.filter((k) => {
              const row = rows.find((x) => x.card_key === k);
              return row ? row.span >= 2 : CARD_WIDE.includes(k);
            })
          )
        );
      })
      .catch(() => {
        setCardOrder(CARD_KEYS);
        setWideSet(new Set(CARD_WIDE));
      });
  }, []);

  /* 그릴 카드 — 평소에는 감춘 것을 빼고, 편집 모드에서는 되살릴 수 있도록 남긴다.
     여섯 장뿐이라 따로 기억해 둘 것 없이 그때그때 고른다 */
  const byKey = new Map(CARD_DEFS.map((c) => [c.key, c]));
  const shownCards = (cardOrder.map((k) => byKey.get(k)).filter(Boolean) as CardDef[])
    .filter((c) => editMode || !hidden.has(c.key));

  const onCardDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setCardOrder((prev) => {
      const from = prev.indexOf(String(active.id));
      const to = prev.indexOf(String(over.id));
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  };

  const toggleWide = (key: string) =>
    setWideSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleHide = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const stamp = (order: string[], off: Set<string>, big: Set<string>) =>
    JSON.stringify(order.map((k) => [k, off.has(k) ? 0 : 1, big.has(k) ? 2 : 1]));

  /* 다른 설정 화면과 같은 흐름 — [편집] 으로 열고 [저장] 으로 담는다 */
  const toggleEdit = async () => {
    if (!editMode) {
      setBeforeEdit(stamp(cardOrder, hidden, wideSet));
      setEditMode(true);
      return;
    }
    if (stamp(cardOrder, hidden, wideSet) === beforeEdit) {
      alert("변경된 내용이 없습니다만...?");
      setEditMode(false);
      return;
    }
    try {
      await axios.post(
        "/charts/cards",
        cardOrder.map((k) => ({
          card_key: k,
          is_active: hidden.has(k) ? 0 : 1,
          span: wideSet.has(k) ? 2 : 1,
        }))
      );
      setEditMode(false);
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  };


  /* [적용]을 누르지 않고 닫으면 고치던 값은 버린다. */
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

            {/* 다른 설정 화면과 같은 자리 — 툴바 오른쪽 끝 */}
            <button type="button" className="ui-btn primary chart-edit__btn" onClick={toggleEdit}>
              {editMode ? "저장" : "편집"}
            </button>
          </div>
        </div>
      </div>

      {/* 무엇을 겹쳐 볼지 — 달력과 같다. */}
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
                /* 다시 펼 때는 첫 장부터 — 접힌 사이 자리가 어긋나 있을 수 있다. */
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

      {/* 한 달 요약 — 이 화면은 나간 돈만 센다. */}
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
        <p className="page-empty">지출 내역이 없습니다.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onCardDragEnd}>
          <SortableContext items={cardOrder} strategy={rectSortingStrategy}>
            <div className="chart-grid">
              {shownCards.map((c) => (
                <ChartCardBox
                  key={c.key}
                  def={c}
                  editMode={editMode}
                  hidden={hidden.has(c.key)}
                  wide={wideSet.has(c.key)}
                  onToggleHide={() => toggleHide(c.key)}
                  onToggleWide={() => toggleWide(c.key)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* 필터 — 달력과 같은 부품을 쓴다. */}
      {filterOpen && (
        <EntryFilterPopup
          filter={filter}
          setFilter={setFilter}
          cat1List={cat1List}
          cat2List={cat2List}
          cat3List={cat3List}
          payList={payList}
          cpList={cpList}
          /* 이 화면은 나가는 돈만 다룬다 — 고를 것이 없어 칸을 빼 둔다. */
          showInout={false}
          onClose={closeFilter}
          onApply={() => {
            setAppliedFilter(filter);
            setFilterOpen(false);
          }}
        />
      )}

      {drillOpen && pickedCat && byCat2.length > 0 && (
        <CatDrillPopup
          cat={pickedCat}
          rows={byCat2}
          sub={byCat3}
          onClose={() => setDrillOpen(false)}
        />
      )}

      <QuickActions />
    </div>
  );
}

/**
 * 중분류 하나를 눌렀을 때 그 안을 소분류로 쪼개 보여 주는 팝업.
 *
 * 껍데기는 필터 팝업과 같은 틀(popup-overlay · popup-panel--framed)을 쓴다.
 * 막대는 결제 수단별 그림과 같은 가로 막대이고, 빛깔은 도넛에서 그 중분류가
 * 쓰던 것 하나로 통일한다 — 여기 있는 것은 모두 그 갈래에 딸린 것이라
 * 서로 다른 색으로 갈라 놓을 이유가 없다.
 */
function CatDrillPopup({
  cat,
  rows,
  sub,
  onClose,
}: {
  cat: { name: string; color: string };
  rows: { name: string; value: number; color: string }[];
  sub: Map<string, { name: string; value: number; color: string }[]>;
  onClose: () => void;
}) {
  useBackClose(true, onClose);

  useEffect(() => {
    document.documentElement.classList.add("modal-open");
    return () => document.documentElement.classList.remove("modal-open");
  }, []);

  /* 고른 소분류와, 그것을 펼쳤는지. 도넛에서와 같이 누르는 것은 고르는 데까지고
     넘어가는 것은 머리말 단추로 한다 — 누르자마자 넘어가면 소분류 그림을
     들여다볼 수가 없다. 세분류가 붙어 있는 줄에서만 골라진다. */
  const [picked, setPicked] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const subRows = open && picked ? sub.get(picked) ?? null : null;

  /* 뒤로 가기는 한 걸음씩 — 펼친 자리를 먼저 접고, 그다음이 팝업이다.
     위 useBackClose보다 뒤에 걸리므로 겹칠 때 이쪽이 먼저 답한다.
     접어도 고른 것은 남긴다. 단추가 그대로 있어야 다시 넘어갈 수 있다. */
  const foldSub = useCallback(() => setOpen(false), []);
  useBackClose(!!subRows, foldSub);

  /* 펼친 자리를 눈에 넣어 준다. 판이 좁아 두 그림을 나란히 세우면 막대가
     남는 폭이 30px도 안 되므로, 옆으로 밀어 보이는 쪽을 택했다. */
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: subRows ? el.scrollWidth : 0, behavior: "smooth" });
  }, [subRows]);

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel popup-panel--framed"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={cat.name}
      >
        <header className="popup-head">
          <h3 className="popup-head__title popup-head__title--crumb">
            <span className="chart-legend__key" style={{ background: cat.color }} />
            {subRows ? (
              <>
                <button type="button" className="chart-crumb" onClick={foldSub}>
                  {cat.name}
                </button>
                <span className="chart-crumb__caret" aria-hidden="true">
                  ›
                </span>
                <span className="chart-crumb__now">{picked}</span>
              </>
            ) : (
              <span className="chart-crumb__now">{cat.name}</span>
            )}
          </h3>

          {/* 넘어가는 단추와 돌아오는 단추가 한자리를 나눠 쓴다.
              이름은 늘 갈 곳을 적는다 — 들어갈 때는 그 소분류, 나올 때는 중분류다.
              고른 것이 없을 때도 자리는 남겨 둬야 머리말이 들썩이지 않는다. */}
          <button
            type="button"
            className={`chart-drill-btn${picked ? "" : " is-empty"}`}
            onClick={() => setOpen((v) => !v)}
          >
            {subRows ? (
              <>
                <span className="chart-drill-btn__caret" aria-hidden="true">
                  ‹
                </span>
                <span className="chart-drill-btn__name">{cat.name}</span>
              </>
            ) : (
              <>
                <span className="chart-drill-btn__name">{picked ?? ""}</span>
                <span className="chart-drill-btn__caret" aria-hidden="true">
                  ›
                </span>
              </>
            )}
          </button>
        </header>

        <div className="popup-body chart-drill" ref={scroller}>
          <section
            className="chart-drill__pane chart-card__body chart-card__body--rows"
            style={{ "--rows": rows.length } as React.CSSProperties}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 52, bottom: 0, left: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ ...AXIS, fill: "#6C757D" }}
                  tickLine={false}
                  axisLine={false}
                  /* 소분류가 하나뿐이면 눈금이 통째로 빠져 이름이 안 보였다. */
                  interval={0}
                  width={92}
                  tickFormatter={(v: string) => (v.length <= 10 ? v : `${v.slice(0, 9)}…`)}
                />
                <Tooltip {...TIP_PROPS} content={<Tip />} />
                <Bar
                  dataKey="value"
                  name="지출"
                  radius={[0, 8, 8, 0]}
                  maxBarSize={22}
                  isAnimationActive={false}
                  onClick={(d: { payload?: { name?: string }; name?: string }) => {
                    const n = d?.payload?.name ?? d?.name;
                    if (!n || !sub.has(n)) return;
                    setOpen(false);
                    setPicked((p) => (p === n ? null : n));
                  }}
                >
                  {rows.map((r) => (
                    <Cell
                      key={r.name}
                      fill={r.color}
                      /* 더 쪼갤 것이 있는 줄만 손 모양으로 알린다. */
                      style={{ cursor: sub.has(r.name) ? "pointer" : "default" }}
                    />
                  ))}
                  {/* 결제 수단별과 같은 이름표 — 이름만 있고 값이 없으면 글씨가 유난히 작아 보인다. */}
                  <LabelList
                    dataKey="value"
                    position="right"
                    offset={8}
                    formatter={(v: unknown) => shortWon(Number(v))}
                    style={{ fontSize: 14, fontWeight: 700, fill: "#6C757D" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>

          {subRows && (
            <section
              className="chart-drill__pane chart-card__body chart-card__body--rows"
              style={{ "--rows": subRows.length } as React.CSSProperties}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subRows} layout="vertical" margin={{ top: 0, right: 52, bottom: 0, left: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ ...AXIS, fill: "#6C757D" }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    width={92}
                    tickFormatter={(v: string) => (v.length <= 10 ? v : `${v.slice(0, 9)}…`)}
                  />
                  <Tooltip {...TIP_PROPS} content={<Tip />} />
                  <Bar dataKey="value" name="지출" radius={[0, 8, 8, 0]} maxBarSize={22} isAnimationActive={false}>
                    {subRows.map((r) => (
                      <Cell key={r.name} fill={r.color} />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="right"
                      offset={8}
                      formatter={(v: unknown) => shortWon(Number(v))}
                      style={{ fontSize: 14, fontWeight: 700, fill: "#6C757D" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}
        </div>

        <div className="btn-row popup-foot">
          <button className="ui-btn" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
