/**
 * 카드 목록을 날짜별 단으로 묶고 집계하기 위한 유틸.
 * Expense Records와 Pending Entries가 같은 모양을 갖도록 여기 한 곳에서 관리한다.
 */

export type GroupSummary = {
  count: number;
  /** 수입 합계(inout === 1) */
  inSum: number;
  /** 지출 합계(inout === -1) */
  outSum: number;
  /** 그날의 순합계 = 수입 − 지출. 화면에는 이 값 하나만 보여 준다. */
  net: number;
  /** 금액이 가려진 항목이 하나라도 있는지 — 합계도 함께 가려야 한다. */
  hasMasked: boolean;
};

export type DateGroup<T> = {
  /** YYYY-MM-DD */
  date: string;
  label: string;
  items: T[];
  summary: GroupSummary;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * YYYY-MM-DD → "2026. 8. 9. (일)"
 *
 * 여는 괄호는 앞말에 붙이는 것이 규칙이지만, 날짜 뒤의 요일은 예외다.
 * 앞말이 마침표로 끝나 "9.(일)"처럼 점과 괄호가 붙으면 답답해 보인다.
 */
export function formatDateLabel(date: string): string {
  if (!date) return "날짜 없음";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. (${WEEKDAYS[d.getDay()]})`;
}

type Summarizable = {
  inout?: number | null;
  amount?: number | null;
  /**
   * 금액 쪼개기를 반영한 실지출. 돌려받은 몫은 내 지출이 아니므로
   * 날짜 합계는 이 값이 있으면 이 값을 쓴다.
   * 분할을 쓰지 않는 화면(Pending 등)에는 없으므로 amount로 떨어진다.
   */
  net_amount?: number | null;
};

function summarize<T extends Summarizable>(
  items: T[],
  isMasked?: (row: T) => boolean
): GroupSummary {
  let inSum = 0;
  let outSum = 0;
  let hasMasked = false;

  for (const item of items) {
    const raw = item.net_amount ?? item.amount;
    const amount = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(amount)) continue;

    if (isMasked?.(item)) hasMasked = true;

    if (item.inout === 1) inSum += amount;
    else outSum += amount;
  }

  return { count: items.length, inSum, outSum, net: inSum - outSum, hasMasked };
}

/**
 * tx_date 기준으로 묶고 날짜별 합계를 함께 계산한다.
 * 들어온 순서를 그대로 보존하므로 서버 정렬(tx_date DESC 등)이 유지된다.
 *
 * @param isMasked 금액이 가려지는 행인지 판정(소분류의 blur 설정). 가려진 항목이
 *                 섞인 날은 합계도 가려서 표시해야 하므로 필요하다.
 */
export function groupByDate<T extends Summarizable & { tx_date?: string | null }>(
  rows: T[],
  isMasked?: (row: T) => boolean
): DateGroup<T>[] {
  const order: string[] = [];
  const bucket = new Map<string, T[]>();

  for (const row of rows) {
    const key = row.tx_date ? String(row.tx_date).substring(0, 10) : "";
    if (!bucket.has(key)) {
      bucket.set(key, []);
      order.push(key);
    }
    bucket.get(key)!.push(row);
  }

  return order.map((date) => {
    const items = bucket.get(date)!;
    return {
      date,
      label: formatDateLabel(date),
      items,
      summary: summarize(items, isMasked),
    };
  });
}
