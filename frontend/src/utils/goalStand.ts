/**
 * 안쓴이 도전 — 분류별 목표를 이번 달 씀씀이와 견주는 셈.
 *
 * 화면(안쓴이 도전)과 잔소리가 같은 값을 말해야 하므로 셈은 여기 한 곳에만 둔다.
 * 두 곳에서 따로 세면 같은 달인데 숫자가 다른 일이 반드시 생긴다.
 *
 * 세는 잣대는 씀씀이·잔소리와 같다 — 지출·대기·정기 세 갈래를 모두 세고,
 * N빵 뒤 내 몫(net)을 센다. 수입과 Exclude는 부르는 쪽에서 이미 걸러 낸 뒤다.
 */

/** 걸어 둔 목표 하나 */
export type Goal = {
  goal_id: number;
  cat1_id: number;
  cat2_id: number | null;
  cat3_id: number | null;
  amount: number;
  /** 왜 이 목표를 걸었는지 — 금액만으로는 남지 않는다. */
  memo: string | null;
  /** "식비 > 점심" — 서버가 붙여 준다. */
  path: string;
  emoji: string | null;
};

/** 셈에 쓰는 줄이 갖춰야 할 것 */
export type GoalRow = {
  key: string;
  date: string;
  net: number;
  cat1_id?: number | null;
  cat2_id?: number | null;
  cat3_id?: number | null;
  /* 상세에 무엇을 샀는지 적으려면 이 둘이 필요하다. */
  place_name?: string | null;
  memo?: string | null;
};

/** 달 후반부터만 칭찬한다 — 3일차에 "목표까지 47만 원 남았습니다"는 아무 말도 아니다. */
export const PRAISE_FROM_DAY = 20;

/**
 * 이 줄이 그 목표의 가지 아래인가.
 *
 * 목표가 중분류에만 걸려 있으면 그 아래 소·세분류가 모두 들어온다.
 * 겹쳐 건 목표들은 서로 나누지 않고 저마다 제 가지를 통째로 센다.
 */
export function inGoal(goal: Goal, row: GoalRow): boolean {
  if (Number(row.cat1_id) !== goal.cat1_id) return false;
  if (goal.cat2_id != null && Number(row.cat2_id) !== goal.cat2_id) return false;
  if (goal.cat3_id != null && Number(row.cat3_id) !== goal.cat3_id) return false;
  return true;
}

/** 목표 하나의 이번 달 형편 */
export type GoalStand = {
  goal: Goal;
  /** 이번 달 그 가지에 쓴 돈 */
  spent: number;
  /** 목표까지 남은 돈. 넘겼으면 음수 */
  left: number;
  /** 쓴 돈 ÷ 목표 */
  ratio: number;
  /** 지금 속도로 달을 마치면 얼마가 될지 */
  pace: number;
  /** 이미 넘겼다. */
  over: boolean;
  /** 아직 안 넘겼지만 이대로면 넘긴다. */
  willOver: boolean;
  /** 그 목표에 든 줄들 — 상세에 펼친다. */
  rows: GoalRow[];
};

/** 그 달이 며칠까지 있는지 */
function daysInMonth(ym: string): number {
  return new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
}

/**
 * 목표 하나를 이번 달 줄들과 견준다.
 *
 * @param today "YYYY-MM-DD" — 오늘까지 며칠이 지났는지로 남은 속도를 어림한다.
 */
export function standOf(goal: Goal, rows: GoalRow[], today: string): GoalStand {
  const ym = today.slice(0, 7);
  const mine = rows.filter((r) => r.date.startsWith(ym) && inGoal(goal, r));
  const spent = mine.reduce((sum, r) => sum + r.net, 0);

  const day = Number(today.slice(8, 10));
  /* 하루 평균으로 달 끝을 어림한다. 잔소리의 견줌 규칙이 쓰는 방식 그대로다. */
  const pace = day > 0 ? Math.round((spent / day) * daysInMonth(ym)) : spent;

  const over = spent > goal.amount;
  return {
    goal,
    spent,
    left: goal.amount - spent,
    ratio: goal.amount > 0 ? spent / goal.amount : 0,
    pace,
    over,
    willOver: !over && pace > goal.amount,
    rows: mine,
  };
}

/** 걸어 둔 차례 그대로 형편을 낸다. */
export function standsOf(goals: Goal[], rows: GoalRow[], today: string): GoalStand[] {
  return goals.map((g) => standOf(g, rows, today));
}
