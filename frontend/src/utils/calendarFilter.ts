/**
 * 달력이 쓰는 걸러 내기 조건과 판정.
 *
 * 달력과 기간 상세가 같은 판정을 써야 한다 — 달력 칸에 보이던 것과
 * 상세에 펼쳐지는 카드가 어긋나면 안 되기 때문이다.
 * 화면 파일에서 컴포넌트 말고 다른 것을 내보내면 Fast Refresh가 깨지므로
 * 두 화면이 함께 쓰는 것은 여기 둔다.
 */

export type Src = "expense" | "pending" | "scheduled";

/** 달력이 한 달치를 고르게 펴서 담는 모양 */
export type Row = {
  key: string;
  src: Src;
  day: number;
  inout: number | null;
  net: number;
  cat1_id?: number | null;
  cat2_id?: number | null;
  cat3_id?: number | null;
  pay_method?: number | string | null;
  memo?: string | null;
  place_name?: string | null;
  amount: number;
  counterpart_ids?: number[] | null;
};

export const EMPTY_FILTER = {
  cat1: [] as number[],
  cat2: [] as number[],
  cat3: [] as number[],
  pay: [] as string[],
  memo: "",
  inout: 0,
  amountMin: "",
  amountMax: "",
  place: "",
  cp: [] as number[],
};

export type Filter = typeof EMPTY_FILTER;

export function hasCondition(f: Filter): boolean {
  return (
    f.cat1.length > 0 ||
    f.cat2.length > 0 ||
    f.cat3.length > 0 ||
    f.pay.length > 0 ||
    f.memo.trim() !== "" ||
    f.inout !== 0 ||
    f.amountMin !== "" ||
    f.amountMax !== "" ||
    f.place.trim() !== "" ||
    f.cp.length > 0
  );
}

/** 걸린 조건을 한 줄에 다 통과하는지 */
export function pass(r: Row, f: Filter): boolean {
  if (f.cat1.length && !f.cat1.includes(Number(r.cat1_id))) return false;
  if (f.cat2.length && !f.cat2.includes(Number(r.cat2_id))) return false;
  if (f.cat3.length && !f.cat3.includes(Number(r.cat3_id))) return false;
  if (f.pay.length && !f.pay.includes(String(r.pay_method))) return false;
  if (f.inout !== 0 && r.inout !== f.inout) return false;
  if (f.amountMin !== "" && r.amount < Number(f.amountMin)) return false;
  if (f.amountMax !== "" && r.amount > Number(f.amountMax)) return false;
  if (f.place.trim() && !(r.place_name ?? "").toLowerCase().includes(f.place.trim().toLowerCase()))
    return false;
  if (f.memo.trim() && !(r.memo ?? "").includes(f.memo.trim())) return false;
  if (f.cp.length && !(r.counterpart_ids ?? []).some((id) => f.cp.includes(id))) return false;
  return true;
}

/**
 * 집계에서 뺄 갈래 모음.
 *
 * 중 · 소 · 세 중 하나라도 Exclude가 걸려 있으면 그 줄은 셈에서 빠진다.
 * 내역 카드에는 그대로 보이고, 달력 · 씀씀이 · 기간 상세에서만 빠진다.
 */
export type ExcludeSets = {
  cat1: Set<number>;
  cat2: Set<number>;
  cat3: Set<number>;
};

export const EMPTY_Exclude: ExcludeSets = {
  cat1: new Set(),
  cat2: new Set(),
  cat3: new Set(),
};

/** 목록 셋에서 Blur가 걸린 것만 추린다 — Exclude와 같은 방식이다. */
export function blurSetsFrom(
  cat1List: { id: number; blur?: number }[],
  cat2List: { id: number; blur?: number }[],
  cat3List: { id: number; blur?: number }[]
): ExcludeSets {
  const pick = (list: { id: number; blur?: number }[]) =>
    new Set(list.filter((c) => c.blur === 1).map((c) => c.id));
  return { cat1: pick(cat1List), cat2: pick(cat2List), cat3: pick(cat3List) };
}

/** 중 · 소 · 세 중 하나라도 Blur가 걸려 있으면 금액을 덮는다. */
export const isBlurred = isExcludedLike;

/** 목록 셋에서 Exclude가 걸린 것만 추린다. */
export function excludeSetsFrom(
  cat1List: { id: number; exclude?: number }[],
  cat2List: { id: number; exclude?: number }[],
  cat3List: { id: number; exclude?: number }[]
): ExcludeSets {
  const pick = (list: { id: number; exclude?: number }[]) =>
    new Set(list.filter((c) => c.exclude === 1).map((c) => c.id));
  return { cat1: pick(cat1List), cat2: pick(cat2List), cat3: pick(cat3List) };
}

function isExcludedLike(
  r: { cat1_id?: number | null; cat2_id?: number | null; cat3_id?: number | null },
  e: ExcludeSets
): boolean {
  return (
    e.cat1.has(Number(r.cat1_id)) ||
    e.cat2.has(Number(r.cat2_id)) ||
    e.cat3.has(Number(r.cat3_id))
  );
}

export const isExcluded = isExcludedLike;
