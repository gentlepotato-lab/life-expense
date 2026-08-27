import { useEffect, useMemo, useState } from "react";
import axios from "../api/client";
import {
  blurSetsFrom,
  excludeSetsFrom,
  isBlurred,
  isExcluded,
  type ExcludeSets,
} from "../utils/calendarFilter";
import type { Src } from "../utils/calendarFilter";
import { buildNudges, type Nudge, type NRow } from "../utils/nudges";

/**
 * 잔소리에 쓸 자료를 한 벌만 받아 나눠 쓴다.
 *
 * 종 단추는 어느 화면에나 떠 있으므로, 화면을 옮길 때마다 세 달치를 다시
 * 받아 오면 안 된다. 받아 온 것을 이 모듈에 얹어 두고 화면을 옮겨도 그대로
 * 쓴다 — 계산기가 계산 기록을 들고 있는 방식과 같다. 새로 고침을 누르면
 * 페이지가 다시 뜨면서 함께 비워진다.
 *
 * 걸러 내기(Blur · Exclude)는 받아 온 뒤에 한다. 그래야 잔소리 화면에서
 * 단추를 눌러 켜고 끌 때 다시 받아 오지 않는다.
 */

/** 앞뒤로 몇 달치를 보고 셈할지 — 평균을 내려면 한 달로는 모자란다 */
const MONTHS = 3;

/** 정기 지출은 일주일 앞까지만 미리 알린다 */
const AHEAD_DAYS = 7;

type Raw = Record<string, unknown>;
type Cat = { id: number; name: string; blur?: number; exclude?: number };

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** 받아 온 그대로 — 아직 아무것도 걸러 내지 않았다 */
type Loaded = {
  today: string;
  rows: NRow[];
  pending: { key: string; date: string; name: string; amount: number; memo?: string; cat1_id?: number; cat2_id?: number; cat3_id?: number }[];
  upcoming: { key: string; name: string; amount: number; date: string; inout?: number | null; memo?: string; cat1_id?: number; cat2_id?: number; cat3_id?: number }[];
  cat1List: Cat[];
  cat2List: (Cat & { cat1_id: number; inout?: number | null })[];
  cat3List: (Cat & { cat2_id: number })[];
  /** 실적 구간을 적어 둔 카드 */
  cards: {
    key: string;
    name: string;
    code: string;
    tiers: {
      threshold: number;
      benefits: { content: string; memo: string; limit: number | null }[];
    }[];
  }[];
};

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
    axios.get("/payment-methods").then((r) => r.data).catch(() => []),
  ]);

  /* 실적 구간은 카드에만 딸린다. 카드가 몇 장뿐이라 그것만 따로 물어 온다 */
  type RawMethod = { method_id: number; method_name: string; category: string | null };
  type RawTier = {
    threshold: number;
    benefits?: { content: string; memo: string | null; limit: number | null }[];
  };

  const cardList = (res[MONTHS + 5] as RawMethod[]).filter((p) => p.category === "카드");
  const cards = await Promise.all(
    cardList.map(async (p) => ({
      key: `card-${p.method_id}`,
      name: p.method_name,
      code: String(p.method_id),
      tiers: await axios
        .get(`/payment-methods/${p.method_id}/tiers`)
        .then((r) =>
          (r.data as RawTier[]).map((t) => ({
            threshold: Number(t.threshold),
            benefits: (t.benefits ?? []).map((b) => ({
              content: b.content ?? "",
              memo: b.memo ?? "",
              limit: b.limit ?? null,
            })),
          }))
        )
        .catch(() => []),
    }))
  );

  /* 씀씀이 · 달력과 같은 세 갈래를 모은다.
     지출만 세면 아직 안 보낸 대기가 통째로 빠져 그 달만 유난히 적어 보인다.
     실제로 2026-08 은 대기가 15건(600,710원), 2026-07 은 2건(166,050원)이라
     지출만으로 견주면 이번 달이 61% 적게, 셋을 다 세면 33% 적게 나왔다. */
  const rows: NRow[] = [];
  const push = (src: Src, list: Raw[], dateField: string, idField: string, ym?: string) => {
    list.forEach((x) => {
      const date = String(x[dateField] ?? "").slice(0, 10);
      if (!date || (ym && !date.startsWith(ym))) return;
      rows.push({
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
        counterpart_ids: (x.counterpart_ids as number[]) ?? [],
      });
    });
  };

  months.forEach((ym, i) => {
    push("expense", res[i] as Raw[], "tx_date", "entry_id", ym);
    push("pending", res[MONTHS] as Raw[], "tx_date", "entry_id", ym);
    push("scheduled", res[MONTHS + 1] as Raw[], "next_run_at", "schedule_id", ym);
  });

  /* 아직 보내지 않은 것만 밀린 것으로 센다 — 보낸 뒤에도 행은 남는다 */
  const pending = (res[MONTHS] as Raw[])
    .filter((x) => Number(x.sended ?? 0) === 0)
    .map((x) => ({
      key: `pending-${x.entry_id}`,
      date: String(x.tx_date ?? "").slice(0, 10),
      name:
        String(x.place_name ?? "").trim() || String(x.memo ?? "").trim() || "대기 내역",
      memo:
        String(x.place_name ?? "").trim() || String(x.memo ?? "").trim() || undefined,
      amount: Number(x.net_amount ?? x.amount ?? 0),
      cat1_id: x.cat1_id as number,
      cat2_id: x.cat2_id as number,
      cat3_id: x.cat3_id as number,
    }))
    .filter((p) => p.date);

  const limit = new Date();
  limit.setDate(limit.getDate() + AHEAD_DAYS);
  const upcoming = (res[MONTHS + 1] as Raw[])
    .map((x) => ({
      key: `sched-${x.schedule_id}`,
      name: String(x.place_name ?? "").trim() || String(x.memo ?? "").trim() || "정기 지출",
      amount: Number(x.amount ?? 0),
      date: String(x.next_run_at ?? "").slice(0, 10),
      inout: (x.inout as number) ?? null,
      memo:
        String(x.place_name ?? "").trim() || String(x.memo ?? "").trim() || undefined,
      cat1_id: x.cat1_id as number,
      cat2_id: x.cat2_id as number,
      cat3_id: x.cat3_id as number,
    }))
    .filter((s) => s.date >= today && s.date <= ymd(limit));

  return {
    today,
    rows,
    pending,
    upcoming,
    cat1List: res[MONTHS + 2] as Cat[],
    cat2List: res[MONTHS + 3] as (Cat & { cat1_id: number; inout?: number | null })[],
    cat3List: res[MONTHS + 4] as (Cat & { cat2_id: number })[],
    cards,
  };
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

/** 한 건 적고 나면 셈이 달라진다 — 다음에 볼 때 다시 받도록 비운다 */
export function invalidateNudges() {
  cached = null;
  inflight = null;
}

export type NudgeOptions = {
  /** 가려 둔 갈래를 셈에 넣을지. 넣되 화면에서는 테이프로 덮는다 */
  blurOn?: boolean;
  /** 집계에서 빼 둔 갈래를 뺄지 */
  excludeOn?: boolean;
  /** 값을 바꾸면 다시 받는다(비운 뒤에 쓴다) */
  reloadKey?: number;
};

export default function useNudges(options: NudgeOptions = {}): { nudges: Nudge[]; ready: boolean } {
  const { blurOn = true, excludeOn = true, reloadKey = 0 } = options;
  const [data, setData] = useState<Loaded | null>(cached);

  useEffect(() => {
    let alive = true;
    ensure().then((d) => {
      if (alive && d) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const nudges = useMemo(() => {
    if (!data) return [];
    const { cat1List, cat2List, cat3List } = data;
    const excSets: ExcludeSets = excludeSetsFrom(cat1List, cat2List, cat3List);
    const blurSets = blurSetsFrom(cat1List, cat2List, cat3List);

    const keep = (r: { cat1_id?: number | null; cat2_id?: number | null; cat3_id?: number | null }) =>
      !(excludeOn && isExcluded(r as NRow, excSets)) && (blurOn || !isBlurred(r as NRow, blurSets));

    /* 수입은 두 가지로 가른다 — 줄에 붙은 표시와, 그 소분류가 수입인지.
       씀씀이가 쓰는 잣대 그대로다. */
    const income = new Set(cat2List.filter((c) => c.inout === 1).map((c) => c.id));
    const rows = data.rows.filter(
      (r) => r.inout !== 1 && !income.has(Number(r.cat2_id)) && keep(r)
    );
    const pending = data.pending
      .filter(keep)
      .map((p) => ({ ...p, blur: isBlurred(p as unknown as NRow, blurSets) }));

    const name1 = new Map(cat1List.map((c) => [c.id, c.name]));
    const name2 = new Map(cat2List.map((c) => [c.id, c.name]));
    const name3 = new Map(cat3List.map((c) => [c.id, c.name]));

    return buildNudges({
      today: data.today,
      rows,
      masked: new Set(rows.filter((r) => isBlurred(r, blurSets)).map((r) => r.key)),
      cat2Name: name2,
      catPath: (r) =>
        [name1.get(Number(r.cat1_id)), name2.get(Number(r.cat2_id)), name3.get(Number(r.cat3_id))]
          .filter(Boolean)
          .join(" > "),
      pending,
      cards: data.cards,
      /* 예고도 화면의 단추를 따른다 — Exclude 를 켜 두고 저축이 "빠져나갑니다"
         라고 뜨면 같은 화면이 두 가지 잣대로 말하는 셈이 된다 */
      upcoming: data.upcoming.filter(
        (s) => s.inout !== 1 && !income.has(Number(s.cat2_id)) && keep(s)
      ),
    });
  }, [data, blurOn, excludeOn]);

  return { nudges, ready: data !== null };
}
