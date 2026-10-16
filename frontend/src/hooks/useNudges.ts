import { useEffect, useMemo, useState } from "react";
import axios from "../api/client";
import {
  ALL_FIXED_PICK,
  type FixedPick,
  fixedSetsFrom,
  fxTag,
  passFixed,
} from "../utils/calendarFilter";
import type { Src } from "../utils/calendarFilter";
import { 말짓기, type Nudge, type NRow, type 센것 } from "../utils/nudges";
import type { Goal } from "../utils/goalStand";

/**
 * 안쓴이 도전이 볼 자료를 한 벌만 받아 이 모듈에 얹는다.
 *
 * 세 달치를 받는 일이라 화면을 옮길 때마다 다시 받아 오면 안 된다. 받아 온
 * 것을 이 모듈에 얹고 화면을 옮겨도 그대로 쓴다 — 계산기가 계산 기록을
 * 들고 있는 방식과 같다. 새로 고침을 누르면 페이지가 다시 뜨면서 함께
 * 비워진다.
 *
 * 걸러 내기(Blur · Exclude)는 받아 온 뒤에 한다. 그래야 고정 · 변동 단추를
 * 눌러 켜고 끌 때 다시 받아 오지 않는다.
 *
 * 잔소리는 이 줄을 보지 않는다. 서버가 센 것을 아래 useNudges()가 받아 올
 * 뿐이다(backend/app/nudgecalc.py).
 */

/** 앞뒤로 몇 달치를 보고 셈할지 — 평균을 내려면 한 달로는 모자란다. */
const MONTHS = 3;

type Raw = Record<string, unknown>;
type Cat = { id: number; name: string; blur?: number };

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** 받아 온 그대로 — 아직 아무것도 걸러 내지 않았다. */
type Loaded = {
  today: string;
  rows: NRow[];
  cat1List: Cat[];
  cat2List: (Cat & { cat1_id: number; inout?: number | null })[];
  cat3List: (Cat & { cat2_id: number })[];
  /** 건 분류별 목표 — 안쓴이 도전 */
  goals: Goal[];
  /** 받은 달들. 이 바깥 달은 그때 따로 받는다(안쓴이 도전의 달 넘기기). */
  months: string[];
  /** 대기 · 정기의 날것. 다른 달을 셀 때 같은 방식으로 다시 세우려고 남긴다. */
  rawPending: Raw[];
  rawSched: Raw[];
};

/**
 * 한 달치 줄을 세운다.
 *
 * 세 갈래(지출 · 대기 · 정기)를 그 달 날짜로만 추려 한 꼴로 맞춘다.
 * 처음 받는 석 달도, 안쓴이 도전이 달을 거슬러 가며 따로 받는 달도
 * 이 한 곳을 지난다 — 두 길로 세우면 같은 달인데 숫자가 달라진다.
 */
function 달줄(ym: string, expense: Raw[], pending: Raw[], sched: Raw[]): NRow[] {
  const out: NRow[] = [];
  const push = (src: Src, list: Raw[], dateField: string, idField: string) => {
    list.forEach((x) => {
      const date = String(x[dateField] ?? "").slice(0, 10);
      if (!date || !date.startsWith(ym)) return;
      out.push({
        key: `${src}-${x[idField]}`,
        src,
        date,
        day: Number(date.slice(8, 10)),
        inout: (x.inout as number) ?? null,
        net: Number(x.net_amount ?? x.amount ?? 0),
        amount: Number(x.amount ?? 0),
        cat1_id: x.cat1_id as number,
        cat2_id: x.cat2_id as number,
        cat3_id: x.cat3_id as number,
        pay_method: x.pay_method as number,
        memo: x.memo as string,
        place_name: x.place_name as string,
        /* 카드 실적에서 뺀 건인지 — 잔소리의 카드 실적만 본다. */
        perf_exclude: (x.perf_exclude as number) ?? 0,
        /* 손으로 정한 고정 · 변동. 비면 분류에 정한 것을 따른다. */
        fixed_flag: (x.fixed_flag as number | null) ?? null,
        counterpart_ids: (x.counterpart_ids as number[]) ?? [],
      });
    });
  };
  push("expense", expense, "tx_date", "entry_id");
  push("pending", pending, "tx_date", "entry_id");
  push("scheduled", sched, "next_run_at", "schedule_id");
  return out;
}

let cached: Loaded | null = null;
let inflight: Promise<Loaded | null> | null = null;

async function load(): Promise<Loaded> {
  const today = ymd(new Date());
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const months = Array.from({ length: MONTHS }, (_, i) => {
    const d = new Date(y, m - 1 - (MONTHS - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const res = await Promise.all([
    ...months.map((ym) =>
      axios.get("/entries/month", { params: { ym } }).then((r) => r.data).catch(() => [])
    ),
    axios.get("/pending-entries").then((r) => r.data).catch(() => []),
    axios.get("/scheduled-entries").then((r) => r.data).catch(() => []),
    axios.get("/categories/lvl1").then((r) => r.data).catch(() => []),
    axios.get("/categories/lvl2").then((r) => r.data).catch(() => []),
    axios.get("/categories/lvl3").then((r) => r.data).catch(() => []),
    axios.get("/goals").then((r) => r.data).catch(() => []),
  ]);

  /* 씀씀이 · 달력과 같은 세 갈래를 모은다.
     지출만 세면 아직 안 보낸 대기가 통째로 빠져 그 달만 유난히 적어 보인다.
     실제로 2026-08은 대기가 15건(600,710원), 2026-07은 2건(166,050원)이라
     지출만으로 견주면 이번 달이 61% 적게, 셋을 다 세면 33% 적게 나왔다. */
  const rows: NRow[] = [];
  months.forEach((ym, i) => {
    rows.push(...달줄(ym, res[i] as Raw[], res[MONTHS] as Raw[], res[MONTHS + 1] as Raw[]));
  });

  return {
    today,
    rows,
    cat1List: res[MONTHS + 2] as Cat[],
    cat2List: res[MONTHS + 3] as (Cat & { cat1_id: number; inout?: number | null })[],
    cat3List: res[MONTHS + 4] as (Cat & { cat2_id: number })[],
    goals: res[MONTHS + 5] as Goal[],
    months,
    rawPending: res[MONTHS] as Raw[],
    rawSched: res[MONTHS + 1] as Raw[],
  };
}

/**
 * 받은 석 달 바깥의 한 달을 따로 받는다 — 안쓴이 도전의 달 넘기기.
 *
 * 대기 · 정기는 달에 매이지 않는 목록이라 이미 받은 것을 그대로 쓴다.
 * 지출만 그 달치를 새로 물어 온다.
 */
export async function 다른달줄(ym: string): Promise<NRow[]> {
  const d = await ensure();
  if (!d) return [];
  const expense = await axios
    .get("/entries/month", { params: { ym } })
    .then((r) => r.data as Raw[])
    .catch(() => [] as Raw[]);
  return 달줄(ym, expense, d.rawPending, d.rawSched);
}

function ensure(): Promise<Loaded | null> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = load()
      .then((d) => {
        cached = d;
        inflight = null;
        return d;
      })
      .catch(() => {
        inflight = null;
        return null;
      });
  }
  return inflight;
}

/**
 * 서버가 센 것을 꼬리표마다 이 모듈에 얹는다.
 *
 * 종 단추는 어느 화면에나 서 있어 화면을 옮길 때마다 다시 마운트된다. 그때
 * 빈 값에서 시작하면 배지의 숫자가 한 번 사라졌다 돌아온다 — 탭을 옮길
 * 때마다 깜빡였다. 모래시계 단추(usePending)가 쓰는 방식 그대로 받아 온 것을
 * 들고 있다가 그대로 내준다.
 *
 * 꼬리표가 열쇠인 까닭은 고정 · 변동 고르개가 셈을 바꾸기 때문이다. 잔소리
 * 화면에서 단추를 눌러 조합을 바꿔도, 한 번 본 조합은 다시 묻지 않는다.
 */
const 센곳간 = new Map<string, 센것[]>();
const 오는중 = new Map<string, Promise<센것[]>>();

function 센것받기(꼬리표: string): Promise<센것[]> {
  const 든것 = 센곳간.get(꼬리표);
  if (든것) return Promise.resolve(든것);
  let 오는것 = 오는중.get(꼬리표);
  if (!오는것) {
    오는것 = axios
      .get("/nudges", { params: { today: ymd(new Date()), fx: 꼬리표 } })
      .then((r) => {
        const 센것들 = (r.data?.nudges as 센것[]) ?? [];
        센곳간.set(꼬리표, 센것들);
        오는중.delete(꼬리표);
        return 센것들;
      })
      .catch(() => {
        /* 못 받아 오면 아무 말도 하지 않는다 — 틀린 잔소리보다 낫다.
           곳간에는 얹지 않는다. 다음에 볼 때 다시 묻는다. */
        오는중.delete(꼬리표);
        return [] as 센것[];
      });
    오는중.set(꼬리표, 오는것);
  }
  return 오는것;
}

/**
 * 한 건 적고 나면 셈이 달라진다 — 다시 받도록 비운다.
 *
 * 도전판이 보는 줄(cached)을 비우는 것만으로는 모자란다. 잔소리는 서버가
 * 세므로, 떠 있는 종 단추와 잔소리 화면에게 "다시 물어라"고 알려야 한다.
 * 판 번호를 올리고 듣는 쪽을 깨운다.
 */
let 판 = 0;
const 듣는이 = new Set<() => void>();

export function invalidateNudges() {
  cached = null;
  inflight = null;
  센곳간.clear();
  오는중.clear();
  판 += 1;
  듣는이.forEach((f) => f());
}

/**
 * 받아 온 것을 걸러 내 셈에 쓸 꼴로 만든다.
 *
 * 거르는 잣대는 씀씀이가 쓰는 것과 같다. 화면마다 따로 거르면 같은 달인데
 * 숫자가 다른 일이 반드시 생긴다.
 */
function refine(data: Loaded, fixPick: FixedPick, 다른줄?: NRow[]) {
  const { cat1List, cat2List, cat3List } = data;
  const fixSets = fixedSetsFrom(cat2List, cat3List);

  const keep = (r: { inout?: number | null; cat2_id?: number | null; cat3_id?: number | null }) =>
    passFixed(r, fixPick, fixSets);

  /* 수입은 두 가지로 가른다 — 줄에 붙은 표시와, 그 소분류가 수입인지.
     씀씀이가 쓰는 잣대 그대로다. */
  const income = new Set(cat2List.filter((c) => c.inout === 1).map((c) => c.id));
  const rows = (다른줄 ?? data.rows).filter(
    (r) => r.inout !== 1 && !income.has(Number(r.cat2_id)) && keep(r)
  );
  return {
    rows,
    /* 집계에 적히는 금액에는 테이프를 붙이지 않는다. 덮는 것은 개별 내역
       카드뿐이라 여기서는 늘 빈 자리로 둔다. */
    masked: new Set<string>(),
    name1: new Map(cat1List.map((c) => [c.id, c.name])),
    name2: new Map(cat2List.map((c) => [c.id, c.name])),
    name3: new Map(cat3List.map((c) => [c.id, c.name])),
  };
}

export type NudgeOptions = {
  /** 가린 갈래를 셈에 넣을지. 넣되 화면에서는 테이프로 덮는다. */
  fixPick?: FixedPick;
  /** 집계에서 뺀 갈래를 뺄지 */
  /** 값을 바꾸면 다시 받는다(비운 뒤에 쓴다) */
  reloadKey?: number;
};

/**
 * 잔소리를 받아 온다.
 *
 * 세는 일은 서버가 한다(GET /api/nudges). 전에는 이 자리에서 열 군데를 부른
 * 뒤 화면에서 셈했는데, 종 단추가 모든 화면에 서 있어서 화면을 옮길 때마다
 * 그 열 번이 돌았다. 지금은 요청 하나다.
 *
 * 오늘 날짜는 이쪽이 보낸다. 서버 시각대를 믿으면 폰이 자정을 넘길 때 하루
 * 어긋난다.
 *
 * 고정 · 변동 고르개는 질의 변수로 넘긴다. 받아 온 뒤에 거르던 때와 달리
 * 조합마다 한 번은 물어야 하지만, 한 번 본 조합은 위 센곳간에 얹혀 다시
 * 묻지 않는다.
 */
export default function useNudges(options: NudgeOptions = {}): { nudges: Nudge[]; ready: boolean } {
  const { fixPick = ALL_FIXED_PICK, reloadKey = 0 } = options;
  const 꼬리표 = fxTag(fixPick);
  const [센것들, set센것들] = useState<센것[] | null>(() => 센곳간.get(꼬리표) ?? null);
  const [판수, set판수] = useState(판);

  /* 어디선가 한 건 적으면 판 번호가 오른다. 그때 다시 묻는다. */
  useEffect(() => {
    const 깨우기 = () => set판수(판);
    듣는이.add(깨우기);
    return () => {
      듣는이.delete(깨우기);
    };
  }, []);

  useEffect(() => {
    /* 이미 들고 있으면 그 자리에서 쓴다 — 기다리는 틈이 없어야 깜빡이지
       않는다. 비운 뒤라면 곳간이 비어 있어 저절로 다시 묻는다. */
    const 든것 = 센곳간.get(꼬리표);
    if (든것) {
      set센것들(든것);
      return;
    }
    let alive = true;
    센것받기(꼬리표).then((v) => {
      if (alive) set센것들(v);
    });
    return () => {
      alive = false;
    };
  }, [꼬리표, reloadKey, 판수]);

  const nudges = useMemo(() => 말짓기(센것들 ?? []), [센것들]);

  return { nudges, ready: 센것들 !== null };
}

/**
 * 안쓴이 도전이 볼 것.
 *
 * 받아 오는 것도 거르는 것도 이 모듈 한 곳이라, 화면을 옮겨도 다시 받지
 * 않는다. 잔소리와 숫자가 어긋나지 않는 까닭은 서버가 같은 잣대로 세기
 * 때문이다(backend/app/nudgecalc.py).
 */
export function useGoalBoard(options: NudgeOptions & { ym?: string } = {}): {
  goals: Goal[];
  rows: NRow[];
  /** 가린 갈래에서 온 줄 — 상세에서 금액에만 테이프를 붙인다. */
  masked: Set<string>;
  today: string;
  catPath: (r: { cat1_id?: number | null; cat2_id?: number | null; cat3_id?: number | null }) => string;
  ready: boolean;
} {
  const { fixPick = ALL_FIXED_PICK, reloadKey = 0, ym } = options;
  const [data, setData] = useState<Loaded | null>(cached);
  /* 받은 석 달 바깥을 볼 때만 그 달을 따로 받는다. */
  const [딴달, set딴달] = useState<{ ym: string; rows: NRow[] } | null>(null);

  useEffect(() => {
    let alive = true;
    ensure().then((d) => {
      if (alive && d) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!data || !ym || data.months.includes(ym)) {
      set딴달(null);
      return;
    }
    let alive = true;
    다른달줄(ym).then((rows) => {
      if (alive) set딴달({ ym, rows });
    });
    return () => {
      alive = false;
    };
  }, [data, ym, reloadKey]);

  return useMemo(() => {
    if (!data) {
      return {
        goals: [],
        rows: [],
        masked: new Set<string>(),
        today: "",
        catPath: () => "",
        ready: false,
      };
    }
    /* 받은 석 달 안이면 그대로 쓰고, 바깥이면 따로 받은 줄을 쓴다.
       아직 못 받았으면 빈 줄로 둔다 — 다른 달 숫자를 잠깐 보여 주느니 낫다. */
    const 딴 = ym && !data.months.includes(ym)
      ? (딴달 && 딴달.ym === ym ? 딴달.rows : [])
      : undefined;
    const { rows, masked, name1, name2, name3 } = refine(data, fixPick, 딴);
    return {
      goals: data.goals,
      rows,
      masked,
      today: data.today,
      catPath: (r) =>
        [name1.get(Number(r.cat1_id)), name2.get(Number(r.cat2_id)), name3.get(Number(r.cat3_id))]
          .filter(Boolean)
          .join(" > "),
      ready: true,
    };
  }, [data, fixPick, ym, 딴달]);
}
