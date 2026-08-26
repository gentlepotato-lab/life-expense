/**
 * 잔소리 — 지금 있는 자료만 보고 한마디 한다.
 *
 * 규칙을 따로 저장하지 않는다. 볼 때마다 내역을 다시 세므로, 지난 내역을
 * 고쳐도 잔소리가 어긋날 일이 없다. 사람이 미리 정해 둬야 하는 것(분류별
 * 한도 · 카드 실적 목표)은 규칙 표를 둔 뒤에 여기에 덧붙인다.
 *
 * 말투는 이 파일 한 곳에서만 정한다. 모두 "…습니다." 로 끝낸다 —
 * 표정은 문장이 아니라 묶음 이름표(:-( · ;-))가 맡는다.
 *
 * 날짜는 내역 화면과 같은 모양(formatDateLabel)으로 적는다. 화면마다 날짜가
 * 달리 보이면 같은 날인지 알아보기 어렵다.
 */

import type { Row } from "./calendarFilter";
import { formatDateLabel } from "./dateGroup";

/** 잔소리 한 줄이 딸린 자리 */
export type Level = "bad" | "watch" | "good";

/** 이 잔소리가 어느 내역에서 왔는지 — 상세에서 그 화면으로 건너뛴다 */
export type NudgeLink = "expense" | "pending" | "scheduled";

/** 길게 눌렀을 때 펼쳐 보이는 낱낱 — 날짜 · 분류 · 메모 · 금액 */
export type NudgeItem = {
  key: string;
  /** YYYY-MM-DD */
  date?: string;
  /** "식비 > 점심 > 김밥" */
  cat?: string;
  memo?: string;
  amount?: number;
  /** 가려 둔 갈래 — 금액에만 테이프를 붙인다 */
  blur?: boolean;
};

export type Nudge = {
  key: string;
  level: Level;
  /** 화면에 그대로 나가는 한 줄 */
  say: string;
  /** 그 아래 작게 붙는 근거 */
  meta?: string;
  /** 가려 둔 갈래가 섞여 있다 — 테이프를 붙인다 */
  blur?: boolean;
  /** 상세 팝업에 펼칠 것 */
  items?: NudgeItem[];
  /** 상세 팝업에서 건너뛸 내역 화면 */
  link?: NudgeLink;
};

/** 달력이 쓰는 줄에 날짜(YYYY-MM-DD)를 더한 것 */
export type NRow = Row & { date: string };

/** 분류 세 단을 가진 것이면 무엇이든 */
type Cats = { cat1_id?: number | null; cat2_id?: number | null; cat3_id?: number | null };

export type NudgeSource = {
  /** 오늘 — "YYYY-MM-DD" */
  today: string;
  /** 최근 세 달치 지출. 수입 · Exclude 는 이미 걸러 낸 뒤다 */
  rows: NRow[];
  /** 가려 둔 갈래에서 온 줄 — 셈에는 넣고 화면에서만 테이프로 덮는다 */
  masked: Set<string>;
  cat2Name: Map<number, string>;
  /** "중 > 소 > 세" — 비어 있는 단은 건너뛴다 */
  catPath: (r: Cats) => string;
  /** 아직 보내지 않은 대기 내역 */
  pending: (Cats & { key: string; date: string; name: string; amount: number; memo?: string; blur?: boolean })[];
  /** 앞으로 일주일 안에 빠져나갈 정기 지출 */
  upcoming: (Cats & { key: string; name: string; amount: number; date: string; memo?: string })[];
};

/* ─── 말투 ──────────────────────────────────────────────────── */

function line(
  key: string,
  level: Level,
  say: string,
  meta?: string,
  extra?: { blur?: boolean; items?: NudgeItem[]; link?: NudgeLink }
): Nudge {
  return { key, level, say: `${say}.`, meta, ...extra };
}

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

/* ─── 날짜 ──────────────────────────────────────────────────── */

const toDate = (s: string) =>
  new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** a - b, 날짜 수 */
function gap(a: string, b: string): number {
  return Math.round((toDate(a).getTime() - toDate(b).getTime()) / 86400000);
}

function shift(base: string, step: number): string {
  const d = toDate(base);
  d.setDate(d.getDate() + step);
  return ymd(d);
}

/** 문장 안에서 부르는 말. 가까운 날만 말로 하고 나머지는 그냥 센다 */
const ahead = (d: number) => (d === 0 ? "오늘" : d === 1 ? "내일" : d === 2 ? "모레" : `${d}일 뒤`);
const behind = (d: number) => (d === 0 ? "오늘" : d === 1 ? "어제" : d === 2 ? "그저께" : `${d}일 전`);

/** 며칠 뒤부터는 한 줄씩 알리지 않고 묶는다.
    닷새 뒤 빠질 돈을 한 건씩 늘어놓아 봐야 지금 할 수 있는 일이 없다. */
const BUNDLE_FROM = 3;

/** 한 줄씩 알리는 것도 셋까지 — 월말처럼 같은 날에 몰리면 화면을 다 먹는다 */
const NEAR_MAX = 3;

/* ─── 규칙 ──────────────────────────────────────────────────── */

export function buildNudges(src: NudgeSource): Nudge[] {
  const out: Nudge[] = [];
  const { today, rows, masked, cat2Name, catPath } = src;
  const thisYm = today.slice(0, 7);
  const lastYm = shift(`${thisYm}-01`, -1).slice(0, 7);

  const isMasked = (r: NRow) => masked.has(r.key);
  const asItem = (r: NRow): NudgeItem => ({
    key: r.key,
    date: r.date,
    cat: catPath(r),
    memo: (r.place_name ?? "").trim() || (r.memo ?? "").trim() || undefined,
    amount: r.net,
    blur: isMasked(r),
  });

  /* ① 곧 빠져나갈 정기 지출.
     아직 오지 않은 돈이라 다른 규칙과 달리 rows 가 아니라 예정일을 본다. */
  const soon = [...src.upcoming].sort((a, b) => a.date.localeCompare(b.date));
  const asSched = (s: (typeof soon)[number]): NudgeItem => ({
    key: s.key,
    date: s.date,
    cat: catPath(s),
    memo: s.memo,
    amount: s.amount,
  });
  /* 사흘 안(오늘 · 내일 · 모레)은 한 건씩, 그보다 먼 것은 한 줄로 묶는다 */
  const near = soon.filter((s) => gap(s.date, today) < BUNDLE_FROM);
  const rest = [...near.slice(NEAR_MAX), ...soon.filter((s) => gap(s.date, today) >= BUNDLE_FROM)];

  near.slice(0, NEAR_MAX).forEach((s) => {
    out.push(
      line(
        `due-${s.key}`,
        "watch",
        `${ahead(gap(s.date, today))} ${s.name} ${won(s.amount)}이 빠져나갑니다`,
        formatDateLabel(s.date),
        { items: [asSched(s)], link: "scheduled" }
      )
    );
  });

  if (rest.length > 0) {
    const spread = rest.some((s) => s.date !== rest[0].date);
    out.push(
      line(
        "due-rest",
        "watch",
        `그 밖에 ${rest.length}건이 더 빠져나갑니다`,
        spread ? `${formatDateLabel(rest[0].date)}부터` : formatDateLabel(rest[0].date),
        { items: rest.map(asSched), link: "scheduled" }
      )
    );
  }

  /* ② 대기 내역이 밀렸다. 사흘까지는 봐준다 — 그 안에 정리하는 일이 흔하다 */
  if (src.pending.length > 0) {
    const sorted = [...src.pending].sort((a, b) => a.date.localeCompare(b.date));
    const held = gap(today, sorted[0].date);
    if (held >= 3) {
      out.push(
        line(
          "pending",
          held >= 7 ? "bad" : "watch",
          `대기 내역 ${sorted.length}건이 ${held}일째 그대로입니다`,
          `가장 오래된 것은 ${formatDateLabel(sorted[0].date)}`,
          {
            blur: sorted.some((p) => p.blur),
            items: sorted.map((p) => ({
              key: p.key,
              date: p.date,
              cat: catPath(p),
              memo: p.memo,
              amount: p.amount,
              blur: p.blur,
            })),
            link: "pending",
          }
        )
      );
    }
  }

  /* ③ 지난 달 같은 기간과 견준다.
     달이 끝나야 알 수 있는 총액 대신 "이맘때까지" 로 맞춰야 견줄 수 있다. */
  const day = Number(today.slice(8, 10));
  const upToDay = (ym: string) =>
    rows.filter((r) => r.date.startsWith(ym) && Number(r.date.slice(8, 10)) <= day);
  const nowRows = upToDay(thisYm);
  const now = nowRows.reduce((s, r) => s + r.net, 0);
  const before = upToDay(lastYm).reduce((s, r) => s + r.net, 0);
  if (before > 0 && now > 0) {
    const rate = Math.round(((now - before) / before) * 100);
    if (rate !== 0) {
      out.push(
        line(
          "pace",
          rate > 0 ? "bad" : "good",
          `이번 달 ${won(now)}으로, 지난 달 같은 기간보다 ${Math.abs(rate)}% ${rate > 0 ? "많습니다" : "적습니다"}`,
          `1일부터 ${day}일까지 · 지난 달 같은 기간 ${won(before)}`,
          {
            blur: nowRows.some(isMasked),
            items: [...nowRows].sort((a, b) => b.date.localeCompare(a.date)).map(asItem),
            link: "expense",
          }
        )
      );
    }
  }

  /* ④ 평소보다 큰 한 건 */
  const bySmall = new Map<number, NRow[]>();
  rows.forEach((r) => {
    const id = Number(r.cat2_id);
    if (!id) return;
    const list = bySmall.get(id) ?? [];
    list.push(r);
    bySmall.set(id, list);
  });
  const bigs: { row: NRow; ratio: number; mean: number; peers: NRow[] }[] = [];
  rows.forEach((r) => {
    const back = gap(today, r.date);
    if (back < 0 || back > 7) return;
    const peers = bySmall.get(Number(r.cat2_id));
    if (!peers || peers.length < 5) return;
    const mean = peers.reduce((s, v) => s + v.net, 0) / peers.length;
    if (mean <= 0 || r.net < 10000) return;
    const ratio = r.net / mean;
    if (ratio >= 3) bigs.push({ row: r, ratio, mean, peers });
  });
  bigs.sort((a, b) => b.ratio - a.ratio);
  if (bigs.length > 0) {
    const { row, ratio, mean, peers } = bigs[0];
    const name = cat2Name.get(Number(row.cat2_id)) ?? "어딘가";
    out.push(
      line(
        `big-${row.key}`,
        "bad",
        `${behind(gap(today, row.date))} ${name}에 ${won(row.net)}, 평소의 ${Math.round(ratio)}배를 썼습니다`,
        `${name} 평균 ${won(mean)}`,
        {
          blur: isMasked(row),
          items: [
            row,
            ...peers
              .filter((p) => p.key !== row.key)
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 6),
          ].map(asItem),
          link: "expense",
        }
      )
    );
  }

  /* ⑤ 같은 자리를 자주 갔다 */
  const spots = new Map<string, NRow[]>();
  rows.forEach((r) => {
    if (!r.date.startsWith(thisYm)) return;
    const name = (r.place_name ?? "").trim();
    if (!name) return;
    const list = spots.get(name) ?? [];
    list.push(r);
    spots.set(name, list);
  });
  const top = [...spots.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (top && top[1].length >= 8) {
    const [name, list] = top;
    out.push(
      line(
        `spot-${name}`,
        "watch",
        `${name}에 이번 달만 ${list.length}번 갔습니다`,
        `합쳐서 ${won(list.reduce((s, r) => s + r.net, 0))}`,
        {
          blur: list.some(isMasked),
          items: [...list].sort((a, b) => b.date.localeCompare(a.date)).map(asItem),
          link: "expense",
        }
      )
    );
  }

  /* ⑥ 이어 온 날들.
     오늘은 아직 안 끝났으니 어제까지만 센다 — 아침에 "안 썼다" 고 칭찬하면
     저녁에 무안해진다. */
  const byDay = new Map<string, NRow[]>();
  rows.forEach((r) => {
    const list = byDay.get(r.date) ?? [];
    list.push(r);
    byDay.set(r.date, list);
  });
  /* 받아 온 것이 세 달치뿐이라 그 바깥까지 세지 않는다 */
  const LOOKBACK = 60;
  if (byDay.has(shift(today, -1))) {
    let run = 0;
    while (run < LOOKBACK && byDay.has(shift(today, -1 - run))) run += 1;
    if (run >= 5) {
      const dates = Array.from({ length: run }, (_, i) => shift(today, -1 - i));
      const list = dates.flatMap((d) => byDay.get(d) ?? []);
      out.push(
        line("streak", "bad", `${run}일 연속으로 썼습니다`, `${formatDateLabel(shift(today, -run))}부터 어제까지`, {
          blur: list.some(isMasked),
          items: list.map(asItem),
          link: "expense",
        })
      );
    }
  } else if (byDay.size > 0) {
    let rest = 0;
    while (rest < LOOKBACK && !byDay.has(shift(today, -1 - rest))) rest += 1;
    if (rest === 1) out.push(line("rest", "good", "어제는 한 푼도 쓰지 않았습니다"));
    else if (rest < LOOKBACK) {
      out.push(line("rest", "good", `어제까지 ${rest}일 연속 한 푼도 쓰지 않았습니다`));
    }
  }

  const order: Record<Level, number> = { bad: 0, watch: 1, good: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
