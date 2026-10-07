/**
 * 묶음 — 따로 든 내역 여럿을 한 덩이로 본다.
 *
 * 쪼개기(N빵)가 한 건 안을 나누는 것이라면, 묶음은 독립된 건 여럿을 하나로
 * 모은다. 여행이나 행사처럼 날이 걸쳐 있고 분류도 제각각인 지출을 한자리에서
 * 보려는 것이다.
 */

/** 어느 화면의 내역을 묶었는지. 한 묶음이 둘을 섞어 담지 않는다. */
export type GroupKind = "entry" | "pending" | "scheduled";

/** 묶음에 담긴 내역 한 줄. 내역 카드가 그리는 데 필요한 것만 들어 있다. */
export type GroupItem = {
  entry_id: number;
  schedule_id?: number;
  tx_date: string | null;
  day_of_month?: number;
  cat1_id: number | null;
  cat2_id: number | null;
  cat3_id: number | null;
  cat3_name?: string | null;
  inout: number;
  amount: number;
  pay_method: number | null;
  memo: string | null;
  place_id: number | null;
  place_name: string | null;
  perf_exclude: number;
  fixed_flag: number | null;
  group_id: number | null;
  split_amount?: number;
  net_amount?: number;
  split_count?: number;
};

export type EntryGroup = {
  group_id: number;
  name: string;
  memo: string | null;
  kind: GroupKind;
  count: number;
  /** 수입 − 지출. 화면이 쓰는 셈과 같다. */
  net: number;
  has_in: boolean;
  has_out: boolean;
  date_from: string | null;
  date_to: string | null;
  items: GroupItem[];
};

/** 화면 이름 — 안내 문구와 팝업 제목이 함께 쓴다. */
export const KIND_NAME: Record<GroupKind, string> = {
  entry: "지출 내역",
  pending: "대기 내역",
  scheduled: "정기 내역",
};
