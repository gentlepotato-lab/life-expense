import { useEffect, useMemo, useState } from "react";
import axios from "../api/client";
import { blurSetsFrom, isBlurred } from "../utils/calendarFilter";

/**
 * 아직 보내지 않은 대기 내역을 한 벌만 받아 나눠 쓴다.
 *
 * 모래시계 단추는 어느 화면에나 떠 있다. 배지에 적을 수와 팝업이 넘겨 볼
 * 카드가 같은 줄에서 나와야, 배지에는 5라 적혀 있는데 열면 넉 장인 일이
 * 생기지 않는다. 받아 온 것을 이 모듈에 얹어 두고 화면을 옮겨도 그대로 쓴다 —
 * 잔소리(useNudges)가 쓰는 방식 그대로다.
 *
 * 한 건 보내거나 적고 나면 invalidatePending()으로 비운다.
 */

type Raw = Record<string, unknown>;
type Cat = { id: number; name: string; blur?: number };

/** 팝업이 카드 한 장을 그리는 데 필요한 것만 추린 꼴. */
export type PendingCardRow = {
  entry_id: number;
  date: string;
  /** 쪼갠 건은 실지출(net)을 대표 금액으로 삼는다 — 목록 카드와 같은 잣대다. */
  amount: number;
  /** 쪼개기 전 금액. 쪼갠 건에만 있다. */
  gross: number | null;
  inout: number | null;
  cat: string;
  place: string;
  pay: string;
  memo: string;
  /** 마스킹 테이프를 붙일 건인지 */
  blur: boolean;
};

type Loaded = {
  rows: Raw[];
  cat1List: Cat[];
  cat2List: (Cat & { cat1_id: number; inout?: number | null })[];
  cat3List: (Cat & { cat2_id: number })[];
  payList: { code: string; name: string }[];
};

let cached: Loaded | null = null;
let inflight: Promise<Loaded | null> | null = null;

async function load(): Promise<Loaded> {
  const [rows, cat1List, cat2List, cat3List, pay] = await Promise.all([
    axios.get("/pending-entries").then((r) => r.data).catch(() => []),
    axios.get("/categories/lvl1").then((r) => r.data).catch(() => []),
    axios.get("/categories/lvl2").then((r) => r.data).catch(() => []),
    axios.get("/categories/lvl3").then((r) => r.data).catch(() => []),
    axios.get("/payment-methods").then((r) => r.data).catch(() => []),
  ]);

  return {
    rows,
    cat1List,
    cat2List,
    cat3List,
    payList: (pay as Raw[]).map((p) => ({
      code: String(p.method_id),
      name: String(p.method_name ?? ""),
    })),
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

/** 보내거나 고치고 나면 수가 달라진다 — 다음에 볼 때 다시 받도록 비운다. */
export function invalidatePending() {
  cached = null;
  inflight = null;
}

/** 날짜를 목록의 날짜 단과 같은 꼴로 적는다. */
function dateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const 요일 = ["일", "월", "화", "수", "목", "금", "토"][new Date(y, m - 1, d).getDay()];
  return `${y}. ${m}. ${d}. (${요일})`;
}

export default function usePending(reloadKey = 0): {
  rows: PendingCardRow[];
  ready: boolean;
} {
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

  const rows = useMemo(() => {
    if (!data) return [];
    const { cat1List, cat2List, cat3List, payList } = data;
    const blurSets = blurSetsFrom(cat1List, cat2List, cat3List);
    const name1 = new Map(cat1List.map((c) => [c.id, c.name]));
    const name2 = new Map(cat2List.map((c) => [c.id, c.name]));
    const name3 = new Map(cat3List.map((c) => [c.id, c.name]));
    const payName = new Map(payList.map((p) => [p.code, p.name]));

    return data.rows.map((r): PendingCardRow => {
      const amount = Number(r.amount ?? 0);
      const net = Number(r.net_amount ?? amount);
      const 쪼갬 = Number(r.split_count ?? 0) > 0;
      return {
        entry_id: Number(r.entry_id),
        date: dateLabel(String(r.tx_date ?? "").slice(0, 10)),
        amount: 쪼갬 ? net : amount,
        gross: 쪼갬 ? amount : null,
        inout: (r.inout as number) ?? null,
        cat: [
          name1.get(Number(r.cat1_id)),
          name2.get(Number(r.cat2_id)),
          name3.get(Number(r.cat3_id)),
        ]
          .filter(Boolean)
          .join(" > "),
        place: String(r.place_name ?? "").trim(),
        pay: payName.get(String(r.pay_method ?? "")) ?? "",
        memo: String(r.memo ?? "").trim(),
        blur: isBlurred(
          r as { cat1_id?: number; cat2_id?: number; cat3_id?: number },
          blurSets
        ),
      };
    });
  }, [data]);

  return { rows, ready: data !== null };
}
