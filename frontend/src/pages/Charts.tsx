import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  Rectangle,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PieSectorShapeProps, RectangleProps } from "recharts";
import { useNavigate } from "react-router-dom";
import { stash, takeStash } from "../utils/pageState";
import axios from "../api/client";
import useLongPress, { LONG_PRESS_DELAY } from "../hooks/useLongPress";
import useBackClose from "../hooks/useBackClose";
import QuickActions from "./components/QuickActions";
import EntryFilterPopup from "./components/EntryFilterPopup";
import CardPerkPopup, { type PerkTier } from "./components/CardPerkPopup";
import FixedFilter from "./components/FixedFilter";
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
import { currentPalette } from "../utils/palettes";
import { manwon } from "../utils/amount";
import {
  EMPTY_FILTER,
  fixedSetsFrom,
  passFixed,
  ALL_FIXED_PICK,
  fxTag,
  type FixedPick,
  hasCondition,
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

/* 갈래 색 다섯. 값은 고른 빛깔 벌에서 온다(utils/palettes.ts).
   쪽빛 벌의 다섯은 눈으로 고르지 않고 검사기에 걸어 밝기 범위, 채도 바닥,
   색각 이상에서의 이웃 구분(11.6), 정상 시야 구분(18.9)을 넉넉히 통과한 것이다.
   벌을 새로 들일 때도 같은 잣대를 지킨다.
   회색은 갈래 색이 아니라 "기타" 전용이다. 눈에 덜 띄어야 하는 자리다.
   부를 때 읽는 함수인 까닭은 빛깔이 모듈을 읽는 차례보다 늦게 끼워질 수
   있어서다. 값으로 굳혀 두면 그 자리만 옛 색으로 남는다. */
const PALETTE = () => currentPalette().chart;
const ETC_COLOR = () => currentPalette().chartEtc;

/* 한 갈래짜리 그림도 같은 톤으로. 나간 돈은 첫째 색, 쌓인 돈은 넷째 색이다. */
const SPEND = () => currentPalette().chart[0];
const ACC = () => currentPalette().chart[3];
const WEEKDAY = () => currentPalette().chartWeek;

/* 축 눈금. 10은 그림 옆에 두면 유난히 작아 보여 한 단 올렸다 —
   본문 가장 작은 글씨(--font-size-xs)와 같은 크기다. */
const AXIS = { fontSize: 11, fill: "#ADB5BD" };

/* 추이에서 볼 수 있는 달 수. 받아 오는 것은 늘 이 최대치다. */
const TREND_MIN = 2;
const TREND_MAX = 18;

/* ─── 그림 항목을 누르면 그것만 툭 부푼다 ─────────────────────
   내역 카드를 눌렀을 때와 같은 결의 되먹임이다. 잡고 있는 동안이 아니라
   한 번 부풀었다 제자리로 돌아온다 — 그림은 옆으로 넘겨 보는 자리라
   누른 상태를 붙들면 넘기기와 엉킨다.
   부푸는 방향은 항목이 붙어 있는 자리를 붙박아 둔다. 세로 막대는 바닥,
   가로 막대는 왼쪽 끝, 부채꼴은 도넛 한가운데다 — 축에서 떨어지면
   그만큼 값이 달라 보인다. */
const POP_MS = 260;
const POP_EASE = `transform ${POP_MS}ms cubic-bezier(.34, 1.3, .64, 1)`;

/**
 * 눌린 항목이 무엇인지는 **맥락**으로 흘려보낸다.
 *
 * 그림에 넘기는 모양 그리개를 Recharts는 부품으로 삼아 부른다. 그릴 때마다
 * 새 함수를 넘기면 React에게는 매번 다른 부품이라 항목을 통째로 버리고 새로
 * 만든다 — 누르는 사이에 갈아치워지니 클릭이 성립하지 않고, 도넛의 갈래
 * 고르기까지 함께 놓친다. 그래서 그리개는 이 파일에 한 번만 만들어 두고,
 * 눌린 것이 무엇인지는 맥락에서 읽는다. 신원이 고정되니 항목이 살아남는다.
 *
 * 값을 낱개의 속성으로 넘기지 않는 까닭도 있다. Recharts는 넘겨받은 낱개를
 * 제 곳간에 담아 두는데, 그 곳간이 안에 든 것을 통째로 얼려 버린다.
 */
type PopApi = { hit: string; pop: (key: string) => void };

const PopContext = createContext<PopApi>({ hit: "", pop: () => {} });

function usePop(): PopApi {
  const [hit, setHit] = useState("");
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const pop = useCallback((key: string) => {
    window.clearTimeout(timer.current);
    setHit(key);
    timer.current = window.setTimeout(() => setHit(""), POP_MS);
  }, []);
  return useMemo(() => ({ hit, pop }), [hit, pop]);
}

/** 부푼 만큼을 담는 껍데기. 눌린 자리를 붙박아 두고 그 둘레로만 커진다. */
function Pop({
  on,
  at,
  children,
}: {
  on: boolean;
  /** 붙박아 둘 자리(그림 좌표계) */
  at: [number, number];
  children: React.ReactNode;
}) {
  return (
    <g
      style={{
        transformOrigin: `${at[0]}px ${at[1]}px`,
        transform: on ? "scale(1.08)" : "scale(1)",
        transition: POP_EASE,
      }}
    >
      {children}
    </g>
  );
}

/** 막대 하나를 그리는 그리개를 만든다. dir는 부푸는 쪽. */
function barPop(chart: string, dir: "up" | "right") {
  return function PoppedBar(p: RectangleProps & { index?: number }) {
    const { hit } = useContext(PopContext);
    const x = p.x ?? 0;
    const y = p.y ?? 0;
    const w = p.width ?? 0;
    const h = p.height ?? 0;
    return (
      <Pop
        on={hit === `${chart}:${p.index}`}
        at={dir === "up" ? [x + w / 2, y + h] : [x, y + h / 2]}
      >
        <Rectangle {...p} />
      </Pop>
    );
  };
}

/** 부채꼴 하나를 그리는 그리개. 도넛 한가운데를 붙박고 바깥으로 부푼다. */
function sectorPop(chart: string) {
  return function PoppedSector(p: PieSectorShapeProps) {
    const { hit } = useContext(PopContext);
    return (
      <Pop on={hit === `${chart}:${p.index}`} at={[p.cx, p.cy]}>
        <Sector {...p} />
      </Pop>
    );
  };
}

/**
 * 지난달 막대를 그리는 그리개.
 *
 * 제 빛깔로 연하게 칠한다. 칠은 이 달 막대와 같은 빛깔이라 그 위에 겹쳐도
 * 색이 달라지지 않는다 — 그래서 앞에 두어도 뒤에 둔 것처럼 보인다.
 *
 * 앞에 두는 까닭은 지난달이 더 적을 때다. 뒤에만 두면 이 달 막대에 통째로
 * 가려 아무것도 안 보이고, 지난달에 안 썼는지 그림이 없는지 가릴 수가 없다.
 * 그럴 때는 이 달 막대 위에 눈금을 하나 판다 — 지난달 끝이 여기라는 뜻이다.
 * 눈금은 바탕색이다. 같은 빛깔로 그으면 제 막대에 묻혀 보이지 않는다.
 */
type GhostProps = RectangleProps & { payload?: Record<string, unknown> };

function ghostBar(curKey: string, prevKey: string, dir: "up" | "right") {
  return function GhostBar(p: GhostProps) {
    const x = p.x ?? 0;
    const y = p.y ?? 0;
    const w = p.width ?? 0;
    const h = p.height ?? 0;
    const 이달 = Number(p.payload?.[curKey] ?? 0);
    const 지난달 = Number(p.payload?.[prevKey] ?? 0);
    if (지난달 <= 0 || w <= 0 || h <= 0) return null;
    const 덮임 = 이달 >= 지난달;
    return (
      <g style={{ pointerEvents: "none" }}>
        <Rectangle {...p} />
        {덮임 &&
          (dir === "up" ? (
            <line
              x1={x + 0.5}
              x2={x + w - 0.5}
              y1={y}
              y2={y}
              stroke="var(--color-surface)"
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.9}
            />
          ) : (
            <line
              x1={x + w}
              x2={x + w}
              y1={y + 0.5}
              y2={y + h - 0.5}
              stroke="var(--color-surface)"
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.9}
            />
          ))}
      </g>
    );
  };
}

/* 그리개는 화면이 몇 번 그려지든 늘 이 일곱이다. */
const ShapeDaily = barPop("daily", "up");
const ShapePay = barPop("pay", "right");
const ShapeDow = barPop("weekday", "up");
const ShapeCat = sectorPop("cat1");
const GhostUp = ghostBar("지출", "전월", "up");
const GhostRight = ghostBar("value", "전월", "right");

/**
 * 추이 선 그림의 점.
 *
 * 점은 그림 전체가 아니라 저마다 눌려야 하므로 누르는 자리를 직접 단다.
 * 보이는 점(반지름 4)은 손가락으로 겨누기에 작아 속이 빈 큰 원을 하나 더
 * 겹쳐 둔다 — 보이지 않고 누르는 자리만 넓힌다.
 *
 * Recharts가 이 낱개를 복제하며 제 값(cx · cy · index · r)을 덮어씌우므로,
 * 그려지는 모양은 여기 적힌 값으로만 정한다. 밖에 쓴 r과 strokeWidth는
 * 점이 잘리지 않게 그림 가장자리 여백을 잡는 데 쓰인다.
 */
function PopDot({
  cx,
  cy,
  index,
}: {
  cx?: number;
  cy?: number;
  index?: number;
  r?: number;
  strokeWidth?: number;
}) {
  const { hit, pop } = useContext(PopContext);
  if (cx == null || cy == null) return null;
  return (
    <Pop on={hit === `trend:${index}`} at={[cx, cy]}>
      <circle cx={cx} cy={cy} r={4} fill={ETC_COLOR()} stroke="#FFFFFF" strokeWidth={2} />
      <circle
        cx={cx}
        cy={cy}
        r={12}
        fill="transparent"
        style={{ cursor: "pointer" }}
        /* 누르는 순간에 잡는다. 손을 떼기까지 기다리면 그 사이 Recharts가
           툴팁을 띄우며 점을 다시 그려, 누른 곳과 뗀 곳이 다른 낱개가 되어
           클릭이 성립하지 않는다 — 판에 들어와 처음 누르는 한 번이 늘 그랬다. */
        onPointerDown={() => pop(`trend:${index}`)}
      />
    </Pop>
  );
}

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
  name === "기타" ? ETC_COLOR() : PALETTE()[i % PALETTE().length];

/** 이름별로 모은다. */
function 모으기(list: Row[], key: (r: Row) => string): Map<string, number> {
  const 합 = new Map<string, number>();
  list.forEach((r) => 합.set(key(r), (합.get(key(r)) ?? 0) + r.net));
  return 합;
}

/** 견줌 보기 팝업의 한 줄 */
type CmpRow = {
  name: string;
  cur: number;
  prev: number;
};

/** 견줌 보기 팝업이 한 번에 들고 있는 것 */
type PrevCmp = {
  title: string;
  칸: string;
  총이달: number;
  총지난달: number;
  rows: CmpRow[];
};



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

/** "2026-08" → "26' 08". 말풍선과 견줌 보기 팝업이 함께 쓴다. */
const ymTag = (ym: string) => `${ym.slice(2, 4)}' ${ym.slice(5, 7)}`;
const prevTag = (ym: string) => `전월(${ymTag(ym)})`;
const curTag = (ym: string) => `당월(${ymTag(ym)})`;

/** 그림 위에 뜨는 말풍선 — 화면 톤에 맞춰 우리가 그린다. */
type TipItem = {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown> & { name?: string; color?: string; prev?: boolean };
};
function Tip({
  active,
  payload,
  label,
  suffix = "",
  useSliceName = false,
  labelFormat,
  prevLabel = "전월",
  curLabel = "당월",
}: {
  active?: boolean;
  payload?: TipItem[];
  label?: string | number;
  suffix?: string;
  /** 도넛처럼 이름이 조각에 붙어 있는 그림 */
  useSliceName?: boolean;
  /** 축에 담긴 값과 말풍선에 쓸 말이 다를 때 */
  labelFormat?: (v: string | number) => string;
  /** 지난달 줄에 붙일 딱지 — 전월(26' 08) */
  prevLabel?: string;
  /** 이 달 줄에 붙일 딱지 — 당월(26' 09) */
  curLabel?: string;
}) {
  /**
   * 들고 남을 그림이 모르게 한다.
   *
   * 밖에서 말풍선 위로 바로 들어오면 Recharts는 그것을 "그림에 들어왔다"로
   * 셌어 손이 닿은 자리를 다시 재고, 그 자리는 그림 밖이라 말풍선을 거둔다.
   * 리액트는 이 손질을 뿌리에서 모아 듣고 들고 남을 따로 계산하므로, 리액트 손으로
   * 끓는 것은 이미 늦다. 뿌리까지 닿기 전에 여기서 끓는다.
   */
  const 상자 = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = 상자.current;
    if (!el) return;
    const 끓기 = (e: Event) => e.stopPropagation();
    el.addEventListener("mouseover", 끓기);
    el.addEventListener("mouseout", 끓기);
    return () => {
      el.removeEventListener("mouseover", 끓기);
      el.removeEventListener("mouseout", 끓기);
    };
  });

  if (!active || !payload?.length) return null;
  const slice = payload[0]?.payload;
  const head = useSliceName
    ? slice?.name
    : labelFormat
    ? labelFormat(label ?? "")
    : `${label ?? ""}${suffix}`;

  /* 도넛은 조각마다 말풍선이 따로 뜨므로 지난달 줄을 여기서 한 줄 더 만든다.
     가는 고리를 겨누게 하지 않으려는 것이다 — 이 달 조각만 누르면 두 달이
     함께 나온다. */
  const 도넛지난달 = useSliceName && slice?.전월 !== undefined ? Number(slice.전월) : null;

  /* 두 달을 나란히 놓을 때만 이름표를 붙인다. 한 줄뿐인 그림에서는 무엇을
     말하는지가 머리말에 이미 적혀 있다. */
  const 견줌 = payload.length > 1 || 도넛지난달 !== null;
  /**
   * 말풍선 위의 누름은 여기서 끓는다.
   *
   * 그대로 두면 두 가지가 일어난다. 하나는 Recharts가 "그림을 눌렀다"로 받는
   * 것이고, 다른 하나는 그림에 서 있던 포커스가 말풍선으로 옮겨가는 것이다.
   * 둘 다 말풍선을 바로 내려버려, 테이프를 끼려는 순간 말풍선이 먼저 사라졌다
   * (Recharts는 그림이 포커스를 잃으면 눈금만으로 놓은 말풍선을 거둔다).
   *
   * 누름을 여기서 끓고, 누름의 본래 일기리인 포커스 옮기기도 막는다. 안쪽
   * 금액의 끓기 손질은 이보다 먼저 일어나므로 그대로 산다.
   */
  const 끓기 = (e: React.SyntheticEvent) => e.stopPropagation();
  const 누름 = (e: React.MouseEvent) => {
    e.stopPropagation();
    /* 포커스가 그림에 남아 있게 한다. 글자 고르기도 함께 막히는데,
       테이프를 끼는 자리에서는 그편이 낫다. */
    e.preventDefault();
  };
  return (
    <div
      ref={상자}
      className="chart-tip"
      onPointerDown={끓기}
      onMouseDown={누름}
      onTouchStart={끓기}
      onPointerMove={끓기}
      onMouseMove={끓기}
      onTouchMove={끓기}
      /* 들고 남도 끓는다. 밖에서 말풍선 위로 바로 들어오면 Recharts는 그것을
         "그림에 들어왔다"로 셌어 손이 닿은 자리를 다시 재고, 그 자리는 그림 바깥이라
         말풍선을 거둔다. */
      onMouseOver={끓기}
      onMouseOut={끓기}
      onClick={끓기}
    >
      {head && <div className="chart-tip__head">{head}</div>}
      {payload.map((p, i) => {
        /* 지난달 줄은 한 단 흐리게 두고 딱지를 붙인다 — 같은 빛깔의 두 줄이
           이름 없이 나란히 서면 어느 쪽이 이 달인지 알 수 없다. */
        const prev = p.name === "전월" || p.payload?.prev === true;
        return (
          <div key={i} className={`chart-tip__row${prev ? " chart-tip__row--prev" : ""}`}>
            {/* 빛깔은 그 조각이 들고 있는 것을 그대로 쓴다 — 말풍선 차례로
                고르면 조각이 하나뿐인 그림에서 늘 첫 빛깔만 나온다. */}
            <span
              className="chart-tip__dot"
              style={{ background: p.payload?.color ?? p.color ?? ETC_COLOR() }}
            />
            {견줌 && (
              <span className="chart-tip__when">{prev ? prevLabel : curLabel}</span>
            )}
            <span className="chart-tip__value">{won(Number(p.value ?? 0))}</span>
          </div>
        );
      })}
      {도넛지난달 !== null && (
        <div className="chart-tip__row chart-tip__row--prev">
          <span
            className="chart-tip__dot"
            style={{ background: (slice?.color as string) ?? ETC_COLOR() }}
          />
          <span className="chart-tip__when">{prevLabel}</span>
          <span className="chart-tip__value">{won(도넛지난달)}</span>
        </div>
      )}
    </div>
  );
}

/**
 * 지난달을 겹쳐 보는 단추. 그림마다 따로 켜고 끄며, 기억해 두지 않는다.
 * 꾹 누르면 숫자로 견줘 보는 팝업이 뜬다.
 *
 * 꾹 누르기를 useLongPress로 넣지 못한 까닭은 그 훅이 단추에서 시작한 누름을
 * 일부러 무시하기 때문이다 — 카드 안의 단추를 꾹 누른 것을 카드를 꾹 누른
 * 것으로 잡지 않으려는 규칙이다. 누르는 시간과 흔들림 허용치는 그쪽 것을 쓴다.
 */
const PREV_MOVE = 10;

function PrevBtn({
  on,
  onToggle,
  onHold,
}: {
  on: boolean;
  onToggle: () => void;
  onHold: () => void;
}) {
  const timer = useRef(0);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const [pressing, setPressing] = useState(false);

  const stop = useCallback(() => {
    window.clearTimeout(timer.current);
    origin.current = null;
    setPressing(false);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      className={`chart-prev-btn${on ? " on" : ""}${pressing ? " pressing" : ""}`}
      aria-pressed={on}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        fired.current = false;
        origin.current = { x: e.clientX, y: e.clientY };
        setPressing(true);
        timer.current = window.setTimeout(() => {
          origin.current = null;
          fired.current = true;
          setPressing(false);
          onHold();
        }, LONG_PRESS_DELAY);
      }}
      onPointerMove={(e) => {
        const o = origin.current;
        if (!o) return;
        if (Math.abs(e.clientX - o.x) > PREV_MOVE || Math.abs(e.clientY - o.y) > PREV_MOVE) stop();
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => {
        if (pressing || fired.current) e.preventDefault();
      }}
      onClick={() => {
        /* 꾹 누른 뒤에 따라오는 클릭까지 받으면 팝업을 열면서 겹쳐 보기까지
           함께 켜진다. 한 번만 삼킨다. */
        if (fired.current) {
          fired.current = false;
          return;
        }
        onToggle();
      }}
      title={
        on
          ? "지난달 겹쳐 보기를 끈다. 꾹 누르면 숫자로 본다."
          : "지난달을 흐리게 겹쳐 본다. 꾹 누르면 숫자로 본다."
      }
    >
      <span className="chart-prev-btn__key" aria-hidden="true" />
      전월 대비
    </button>
  );
}

/**
 * 가려 둔 갈래가 섞인 금액.
 *
/** 카드 실적 한 장 — 꾹 누르면 그 카드로 그은 내역을 상세로 펼친다. */
/** 상세로 갔다 되돌아왔을 때 되살릴 것 */
type ChartKeep = {
  yearMonth: string;
  on: Record<Src, boolean>;
  fixPick: FixedPick;
  filter: Filter;
  appliedFilter: Filter;
  cardOpen: boolean;
  cardAt: number;
};

function CardPerfItem({
  card,
  tiers,
  onOpen,
  onPerks,
}: {
  card: {
    code: string;
    name: string;
    charged: number;
    mine: number;
    count: number;
    /** 실적에서 뺀 건들의 합. 0이면 딱지를 띄우지 않는다. */
    excluded: number;
  };
  /** 그 카드의 실적 구간과 혜택. 문턱이 낮은 것부터. 없으면 빈 배열 */
  tiers: PerkTier[];
  onOpen: (code: string) => void;
  onPerks: (code: string) => void;
}) {
  const open = useCallback(() => onOpen(card.code), [onOpen, card.code]);
  const { pressing, handlers } = useLongPress(open);

  /* 실적 구간이 있으면 띠는 자가 된다 — 0에서 맨 위 구간까지 늘어놓고
     그은 돈이 어디까지 왔는지 채운다. 구간과 구간 사이는 띠를 끊어 가른다.
     구간을 적어 두지 않은 카드는 잴 자가 없으므로 예전처럼
     그은 돈 가운데 내 몫이 얼마인지를 보인다. */
  const top = tiers.length ? tiers[tiers.length - 1].threshold : 0;
  const ruler = top > 0;
  /* 자의 끝은 맨 위 구간보다 조금 길게 잡는다. 딱 맞추면 마지막 칸막이가 띠의
     둥근 끝에 걸려 보이지 않고, 구간을 넘겨도 넘긴 만큼이 드러나지 않는다. */
  const span = top * 1.08;
  const fill = ruler
    ? Math.min(100, (card.charged / span) * 100)
    : card.charged > 0
    ? Math.min(100, (card.mine / card.charged) * 100)
    : 0;

  return (
    <article
      className={`card-perf__item card-perf__item--pressable${pressing ? " pressing" : ""}`}
      title="꾹 눌러서 상세"
      {...handlers}
    >
      <div className="card-perf__line">
        <span className="card-perf__name">{card.name}</span>
        <span className="card-perf__value">
          {Math.round(card.charged).toLocaleString("ko-KR")}
        </span>
      </div>

      {/* 넓은 줄을 숫자 하나로 비워 두지 않고, 이 판이 말하려는 바로 그것을 담는다. */}
      {/* 채움은 띠 전체에 깔린 그라데이션을 왼쪽부터 드러내는 것이다. 폭을
          줄이면 그라데이션까지 눌려 같은 자리의 빛깔이 달마다 달라진다. */}
      <div className="card-perf__ruler" aria-hidden="true">
        <div className="card-perf__bar">
          <span
            className="card-perf__bar-fill"
            style={{ clipPath: `inset(0 ${100 - fill}% 0 0)` }}
          />
          {ruler &&
            tiers.map((t) => (
              <span
                key={t.threshold}
                className="card-perf__tick"
                style={{ left: `${Math.min(100, (t.threshold / span) * 100)}%` }}
              />
            ))}
        </div>
        {ruler && (
          /* 눈금 금액은 그 칸의 오른쪽 끝에 맞춰 세운다. 가운데에 걸치면
             마지막 구간의 글자가 띠 밖으로 밀려난다. */
          <div className="card-perf__scale">
            {tiers.map((t) => (
              <span
                key={t.threshold}
                className={`card-perf__mark${card.charged >= t.threshold ? " is-past" : ""}`}
                style={{ right: `${100 - Math.min(100, (t.threshold / span) * 100)}%` }}
              >
                {manwon(t.threshold)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="card-perf__line card-perf__line--sub">
        {tiers.length > 0 && (
          <button
            type="button"
            className="card-perf__perk"
            data-no-longpress
            onClick={(e) => {
              e.stopPropagation();
              onPerks(card.code);
            }}
          >
            혜택
          </button>
        )}
        <span className="card-perf__subs">
          {/* 뺀 것이 있을 때만 — 내역에서 본 그 기호가 여기서 다시 나와야
              무엇이 빠졌는지가 이어진다. 뺀 건이 없으면 줄은 예전과 같다. */}
          {card.excluded > 0 && (
            <span
              className="card-perf__sub card-perf__sub--x"
              title="카드 실적에서 뺀 금액"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10.3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <g stroke="currentColor" fill="none">
                  <rect x="5.8" y="8.5" width="12.4" height="8" rx="1.7" strokeWidth="1.4" />
                  <path d="M5.8 11.1h12.4" strokeWidth="1.4" />
                  <path d="M6.9 17.3 17.1 6.9" strokeWidth="1.6" strokeLinecap="round" />
                </g>
              </svg>
              {Math.round(card.excluded).toLocaleString("ko-KR")}
            </span>
          )}
          <span className="card-perf__sub">{card.count}건</span>
          {/* 그은 돈 가운데 돌려받고 남은, 실제로 부담한 내 몫. 여럿 가운데
              하나만 짙은 기호로 짚는다 — N빵의 그 뜻이라 말을 붙이지 않는다. */}
          <span
            className="card-perf__sub card-perf__sub--mine"
            title="그은 돈 가운데 돌려받고 남은 내 몫"
          >
            {/* 둘 다 꽉 채워 그린다. 뒤쪽을 테두리로 그리면 14px에서 획이
                앞사람 어깨와 엉겨 한 덩이로 보였다 — 채우면 옅고 짙은 두
                덩이로 갈려 읽힌다. */}
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              {/* 나 — 짙게 */}
              <circle cx="7.6" cy="9.4" r="3.2" fill="currentColor" />
              <path
                d="M2.2 18.4c0-3 2.4-4.5 5.4-4.5s5.4 1.5 5.4 4.5"
                fill="currentColor"
              />
              {/* 함께한 사람 — 옅게 */}
              <circle cx="18.4" cy="10" r="2.6" fill="currentColor" fillOpacity="0.32" />
              <path
                d="M14.6 18.4c0-2.3 1.7-3.4 3.8-3.4s3.8 1.1 3.8 3.4"
                fill="currentColor"
                fillOpacity="0.32"
              />
            </svg>
            {Math.round(card.mine).toLocaleString("ko-KR")}
          </span>
        </span>
      </div>
    </article>
  );
}

/**
 * 말풍선은 손을 얻으면 사라지는 것이 아니라 누르면 뜨고 붙어 있는다(trigger: click).
 * 금액에 붙은 테이프를 끼어서 보려면 말풍선이 그동안 서 있어야 하기 때문이다.
 * 내려놓는 것은 그림 바깥을 한 번 누를 때다(Charts의 tipAt).
 *
 * 붙들어 두는 힘은 active={true}에서 나온다. Recharts는 손이 그림 밖으로
 * 나가거나 말풍선 위로 옮겨 올 때마다 닿은 자리를 다시 재는데, active가 참이면
 * 한 번이라도 눌렸던 자리를 그대로 붙잡고 있는다. 거짓이면 아예 안 뜨므로,
 * 그림마다 눈금을 하나 두고 눌린 그림에만 참을 준다.
 */
const TIP_PROPS = {
  animationDuration: 160,
  cursor: { fill: "rgba(180, 124, 255, 0.12)" },
  wrapperStyle: { outline: "none" },
  trigger: "click" as const,
};

/** 그림 카드 하나가 들고 있는 것 — 껍데기는 ChartCardBox가 씌운다. */
type CardDef = { key: string; name: string; node: React.ReactNode };

/* 카드 열쇠와 그 차례. 그림은 달마다 새로 그려지지만 열쇠는 그대로라
   바깥에 둔다 — 안에 두면 그릴 때마다 새 배열이 되어 훅이 헛돈다. */
const CARD_KEYS = ["daily", "cumulative", "trend", "cat1", "pay", "weekday"];

/* 처음 넓이 — 사람이 고치기 전까지 쓰는 값. 가로로 긴 그림은 한 줄을 다 쓴다. */
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
  /** 한 줄을 다 쓰는가. 좁은 화면에서는 어차피 한 줄에 하나씩이라 뜻이 없다. */
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
  /* 상세에서 되돌아온 참이면 보던 자리를 그대로 이어 받는다. 한 번 꺼내면
     사라지므로, 탭으로 새로 들어오면 늘 하던 대로 이 달 · 접힌 채로다. */
  const kept = useMemo(() => takeStash<ChartKeep>("charts"), []);

  const [yearMonth, setYearMonth] = useState(
    () =>
      kept?.yearMonth ??
      (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      })()
  );

  /* 겹쳐 볼 자료 — 처음에는 셋 다 켠다. */
  const [on, setOn] = useState<Record<Src, boolean>>(() =>
    kept?.on ?? {
    expense: true,
    pending: true,
    scheduled: true,
  }
  );

  const [rows, setRows] = useState<Row[]>([]);

  /* 어떤 갈래를 셈에 넣을지 — 고정 지출 · 변동 지출. 들어올 때는 둘 다 켜 둔다.
     이 화면은 나간 돈만 세므로 수입 두 칸은 목록에 없다. */
  const [fixPick, setFixPick] = useState<FixedPick>(ALL_FIXED_PICK);

  const [filterOpen, setFilterOpen] = useState(false);

  /* 그림 카드의 차례와 감춤 — 다른 설정 화면처럼 [편집]을 눌러야 손댈 수 있다. */
  const [editMode, setEditMode] = useState(false);
  const [cardOrder, setCardOrder] = useState<string[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  /* 한 줄을 다 쓰는 카드. 처음 값은 코드가 적어 둔 것을 따른다. */
  const [wideSet, setWideSet] = useState<Set<string>>(new Set());
  /* [편집]을 누른 순간의 모습 — 바뀐 것이 없으면 그렇게 알린다. */
  const [beforeEdit, setBeforeEdit] = useState("");
  const [filter, setFilter] = useState<Filter>(() => kept?.filter ?? EMPTY_FILTER);
  const [appliedFilter, setAppliedFilter] = useState<Filter>(() => kept?.appliedFilter ?? EMPTY_FILTER);

  const wide = useWide();

  /* 고르는 목록들 — 그림에 이름을 붙이는 데도 쓴다. */
  const [cat1List, setCat1List] = useState<{ id: number; name: string; is_active?: number }[]>([]);
  const [cat2List, setCat2List] = useState<{ id: number; name: string; cat1_id: number; blur?: number; inout?: number | null; fixed?: number; is_active?: number }[]>([]);
  const [cat3List, setCat3List] = useState<{ id: number; name: string; cat2_id: number; blur?: number; fixed?: number; is_active?: number }[]>([]);
  const [payList, setPayList] = useState<{ code: string; name: string; category?: string; is_active?: number }[]>([]);
  const [cpList, setCpList] = useState<{ counterpart_id: number; name: string }[]>([]);

  const isFilterActive = useMemo(() => hasCondition(appliedFilter), [appliedFilter]);

  const navigate = useNavigate();

  /* 카드 실적을 꾹 누르면 그 카드로 그은 내역을 상세로 펼친다.
     씀씀이의 상세로 간다 — 보고 있던 달과
     자료 갈래 · Blur · Exclude · 걸린 조건을 그대로 싣고, 거기에 이 카드만
     더한다. 그래야 실적이 센 것과 상세에 보이는 것이 어긋나지 않는다. */
  /* 카드마다의 실적 구간과 그 구간의 혜택. 실적 띠가 칸을 가르는 데도,
     [혜택] 팝업이 펼치는 데도 같은 자료를 쓴다.
     구간은 결제 수단 화면에서 적어 두는 값이라 자주 바뀌지 않는다 —
     화면에 들어올 때 카드 갈래만 한 번 받아 둔다. */
  const [tiers, setTiers] = useState<Record<string, PerkTier[]>>({});

  useEffect(() => {
    const cards = payList.filter((p) => p.category === "카드");
    if (!cards.length) return;
    let alive = true;
    Promise.all(
      cards.map((c) =>
        axios
          .get(`/payment-methods/${c.code}/tiers`)
          .then(
            (r) =>
              [
                c.code,
                (r.data as PerkTier[]).map((t) => ({
                  threshold: Number(t.threshold),
                  benefits: t.benefits ?? [],
                })),
              ] as const
          )
          .catch(() => [c.code, [] as PerkTier[]] as const)
      )
    ).then((pairs) => {
      if (!alive) return;
      const bag: Record<string, PerkTier[]> = {};
      pairs.forEach(([code, list]) => {
        bag[code] = [...list].sort((a, b) => a.threshold - b.threshold);
      });
      setTiers(bag);
    });
    return () => {
      alive = false;
    };
  }, [payList]);

  /* 혜택을 펼쳐 볼 카드. 팝업은 보기만 하는 자리라 코드만 들고 있으면 된다. */
  const [perkOf, setPerkOf] = useState<string | null>(null);

  /* 그림에서 방금 누른 항목 — 막대든 부채꼴이든 점이든 이 하나로 가린다. */
  const popApi = usePop();
  const { pop } = popApi;

  const openCardDetail = useCallback(
    (code: string) => {
      const [y, m] = yearMonth.split("-").map(Number);
      const pad = (n: number) => String(n).padStart(2, "0");
      const last = new Date(y, m, 0).getDate();
      const src = SOURCES.filter((s) => on[s.key]).map((s) => s.key).join(",");
      /* 되돌아왔을 때 이 자리가 그대로이도록 맡겨 둔다 — 보던 달 · 켜 둔 것 ·
         걸린 조건, 그리고 카드 실적을 펼친 채 몇째 장을 보고 있었는지. */
      stash("charts", {
        yearMonth,
        on,
        fixPick,
        filter,
        appliedFilter,
        cardOpen: true,
        cardAt: cardAtRef.current,
      });
      navigate(
        `/charts/detail?from=${yearMonth}-01&to=${yearMonth}-${pad(last)}` +
          `&src=${src}&fx=${fxTag(fixPick)}`,
        { state: { filter: { ...appliedFilter, pay: [code] }, back: "씀씀이" } }
      );
    },
    [yearMonth, on, fixPick, filter, appliedFilter, navigate]
  );

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
            /* 씀씀이의 카드 실적만 본다. 다른 그림은 이 표를 보지 않는다. */
            perf_exclude: (x.perf_exclude as number) ?? 0,
            /* 손으로 정해 둔 고정 · 변동. 비면 분류에 정해 둔 것을 따른다. */
            fixed_flag: (x.fixed_flag as number | null) ?? null,
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


  /* 들어오는 갈래(수입 · 캐쉬백 …). 씀씀이는 나가는 돈만 다루므로
     줄의 IN/OUT뿐 아니라 갈래 자체가 IN이면 아예 뺀다. */
  const inSet = useMemo(
    () => new Set(cat2List.filter((c) => c.inout === 1).map((c) => c.id)),
    [cat2List]
  );

  const fixSets = useMemo(() => fixedSetsFrom(cat2List, cat3List), [cat2List, cat3List]);

  /* 셈에 넣을 줄인지 가리는 잣대.이 달 그림과 12개월 추이가 같은 것을 봐야
     끝점이 위 요약 판과 어긋나지 않는다. */
  const keep = useCallback(
    (r: Row) =>
      on[r.src] &&
      r.inout !== 1 &&
      !inSet.has(Number(r.cat2_id)) &&
      passFixed(r, fixPick, fixSets) &&
      pass(r, appliedFilter),
    [on, inSet, fixPick, fixSets, appliedFilter]
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
    shown.forEach((r) => {
      out += r.net;
    });
    return { out, count: shown.length };
  }, [shown]);

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
      return {
        day,
        지출: Math.round(spend[day]),
        누적: Math.round(acc),
        dow: (firstDow + i) % 7,
      };
    });
  }, [shown, daysInMonth, firstDow]);

  /* ─── 중분류별 ────────────────────────────────────────────── */
  const cat1Name = useMemo(() => new Map(cat1List.map((c) => [c.id, c.name])), [cat1List]);
  const payName = useMemo(() => new Map(payList.map((p) => [p.code, p.name])), [payList]);

  const byCat = useMemo(() => {
    const 합 = 모으기(shown, (r) => cat1Name.get(Number(r.cat1_id)) ?? "분류 없음");
    return topN(합, 5).map((s, i) => ({ ...s, color: colorOf(s.name, i) }));
  }, [shown, cat1Name]);

  /* ─── 결제 수단별 ─────────────────────────────────────────── */
  const byPay = useMemo(() => {
    const 합 = 모으기(shown, (r) => payName.get(String(r.pay_method)) ?? "수단 없음");
    return topN(합, 5).map((s, i) => ({ ...s, color: colorOf(s.name, i) }));
  }, [shown, payName]);

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
            /* 씀씀이의 카드 실적만 본다. 다른 그림은 이 표를 보지 않는다. */
            perf_exclude: (x.perf_exclude as number) ?? 0,
            /* 손으로 정해 둔 고정 · 변동. 비면 분류에 정해 둔 것을 따른다. */
            fixed_flag: (x.fixed_flag as number | null) ?? null,
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
    byDay.forEach((d) => {
      sums[d.dow] += d.지출;
    });
    /* 주말만 색을 달리해 한 주의 마디가 보이게 한다.
       빛깔을 자료에 실어 두면 막대 · 말풍선이 한 값을 본다. */
    return WEEKDAYS.map((w, i) => ({
      요일: w,
      지출: Math.round(sums[i]),
      color: i === 0 ? SPEND() : i === 6 ? ACC() : WEEKDAY(),
    }));
  }, [byDay]);

  const catTotal = useMemo(() => byCat.reduce((s, c) => s + c.value, 0), [byCat]);

  /* ─── 전월 대비 ───────────────────────────────────────────────
     그림마다 머리말의 단추로 켜면 지난달이 제 빛깔로 연하게 뒤에 깔린다.
     들어올 때는 늘 꺼진 채이고, 켠 것을 담아 두지 않는다.

     지난달 값은 추이가 이미 받아 둔 열여덟 달에서 꺼내 쓴다. 따로 물어 오면
     걸러 내기와 Exclude, Blur 규칙을 두 벌로 두게 되고, 언젠가 한쪽만 고쳐져
     겹쳐 놓은 두 달이 서로 다른 잣대로 그려진다.

     날짜를 맞추는 법 — 같은 일자끼리 맞추되, 이 달에 없는 날은 이 달 말일에
     몰아 더한다. 2월 28일 자리에 지난 1월의 28~31일이 함께 선다. 그러지
     않으면 짧은 달을 볼 때마다 지난달 끝자락이 통째로 사라진다. */
  const [prevOn, setPrevOn] = useState<Record<string, boolean>>({});
  const togglePrev = useCallback(
    (key: string) => setPrevOn((p) => ({ ...p, [key]: !p[key] })),
    []
  );

  const prevYm = useMemo(() => {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [yearMonth]);

  const prevRows = useMemo(
    () => trendRows.filter((r) => r.ym === prevYm && keep(r)),
    [trendRows, prevYm, keep]
  );

  /* 지난달 하루치 — 자리는 이 달 일자에 맞춰 둔다. */
  const prevByDay = useMemo(() => {
    const spend = new Array<number>(daysInMonth + 1).fill(0);
    prevRows.forEach((r) => {
      spend[Math.min(r.day, daysInMonth)] += r.net;
    });
    return spend;
  }, [prevRows, daysInMonth]);

  const dayRows = useMemo(() => {
    let acc = 0;
    return byDay.map((d) => {
      acc += prevByDay[d.day] ?? 0;
      return {
        ...d,
        전월: Math.round(prevByDay[d.day] ?? 0),
        전월누적: Math.round(acc),
      };
    });
  }, [byDay, prevByDay]);

  /* 요일만은 일자를 옮겨 붙이지 않는다. 말일에 몰아 둔 값을 이 달 요일로 세면
     지난달 목요일에 쓴 돈이 이 달 토요일 자리에 가서 앉는다. 지난달은 제
     달력으로 센다. 보는 창은 이 달 그림과 같게 맞춘다 — 이 달이 20일까지
     그려져 있으면 지난달도 20일까지만 센다. */
  const prevByDow = useMemo(() => {
    const [y, m] = prevYm.split("-").map(Number);
    const first = new Date(y, m - 1, 1).getDay();
    const lastDay = byDay.length;
    const sums = new Array<number>(7).fill(0);
    prevRows.forEach((r) => {
      if (Math.min(r.day, daysInMonth) > lastDay) return;
      sums[(first + r.day - 1) % 7] += r.net;
    });
    return sums;
  }, [prevRows, prevYm, byDay, daysInMonth]);

  const dowRows = useMemo(
    () =>
      byDow.map((d, i) => ({
        ...d,
        전월: Math.round(prevByDow[i]),
      })),
    [byDow, prevByDow]
  );

  /* 지난달 묶음은 이번 달과 같은 잣대(큰 것 다섯에 나머지는 기타)로 묶는다.
     빛깔은 이번 달 도넛에 있는 이름이면 그것을 그대로 쓰고, 지난달에만 있던
     이름은 회색으로 둔다 — 갈래 색을 주면 그 색이 이번 달의 다른 갈래를
     가리켜 거짓말이 된다. */
  const byCatPrev = useMemo(() => {
    const 합 = 모으기(prevRows, (r) => cat1Name.get(Number(r.cat1_id)) ?? "분류 없음");
    const cur = new Map(byCat.map((c) => [c.name, c.color]));
    return topN(합, 5).map((s) => ({
      ...s,
      color: cur.get(s.name) ?? ETC_COLOR(),
      prev: true,
    }));
  }, [prevRows, cat1Name, byCat]);

  const catPrevTotal = useMemo(
    () => byCatPrev.reduce((s, c) => s + c.value, 0),
    [byCatPrev]
  );

  /* 이 달에 한 푼도 쓰지 않은 갈래만 이름표에 줄을 따로 얻는다. 고리에만
     두면 이름을 읽을 곳이 없어 무엇이 사라졌는지 알 수 없다. 이 달에도 썼지만
     "기타"로 묶인 갈래는 여기 세우지 않는다 — 값이 0인 줄로 서면 이번 달에
     안 썼다는 거짓말이 된다. */
  const catOnlyPrev = useMemo(() => {
    const name = new Map(cat1List.map((c) => [c.id, c.name]));
    const 쓴것 = new Set(shown.map((r) => name.get(Number(r.cat1_id)) ?? "분류 없음"));
    return byCatPrev.filter((c) => c.name !== "기타" && !쓴것.has(c.name));
  }, [shown, cat1List, byCatPrev]);

  /* 도넛 조각마다 지난달 몫을 실어 둔다. 고리는 손이 닿지 않게 두고, 이 달
     조각 하나만 눌러도 두 달이 함께 보이게 하려는 것이다. 결제 수단별과 같은
     셈법으로 "기타"에 묶인 몫도 그 줄이 받는다. */
  const catRows = useMemo(() => {
    if (!prevOn.cat1) return byCat.map((c) => ({ ...c }));
    const 키 = (r: Row) => cat1Name.get(Number(r.cat1_id)) ?? "분류 없음";
    const 이달 = 모으기(shown, 키);
    const 지난달 = 모으기(prevRows, 키);
    const 줄이름 = new Set(byCat.map((r) => r.name));
    let 나머지 = 0;
    지난달.forEach((v, k) => {
      if (줄이름.has(k) || !이달.has(k)) return;
      나머지 += v;
    });
    return byCat.map((c) => ({
      ...c,
      전월: Math.round((지난달.get(c.name) ?? 0) + (c.name === "기타" ? 나머지 : 0)),
    }));
  }, [prevOn.cat1, byCat, cat1Name, shown, prevRows]);

  const payRows = useMemo(() => {
    const rows = byPay.map((p) => ({ ...p, 전월: 0 }));
    if (!prevOn.pay) return rows;
    const 키 = (r: Row) => payName.get(String(r.pay_method)) ?? "수단 없음";
    const 이달 = 모으기(shown, 키);
    const 지난달 = 모으기(prevRows, 키);
    const 줄이름 = new Set(rows.map((r) => r.name));
    /* 이 달에 제 줄을 못 얻고 "기타"로 묶인 수단은 지난달 몫도 그 줄이
       받는다. 이름으로만 찾으면 기타 줄의 지난달이 턴에 비게 된다. */
    let 나머지 = 0;
    지난달.forEach((v, k) => {
      if (줄이름.has(k) || !이달.has(k)) return;
      나머지 += v;
    });
    rows.forEach((r) => {
      r.전월 = Math.round((지난달.get(r.name) ?? 0) + (r.name === "기타" ? 나머지 : 0));
    });
    /* 이 달에 아예 쓰지 않은 수단만 줄을 새로 얻는다. 빼 두면 이번 달에
       안 쓴 것인지 애초에 없던 것인지 가릴 수가 없다. */
    [...지난달.entries()]
      .filter(([k, v]) => v > 0 && !줄이름.has(k) && !이달.has(k))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([k, v]) => {
        rows.push({
          name: k,
          value: 0,
          color: ETC_COLOR(),
          전월: Math.round(v),
        });
      });
    return rows;
  }, [prevOn.pay, byPay, payName, prevRows, shown]);

  /* 말풍선이 붙어 있는 그림. 그림 바깥을 누르면 내려놓는다 — 금액의 테이프를
     끌어서 보려면 말풍선이 그동안 서 있어야 한다. */
  const [tipAt, setTipAt] = useState<{ key: string; i?: number } | null>(null);
  /* 말풍선을 붙이는 손. 그림 몸통을 누르면 그 그림으로, 항목을 누르면
     몇째 항목인지까지 적어 둔다. 자리를 적어 두면 Recharts가 손길을 다시 재다가
     놓치더라도 defaultIndex로 그 자리를 되살릴 수 있다. */
  const 붙이기 = useCallback(
    (key: string, i?: number) =>
      setTipAt((p) => {
        /* 몸통을 누른 것(i 없음)은 적어 둔 자리를 지우지 않는다. 지우면
           말풍선을 누를 때마다 자리가 날아가 제자리로 되살릴 수 없다. */
        if (p?.key === key && (i === undefined || p.i === i)) return p;
        return { key, i: i ?? (p?.key === key ? p.i : undefined) };
      }),
    []
  );

  useEffect(() => {
    if (!tipAt) return;
    const 내려놓기 = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      /* 그림 카드 안이면 둔다. 말풍선도 그 안에 있어 끄는 동안 안 꺼진다. */
      if (t?.closest?.(".chart-card")) return;
      setTipAt(null);
    };
    /* 말풍선 위를 오가는 손질은 뿌리에 닿기 전에 끓는다. 리액트는 손질을 뿌리
       한 곳에서 모아 듣고 거기서 들고 남을 지어내므로, 그러기 전에 끓지 않으면
       그림은 밖에서 말풍선으로 들어온 손을 "그림에 들어왔다"로 셌어 닿은 자리를
       다시 재고, 그 자리는 그림 밖이라 말풍선을 거둔다.
       누름과 뗴은 남긴다 — 금액을 끼는 손질이 그것으로 시작하기 때문이다. */
    const 오가는것 = ["mouseover", "mouseout", "mousemove", "pointerover", "pointerout", "pointermove"];
    const 끓기 = (e: Event) => {
      const t = e.target as HTMLElement | null;
      /* 나가는 손질은 떠나는 쪽에서 시작하고 말풍선을 상대로 가리키므로,
         양쪽을 다 봐야 한다. 한쪽만 보면 밖에서 말풍선으로 바로 들어오는 길이 산다. */
      const r = (e as MouseEvent).relatedTarget as HTMLElement | null;
      if (t?.closest?.(".chart-tip") || r?.closest?.(".chart-tip")) e.stopPropagation();
    };
    document.addEventListener("pointerdown", 내려놓기, true);
    오가는것.forEach((ev) => document.addEventListener(ev, 끓기, true));
    return () => {
      document.removeEventListener("pointerdown", 내려놓기, true);
      오가는것.forEach((ev) => document.removeEventListener(ev, 끓기, true));
    };
  }, [tipAt]);

  /* 꾹 누른 그림의 열쇠. 팝업을 닫으면 비운다. */
  const [cmpKey, setCmpKey] = useState<string | null>(null);
  const prevLabel = useMemo(() => prevTag(prevYm), [prevYm]);
  const curLabel = useMemo(() => curTag(yearMonth), [yearMonth]);

  const 견줌 = useCallback(
    (key: (r: Row) => string): CmpRow[] => {
      const a = 모으기(shown, key);
      const b = 모으기(prevRows, key);
      return [...new Set([...a.keys(), ...b.keys()])]
        .map((n) => ({
          name: n,
          cur: Math.round(a.get(n) ?? 0),
          prev: Math.round(b.get(n) ?? 0),
        }))
        .filter((r) => r.cur > 0 || r.prev > 0)
        .sort((x, y) => y.cur + y.prev - (x.cur + x.prev));
    },
    [shown, prevRows]
  );

  const prevCmp = useMemo((): PrevCmp | null => {
    if (!cmpKey) return null;

    if (cmpKey === "daily") {
      return {
        title: "날짜별",
        칸: "일자",
        총이달: dayRows.reduce((a, d) => a + d.지출, 0),
        총지난달: dayRows.reduce((a, d) => a + d.전월, 0),
        /* 두 달 다 0인 날은 세울 것이 없다. 그 밖에는 있는 그대로 다 적는다. */
        rows: dayRows
          .filter((d) => d.지출 > 0 || d.전월 > 0)
          .map((d) => ({
            name: `${d.day}일`,
            cur: d.지출,
            prev: d.전월,
          })),
      };
    }

    if (cmpKey === "cumulative") {
      const 끝 = dayRows[dayRows.length - 1];
      return {
        title: "누적",
        칸: "~까지",
        총이달: 끝?.누적 ?? 0,
        총지난달: 끝?.전월누적 ?? 0,
        rows: dayRows.map((d) => ({
          name: `${d.day}일`,
          cur: d.누적,
          prev: d.전월누적,
        })),
      };
    }

    if (cmpKey === "weekday") {
      return {
        title: "요일별",
        칸: "요일",
        총이달: dowRows.reduce((a, d) => a + d.지출, 0),
        총지난달: dowRows.reduce((a, d) => a + d.전월, 0),
        rows: dowRows.map((d) => ({
          name: d.요일,
          cur: d.지출,
          prev: d.전월,
        })),
      };
    }

    const 분류 = cmpKey === "cat1";
    const rows = 견줌(
      분류
        ? (r) => cat1Name.get(Number(r.cat1_id)) ?? "분류 없음"
        : (r) => payName.get(String(r.pay_method)) ?? "수단 없음"
    );
    return {
      title: 분류 ? "중분류별" : "결제 수단별",
      칸: 분류 ? "중분류" : "결제 수단",
      총이달: rows.reduce((a, r) => a + r.cur, 0),
      총지난달: rows.reduce((a, r) => a + r.prev, 0),
      rows,
    };
  }, [cmpKey, dayRows, dowRows, 견줌, cat1Name, payName]);

  /* ─── 카드 실적 ───────────────────────────────────────────────
     쓴 돈이 아니라 카드에 그은 돈이다. 열 명이 먹은 값 10만 원을 내가
     긁고 2만 원만 부담했다면, 실적은 10만 원이고 내 몫은 2만 원이다.
     그래서 여기서만 r.amount(원래 결제액)를 쓴다 — 다른 그림은 모두
     r.net(쪼갠 뒤 내 몫)을 본다.

     결제 수단 구분이 `카드` 인 것만 센다. 걸러 낸 조건과 고정 · 변동은
     다른 그림과 똑같이 받는다(shown을 그대로 쓴다). */
  const byCard = useMemo(() => {
    const cards = payList.filter((p) => p.category === "카드");
    if (!cards.length) return [];
    const empty = () => ({ charged: 0, mine: 0, count: 0, excluded: 0 });
    const seen = new Map<string, ReturnType<typeof empty>>();
    shown.forEach((r) => {
      const code = String(r.pay_method);
      if (!cards.some((c) => c.code === code)) return;
      const cur = seen.get(code) ?? empty();
      /* 실적에서 빼 둔 건(상품권 · 세금 등)은 그은 돈 · 건수 · 내 몫 어디에도
         넣지 않는다. 얼마를 뺐는지만 따로 모아 딱지로 알린다. 쓴 돈은 쓴
         돈이므로 다른 그림은 그대로 센다. */
      if (r.perf_exclude) {
        cur.excluded += r.amount;
        seen.set(code, cur);
        return;
      }
      cur.charged += r.amount;
      cur.mine += r.net;
      cur.count += 1;
      seen.set(code, cur);
    });
    return cards.map((c) => ({
      code: c.code,
      name: c.name,
      ...(seen.get(c.code) ?? empty()),
    }));
  }, [shown, payList]);

  /* 카드 실적은 접어 둔다. 요약 판과 그림 사이에 늘 펼쳐져 있으면
     지출 흐름을 읽다가 다른 얘기에 걸려 넘어진다. 볼 때만 편다. */
  const [cardOpen, setCardOpen] = useState(() => kept?.cardOpen ?? false);

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
  /* 맡길 때 쓰려고 지금 보는 장을 따로 들고 있는다 — 맡기는 함수가 장이 바뀔
     때마다 새로 만들어지지 않게. */
  const cardAtRef = useRef(0);
  useEffect(() => {
    cardAtRef.current = cardAt;
  }, [cardAt]);

  /* 되돌아왔다면 보던 장으로 굴려 둔다. 카드가 다 실린 뒤라야 굴릴 자리가 있다. */
  const restoreAt = useRef(kept?.cardOpen ? kept.cardAt : 0);
  useEffect(() => {
    const el = cardStripRef.current;
    const want = restoreAt.current;
    if (!el || !cardOpen || !want || byCard.length <= want) return;
    restoreAt.current = 0;
    el.scrollLeft = want * cardStep();
    setCardAt(want);
  }, [cardOpen, byCard.length]);

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

  /* 지금 보고 있는 그대로 — 이 달 · 켜 둔 자료 갈래 · 걸린 조건 — 를 상세로
     펼친다. 카드 실적을
     꾹 눌러 가는 길(openCardDetail)과 한 가지만 다르다: 거기서는 그 카드
     하나로 좁히지만, 여기서는 좁히지 않는다.
     맡겨 두는 자리에는 카드 실적을 펼쳐 두었는지를 지금 값 그대로 담는다 —
     꾹 누르는 길과 달리 접힌 채로도 누를 수 있는 단추다. */
  const openDetail = useCallback(() => {
    const [y, m] = yearMonth.split("-").map(Number);
    const pad = (n: number) => String(n).padStart(2, "0");
    const last = new Date(y, m, 0).getDate();
    const src = SOURCES.filter((s) => on[s.key]).map((s) => s.key).join(",");
    stash("charts", {
      yearMonth,
      on,
      fixPick,
      filter,
      appliedFilter,
      cardOpen,
      cardAt: cardAtRef.current,
    });
    navigate(
      `/charts/detail?from=${yearMonth}-01&to=${yearMonth}-${pad(last)}` +
        `&src=${src}&fx=${fxTag(fixPick)}`,
      { state: { filter: appliedFilter, back: "씀씀이" } }
    );
  }, [yearMonth, on, fixPick, filter, appliedFilter, cardOpen, navigate]);

  /** 한 달 중 가장 많이 쓴 하루 */
  const peak = useMemo(
    () => byDay.reduce((best, d) => (d.지출 > best.지출 ? d : best), { day: 0, 지출: 0 }),
    [byDay]
  );
  const empty = shown.length === 0;

  /* 그림 카드 여섯. 코드가 적어 둔 이 차례가 기본값이고, 사람이 바꾼 차례는
     서버에 담아 두었다가 덮어쓴다. 껍데기(카드 틀·손잡이)는 ChartCardBox가
     맡으므로 여기에는 안쪽 그림만 든다. */
  const CARD_DEFS: CardDef[] = [
    {
      key: "daily",
      name: "날짜별",
      node: (
        <>
              <header className="chart-card__head">
                <h3 className="chart-card__title">날짜별</h3>
                <PrevBtn
                  on={!!prevOn.daily}
                  onToggle={() => togglePrev("daily")}
                  onHold={() => setCmpKey("daily")}
                />
              </header>
              <div className="chart-card__body" onPointerDownCapture={() => 붙이기("daily")}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayRows} margin={{ top: 8, right: 6, bottom: 0, left: -6 }}>
                    <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={false} interval={4} />
                    {/* 지난달 막대는 이 달 막대와 같은 자리에 겹쳐야 한다. Recharts는
                        한 축에 달린 막대를 나란히 세우므로, 숨긴 축을 하나 더 두어
                        따로 세운다. 그래야 둘 다 칸 한가운데에 선다. */}
                    {prevOn.daily && <XAxis xAxisId="prev" dataKey="day" hide />}
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={shortWon} />
                    <Tooltip {...TIP_PROPS} content={<Tip suffix="일" prevLabel={prevLabel} curLabel={curLabel} />} active={tipAt?.key === "daily"}
                      defaultIndex={tipAt?.key === "daily" ? tipAt.i : undefined} />
                    <Bar
                      dataKey="지출"
                      fill={SPEND()}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={18}
                      shape={ShapeDaily}
                      onPointerDown={(_d: unknown, i: number) => {
                        pop(`daily:${i}`);
                        붙이기("daily", i);
                      }}
                    />
                    {prevOn.daily && (
                      <Bar
                        xAxisId="prev"
                        dataKey="전월"
                        name="전월"
                        fill={SPEND()}
                        fillOpacity={0.3}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={18}
                        shape={GhostUp}
                        isAnimationActive={false}
                        style={{ pointerEvents: "none" }}
                      />
                    )}
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
                <PrevBtn
                  on={!!prevOn.cumulative}
                  onToggle={() => togglePrev("cumulative")}
                  onHold={() => setCmpKey("cumulative")}
                />
              </header>
              <div className="chart-card__body chart-card__body--short" onPointerDownCapture={() => 붙이기("cumulative")}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dayRows} margin={{ top: 8, right: 6, bottom: 0, left: -6 }}>
                    <defs>
                      <linearGradient id="acc-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ACC()} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={ACC()} stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={false} interval={4} />
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={shortWon} />
                    <Tooltip
                      {...TIP_PROPS}
                      cursor={{ stroke: WEEKDAY(), strokeWidth: 2 }}
                      content={<Tip suffix="일까지" prevLabel={prevLabel} curLabel={curLabel} />}
                      active={tipAt?.key === "cumulative"}
                      defaultIndex={tipAt?.key === "cumulative" ? tipAt.i : undefined}
                    />
                    {prevOn.cumulative && (
                      <Area
                        type="monotone"
                        dataKey="전월누적"
                        name="전월"
                        stroke={ACC()}
                        strokeOpacity={0.4}
                        strokeWidth={2}
                        strokeLinecap="round"
                        fill="url(#acc-fill)"
                        fillOpacity={0.5}
                        activeDot={false}
                        isAnimationActive={false}
                        style={{ pointerEvents: "none" }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="누적"
                      stroke={ACC()}
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
              <div className="chart-card__body" onPointerDownCapture={() => 붙이기("trend")}>
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
                      active={tipAt?.key === "trend"}
                      defaultIndex={tipAt?.key === "trend" ? tipAt.i : undefined}
                    />
                    <Line
                      type="linear"
                      dataKey="지출"
                      /* 열두 달을 훑는 그림이라 이 달을 말하는 그림들과 톤을 갈라 둔다.
                         팔레트의 회색은 갈래 색이 아니라 눈에 덜 띄어야 하는 자리의 것이다. */
                      stroke={ETC_COLOR()}
                      strokeWidth={3}
                      strokeLinejoin="miter"
                      dot={<PopDot r={4} strokeWidth={2} />}
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
                <PrevBtn
                  on={!!prevOn.cat1}
                  onToggle={() => togglePrev("cat1")}
                  onHold={() => setCmpKey("cat1")}
                />
              </header>
              <div className="chart-donut" onPointerDownCapture={() => 붙이기("cat1")}>
                <div className="chart-donut__plot">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      {/* 지난달은 도넛 바깥에 가는 고리로 두른다. 안쪽에 겹치면
                          이 달 몫을 덮어 두 달 다 못 읽는다. */}
                      {prevOn.cat1 && (
                        <Pie
                          data={byCatPrev}
                          dataKey="value"
                          nameKey="name"
                          innerRadius="96%"
                          outerRadius="100%"
                          cornerRadius={2}
                          paddingAngle={2}
                          stroke="none"
                          opacity={0.55}
                          isAnimationActive={false}
                          className="chart-pie--ghost"
                        >
                          {byCatPrev.map((c) => (
                            <Cell key={c.name} fill={c.color} />
                          ))}
                        </Pie>
                      )}
                      <Pie
                        data={catRows}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="52%"
                        outerRadius="94%"
                        cornerRadius={6}
                        paddingAngle={2}
                        stroke="none"
                        isAnimationActive={false}
                        className="chart-pie--pickable"
                        shape={ShapeCat}
                        /* 도넛만은 누르는 순간이 아니라 클릭에 잡는다. 여기서
                           상태를 먼저 바꾸면 그 사이 부채꼴이 다시 그려져,
                           뒤따라야 할 클릭 — 갈래 고르기가 통째로 사라진다.
                           그래서 고르기와 같은 자리에서 함께 한다. */
                        onClick={(slice: { name?: string; color?: string }, i: number) => {
                          pop(`cat1:${i}`);
                          붙이기("cat1", i);
                          /* "기타"는 여러 갈래를 묶은 것이라 더 쪼갤 것이 없다. */
                          if (!slice?.name || slice.name === "기타") return;
                          setPickedCat((prev) =>
                            prev?.name === slice.name
                              ? null
                              : { name: slice.name as string, color: slice.color ?? ETC_COLOR() }
                          );
                        }}
                      >
                        {byCat.map((c) => (
                          <Cell key={c.name} fill={c.color} />
                        ))}
                      </Pie>
                      <Tooltip {...TIP_PROPS} cursor={false} content={<Tip useSliceName prevLabel={prevLabel} curLabel={curLabel} />} active={tipAt?.key === "cat1"}
                      defaultIndex={tipAt?.key === "cat1" ? tipAt.i : undefined} />
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
                  {prevOn.cat1 &&
                    catOnlyPrev.map((c) => (
                      <li key={`prev-${c.name}`} className="chart-legend__row is-prev">
                        <span className="chart-legend__key" style={{ background: c.color }} />
                        <span className="chart-legend__name">{c.name}</span>
                        <span className="chart-legend__prev">지난달</span>
                        <span className="chart-legend__pct">
                          {catPrevTotal ? Math.round((c.value / catPrevTotal) * 100) : 0}%
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
                <PrevBtn
                  on={!!prevOn.pay}
                  onToggle={() => togglePrev("pay")}
                  onHold={() => setCmpKey("pay")}
                />
              </header>
              <div
                className="chart-card__body chart-card__body--rows"
                style={{ "--rows": payRows.length } as React.CSSProperties}
                onPointerDownCapture={() => 붙이기("pay")}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={payRows}
                    layout="vertical"
                    margin={{ top: 0, right: wide ? 64 : 10, bottom: 0, left: 0 }}
                  >
                    <XAxis type="number" hide />
                    {/* 가로 막대는 줄 축이 칸을 나눈다. 날짜별과 같은 까닭으로
                        숨긴 줄 축을 하나 더 두어 지난달을 같은 자리에 겹친다. */}
                    {prevOn.pay && <YAxis yAxisId="prev" type="category" dataKey="name" hide />}
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
                    <Tooltip {...TIP_PROPS} content={<Tip prevLabel={prevLabel} curLabel={curLabel} />} active={tipAt?.key === "pay"}
                      defaultIndex={tipAt?.key === "pay" ? tipAt.i : undefined} />
                    <Bar
                      dataKey="value"
                      name="지출"
                      radius={[0, 8, 8, 0]}
                      maxBarSize={22}
                      shape={ShapePay}
                      onPointerDown={(_d: unknown, i: number) => {
                        pop(`pay:${i}`);
                        붙이기("pay", i);
                      }}
                    >
                      {payRows.map((p) => (
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
                    {prevOn.pay && (
                      <Bar
                        yAxisId="prev"
                        dataKey="전월"
                        name="전월"
                        radius={[0, 8, 8, 0]}
                        maxBarSize={22}
                        fillOpacity={0.3}
                        shape={GhostRight}
                        isAnimationActive={false}
                        style={{ pointerEvents: "none" }}
                      >
                        {payRows.map((p) => (
                          <Cell key={p.name} fill={p.color} />
                        ))}
                      </Bar>
                    )}
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
                <PrevBtn
                  on={!!prevOn.weekday}
                  onToggle={() => togglePrev("weekday")}
                  onHold={() => setCmpKey("weekday")}
                />
              </header>
              <div className="chart-card__body chart-card__body--short" onPointerDownCapture={() => 붙이기("weekday")}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dowRows} margin={{ top: wide ? 18 : 8, right: 6, bottom: 0, left: -6 }}>
                    <XAxis dataKey="요일" tick={AXIS} tickLine={false} axisLine={false} />
                    {prevOn.weekday && <XAxis xAxisId="prev" dataKey="요일" hide />}
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} tickFormatter={shortWon} />
                    <Tooltip {...TIP_PROPS} content={<Tip suffix="요일" prevLabel={prevLabel} curLabel={curLabel} />} active={tipAt?.key === "weekday"}
                      defaultIndex={tipAt?.key === "weekday" ? tipAt.i : undefined} />
                    <Bar
                      dataKey="지출"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={44}
                      shape={ShapeDow}
                      onPointerDown={(_d: unknown, i: number) => {
                        pop(`weekday:${i}`);
                        붙이기("weekday", i);
                      }}
                    >
                      {dowRows.map((d) => (
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
                    {prevOn.weekday && (
                      <Bar
                        xAxisId="prev"
                        dataKey="전월"
                        name="전월"
                        radius={[8, 8, 0, 0]}
                        maxBarSize={44}
                        fillOpacity={0.3}
                        shape={GhostUp}
                        isAnimationActive={false}
                        style={{ pointerEvents: "none" }}
                      >
                        {dowRows.map((d) => (
                          <Cell key={d.요일} fill={d.color} />
                        ))}
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
        </>
      ),
    },
  ];

  /* 끌기는 편집 모드에서만 산다. 설정 화면들이 쓰는 것과 같은 감지기다. */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } })
  );

  /* 담아 둔 차례와 감춤을 받아 온다. 표에 없는 카드는 코드가 적어 둔
     차례 그대로 맨 뒤에 선다 — 그림을 새로 만들어도 저절로 따라온다. */
  useEffect(() => {
    axios
      .get("/charts/cards")
      .then((r) => {
        const rows = r.data as { card_key: string; is_active: number; span: number }[];
        const saved = rows.map((x) => x.card_key).filter((k) => CARD_KEYS.includes(k));
        setCardOrder([...saved, ...CARD_KEYS.filter((k) => !saved.includes(k))]);
        setHidden(new Set(rows.filter((x) => !x.is_active).map((x) => x.card_key)));
        /* 담아 둔 것이 있으면 그것을, 없으면 코드가 적어 둔 넓이를 쓴다. */
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
     여섯 장뿐이라 따로 기억해 둘 것 없이 그때그때 고른다. */
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

  /* 다른 설정 화면과 같은 흐름 — [편집]으로 열고 [저장]으로 담는다. */
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
      alert("저장 완료-!! ;-)");
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
    /* 그림 안의 그리개들이 눌린 항목을 여기서 읽는다. */
    <PopContext.Provider value={popApi}>
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
            {/* 달력과 같은 자리 — 필터 왼쪽. 달력은 날을 골라야 나타나지만
                여기서는 늘 누를 수 있어 알약에 불을 켜 두지 않는다. 이 툴바에서
                켜진 불은 "걸린 것이 있다"는 뜻이고, 그 뜻을 흐리면 안 된다. */}
            <button
              type="button"
              className="filter-pill"
              onClick={openDetail}
              title="이 달의 내역을 지금 걸린 조건 그대로 본다."
            >
              상세
            </button>
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

        <FixedFilter value={fixPick} onChange={setFixPick} withIncome={false} />
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
              <CardPerfItem
                key={c.code}
                card={c}
                tiers={tiers[c.code] ?? []}
                onOpen={openCardDetail}
                onPerks={setPerkOf}
              />
            ))}
          </div>
          )}
        </section>
      )}

      {/* 한 달 요약 — 이 화면은 나간 돈만 센다. */}
      <div className="chart-tiles">
        <div className="chart-tile">
          <span className="chart-tile__label">지출</span>
          <span className="chart-tile__value">
            {Math.round(sum.out).toLocaleString("ko-KR")}
          </span>
          <span className="chart-tile__sub">{sum.count}건</span>
        </div>
        <div className="chart-tile">
          <span className="chart-tile__label">일 평균</span>
          <span className="chart-tile__value">
            {Math.round(sum.out / daysInMonth).toLocaleString("ko-KR")}
          </span>
          <span className="chart-tile__sub">/{daysInMonth}</span>
        </div>
        <div className="chart-tile">
          <span className="chart-tile__label">일 최고</span>
          <span className="chart-tile__value">
            {Math.round(peak.지출).toLocaleString("ko-KR")}
          </span>
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

      {/* 실적 구간별 혜택 — 띠 옆 [혜택]을 누르면 그 카드 것만 펼친다. */}
      {perkOf !== null && (
        <CardPerkPopup
          cardName={byCard.find((c) => c.code === perkOf)?.name ?? ""}
          tiers={tiers[perkOf] ?? []}
          charged={byCard.find((c) => c.code === perkOf)?.charged ?? 0}
          onClose={() => setPerkOf(null)}
        />
      )}

      {prevCmp && (
        <PrevCmpPopup
          cmp={prevCmp}
          prevLabel={prevLabel}
          curLabel={curLabel}
          onClose={() => setCmpKey(null)}
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
    </PopContext.Provider>
  );
}

/** 견줌 보기 팝업의 금액 한 칸 */
function CmpAmt({
  v,
  sign = false,
  short = false,
}: {
  v: number;
  /** 차이 칸 — 부호를 앞에 붙인다 */
  sign?: boolean;
  /** 표 안에서는 짧게 적는다(34만) */
  short?: boolean;
}) {
  const 숫자 = short ? shortWon(v) : won(v);
  return (
    <span className="prev-cmp__val">
      {sign ? `${v > 0 ? "+" : v < 0 ? "-" : ""}${숫자}` : 숫자}
    </span>
  );
}

/**
 * 전월 대비 단추를 꾹 누르면 뜨는 팝업이다. 그림이 보이는 만큼을 숫자로 다시 적는다.
 *
 * 껍데기는 필터 팝업과 같은 틀(popup-overlay, popup-panel--framed)을 쓴다.
 */
function PrevCmpPopup({
  cmp,
  prevLabel,
  curLabel,
  onClose,
}: {
  cmp: PrevCmp;
  prevLabel: string;
  curLabel: string;
  onClose: () => void;
}) {
  useBackClose(true, onClose);

  useEffect(() => {
    document.documentElement.classList.add("modal-open");
    return () => document.documentElement.classList.remove("modal-open");
  }, []);

  const 차이 = cmp.총이달 - cmp.총지난달;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel popup-panel--framed popup-panel--scroll"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${cmp.title} 전월 대비`}
      >
        <header className="popup-head">
          <h3 className="popup-head__title">{cmp.title}</h3>
          <span className="prev-cmp__tag">{prevLabel}</span>
        </header>

        <div className="popup-body prev-cmp">
          <div className="prev-cmp__sum">
            <div className="prev-cmp__cell">
              <span className="prev-cmp__lab">{curLabel}</span>
              <CmpAmt v={cmp.총이달} />
            </div>
            <div className="prev-cmp__cell">
              <span className="prev-cmp__lab">{prevLabel}</span>
              <CmpAmt v={cmp.총지난달} />
            </div>
            <div
              className={`prev-cmp__cell prev-cmp__cell--diff${
                차이 > 0 ? " up" : 차이 < 0 ? " down" : ""
              }`}
            >
              <span className="prev-cmp__lab">차이</span>
              <CmpAmt v={차이} sign />
            </div>
          </div>

          <table className="prev-cmp__tbl">
            <thead>
              <tr>
                <th scope="col">{cmp.칸}</th>
                <th scope="col">당월</th>
                <th scope="col">전월</th>
                <th scope="col">차이</th>
              </tr>
            </thead>
            <tbody>
              {cmp.rows.map((r) => {
                const d = r.cur - r.prev;
                return (
                  <tr key={r.name}>
                    <th scope="row">{r.name}</th>
                    <td>
                      <CmpAmt v={r.cur} short />
                    </td>
                    <td>
                      <CmpAmt v={r.prev} short />
                    </td>
                    <td className={d > 0 ? "up" : d < 0 ? "down" : ""}>
                      <CmpAmt v={d} sign short />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

        </div>
      </div>
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
