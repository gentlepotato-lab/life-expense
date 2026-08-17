/**
 * 달력이 쓰는 걸러 내기 조건과 판정.
 *
 * 달력과 기간 상세가 같은 판정을 써야 한다 — 달력 칸에 보이던 것과
 * 상세에 펼쳐지는 카드가 어긋나면 안 되기 때문이다.
 * 화면 파일에서 컴포넌트 말고 다른 것을 내보내면 Fast Refresh 가 깨지므로
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
