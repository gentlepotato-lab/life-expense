/**
 * 달력이 쓰는 걸러 내기 조건과 판정.
 *
 * 달력과 기간 상세가 같은 판정을 써야 한다 — 달력 칸에 보이던 것과
 * 상세에 펼쳐지는 카드가 어긋나면 안 되기 때문이다.
 * 화면 파일에서 컴포넌트 말고 다른 것을 내보내면 Fast Refresh가 깨지므로
 * 두 화면이 함께 쓰는 것은 여기 둔다.
 */
import { prefOn } from "./prefs";

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
  /** 1이면 카드 실적에서 뺀다. 씀씀이의 카드 실적만 본다. */
  perf_exclude?: number | null;
  /** 건마다 손으로 정한 고정 · 변동. 비면 분류를 따른다. */
  fixed_flag?: number | null;
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
 * Blur를 걸어 둔 갈래 모음.
 *
 * 중 · 소 · 세 가운데 하나라도 걸려 있으면 그 줄의 금액에 테이프를 붙인다.
 * 붙는 곳은 개별 내역 카드뿐이다 — 집계는 모은 숫자라 덮지 않는다.
 */
export type BlurSets = {
  cat1: Set<number>;
  cat2: Set<number>;
  cat3: Set<number>;
};

/**
 * 목록 셋에서 Blur가 걸린 것만 추린다.
 *
 * 돈쓴이에서 테이프를 붙이지 않기로 해 두었으면 걸린 갈래가 없는 셈으로 돌려
 * 준다 — 그러면 카드마다 따로 살피지 않아도 화면 곳곳의 테이프가 함께 걷힌다.
 */
export function blurSetsFrom(
  cat1List: { id: number; blur?: number }[],
  cat2List: { id: number; blur?: number }[],
  cat3List: { id: number; blur?: number }[]
): BlurSets {
  const pick = (list: { id: number; blur?: number }[]) =>
    prefOn("blur_default")
      ? new Set(list.filter((c) => c.blur === 1).map((c) => c.id))
      : new Set<number>();
  return { cat1: pick(cat1List), cat2: pick(cat2List), cat3: pick(cat3List) };
}

/** 중 · 소 · 세 가운데 하나라도 Blur가 걸려 있으면 금액을 덮는다. */
export function isBlurred(
  r: { cat1_id?: number | null; cat2_id?: number | null; cat3_id?: number | null },
  b: BlurSets
): boolean {
  return (
    b.cat1.has(Number(r.cat1_id)) ||
    b.cat2.has(Number(r.cat2_id)) ||
    b.cat3.has(Number(r.cat3_id))
  );
}

/**
 * 고정 · 변동.
 *
 * 건에 손으로 정해 둔 것이 가장 앞이고, 없으면 분류를 따른다. 소 · 세 어느
 * 쪽에 걸려 있어도 고정이다(Blur와 같은 셈법). 어디에도 정해진 것이 없으면
 * 변동이다 — 달마다 같은 자리에 오는 돈은 드물고, 드문 쪽을 손으로 켜는 편이
 * 적게 든다.
 *
 * 중분류에는 두지 않았다. 한 중분류 안에서도 소분류마다 갈리기 때문이다
 * (현재/미래 > 저축은 고정, 투자는 변동).
 */
export type FixedSets = { cat2: Set<number>; cat3: Set<number> };

export const EMPTY_FIXED: FixedSets = { cat2: new Set(), cat3: new Set() };

export function fixedSetsFrom(
  cat2List: { id: number; fixed?: number }[],
  cat3List: { id: number; fixed?: number }[]
): FixedSets {
  const pick = (list: { id: number; fixed?: number }[]) =>
    new Set(list.filter((c) => c.fixed === 1).map((c) => c.id));
  return { cat2: pick(cat2List), cat3: pick(cat3List) };
}

export function isFixed(
  r: { cat2_id?: number | null; cat3_id?: number | null; fixed_flag?: number | null },
  f: FixedSets
): boolean {
  if (r.fixed_flag != null) return r.fixed_flag === 1;
  /* 소 · 세 어느 쪽에 걸려 있어도 고정이다 — Blur와 같은 셈법이다. 소분류를
     고정으로 두면 딸린 세분류를 하나씩 켜지 않아도 함께 따라온다. */
  return f.cat2.has(Number(r.cat2_id)) || f.cat3.has(Number(r.cat3_id));
}

/**
 * 어떤 갈래를 볼지 — 고정 · 변동 곱하기 지출 · 수입 넷.
 *
 * 들어올 때는 넷 다 켜져 있고, 껐다 켠 것은 담아 두지 않는다. 화면을 옮기면
 * 다시 넷이다. 여기서 빠진 줄은 셈에서도 아예 빠진다(예전 Blur 알약이 하던 일).
 */
export type FixedPick = {
  fixOut: boolean;
  varOut: boolean;
  fixIn: boolean;
  varIn: boolean;
};

export const ALL_FIXED_PICK: FixedPick = {
  fixOut: true,
  varOut: true,
  fixIn: true,
  varIn: true,
};

/** 고른 갈래에 드는 줄인지. 수입인지는 줄의 IN/OUT으로 가른다. */
export function passFixed(
  r: { inout?: number | null; cat2_id?: number | null; cat3_id?: number | null; fixed_flag?: number | null },
  pick: FixedPick,
  f: FixedSets
): boolean {
  const 고정 = isFixed(r, f);
  const 수입 = r.inout === 1;
  if (수입) return 고정 ? pick.fixIn : pick.varIn;
  return 고정 ? pick.fixOut : pick.varOut;
}

/** 고른 것을 주소에 실어 보내는 꼬리표. 고정 지출 · 변동 지출 · 고정 수입 · 변동 수입 차례. */
export function fxTag(pick: FixedPick): string {
  return [pick.fixOut, pick.varOut, pick.fixIn, pick.varIn].map((v) => (v ? "1" : "0")).join("");
}

/** 꼬리표를 되읽는다. 네 자가 아니면 넷 다 켠 것으로 본다. */
export function fxPickFrom(tag: string | null): FixedPick {
  if (!tag || tag.length !== 4) return ALL_FIXED_PICK;
  return {
    fixOut: tag[0] === "1",
    varOut: tag[1] === "1",
    fixIn: tag[2] === "1",
    varIn: tag[3] === "1",
  };
}


