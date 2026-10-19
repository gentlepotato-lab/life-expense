/**
 * 잔소리의 말투.
 *
 * 무엇이 잔소리감인지는 서버가 가린다(backend/app/nudgecalc.py). 이 파일은
 * 서버가 보내 온 갈래와 숫자에 말을 붙이는 일만 한다 — 문구는 자주 다듬는데
 * 그때마다 서버를 다시 띄울 까닭이 없어 이렇게 갈랐다.
 *
 * 말투는 이 파일 한 곳에서만 정한다. 모두 "…습니다."로 끝낸다 —
 * 표정은 문장이 아니라 묶음 이름표(:-( · ;-))가 맡는다.
 *
 * 날짜는 내역 화면과 같은 모양(formatDateLabel)으로 적는다. 화면마다 날짜가
 * 달리 보이면 같은 날인지 알아보기 어렵다.
 */

import type { Row } from "./calendarFilter";
import { formatDateLabel } from "./dateGroup";
import { manwon } from "./amount";

/** 잔소리 한 줄이 딸린 자리 */
export type Level = "bad" | "watch" | "good";

/** 이 잔소리가 어느 내역에서 왔는지 — 상세에서 그 화면으로 건너뛴다. */
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
  /** 가린 갈래 — 금액에만 테이프를 붙인다. */
  blur?: boolean;
};

export type Nudge = {
  key: string;
  level: Level;
  /** 화면에 그대로 나가는 한 줄 */
  say: string;
  /** 그 아래 작게 붙는 근거 */
  meta?: string;
  /** 가린 갈래가 섞여 있다 — 테이프를 붙인다. */
  blur?: boolean;
  /** 상세 팝업에 펼칠 것 */
  items?: NudgeItem[];
  /** 상세 팝업에서 건너뛸 내역 화면 */
  link?: NudgeLink;
};

/** 달력이 쓰는 줄에 날짜(YYYY-MM-DD)를 더한 것 */
export type NRow = Row & { date: string };

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

/** 문장 안에서 부르는 말. 가까운 날만 말로 하고 나머지는 그냥 센다. */
const ahead = (d: number) => (d === 0 ? "오늘" : d === 1 ? "내일" : d === 2 ? "모레" : `${d}일 뒤`);
const behind = (d: number) => (d === 0 ? "오늘" : d === 1 ? "어제" : d === 2 ? "그저께" : `${d}일 전`);

/* ─── 서버가 보내 온 것 ──────────────────────────────────────── */

/**
 * 서버가 센 잔소리 한 건.
 *
 * 무엇이 잔소리감인지는 서버가 가린다(backend/app/nudgecalc.py). 여기로는
 * 갈래와 숫자와 근거 줄만 온다 — 문장은 아래 말짓기()가 짓는다. 문구를 다듬을
 * 때 서버를 다시 띄우지 않아도 되게 하려는 가름이다.
 */
export type 센것 = {
  kind: string;
  key: string;
  level: Level;
  link?: NudgeLink;
  값: Record<string, unknown>;
  items?: NudgeItem[];
};

const 수 = (v: unknown) => Number(v ?? 0);
const 글 = (v: unknown) => String(v ?? "");

/**
 * 센 것에 말을 붙인다.
 *
 * 갈래마다 한 줄씩이다. 서버가 새 갈래를 보내 와도 여기 없으면 조용히
 * 건너뛴다 — 알 수 없는 말을 화면에 띄우느니 낫다.
 */
function 한마디(n: 센것): Nudge | null {
  const v = n.값;
  const 딸림 = { blur: Boolean(v.blur), items: n.items, link: n.link };

  switch (n.kind) {
    /* ① 곧 빠져나갈 정기 지출 */
    case "due":
      return line(
        n.key,
        n.level,
        `${ahead(수(v.남은날))} ${글(v.이름)} ${won(수(v.금액))}이 빠져나갑니다`,
        formatDateLabel(글(v.날)),
        딸림
      );
    case "due-rest":
      return line(
        n.key,
        n.level,
        `그 밖에 ${수(v.건수)}건이 더 빠져나갑니다`,
        v.여럿날 ? `${formatDateLabel(글(v.첫날))}부터` : formatDateLabel(글(v.첫날)),
        딸림
      );

    /* ② 대기 내역이 밀렸다 */
    case "pending":
      return line(
        n.key,
        n.level,
        `대기 내역 ${수(v.건수)}건이 ${수(v.묵은날)}일째 그대로입니다`,
        `가장 오래된 것은 ${formatDateLabel(글(v.가장오래된날))}`,
        딸림
      );

    /* ③ 지난 달 같은 기간과 견준다 */
    case "pace":
      return line(
        n.key,
        n.level,
        `이번 달 지출은 ${won(수(v.이번))}으로, 지난 달 같은 기간보다 ${won(수(v.차이))}(${수(
          v.비율
        ).toFixed(1)}%) ${v.늘었나 ? "많습니다" : "적습니다"}`,
        `1일부터 ${수(v.날)}일까지 · 지난 달 같은 기간 ${won(수(v.지난))}`,
        딸림
      );

    /* ④ 평소보다 큰 한 건 */
    case "big":
      return line(
        n.key,
        n.level,
        `${behind(수(v.지난날))} ${글(v.분류)}에 ${won(수(v.금액))}, 평소의 ${수(v.배)}배를 썼습니다`,
        `${글(v.분류)} 평균 ${won(수(v.평균))}`,
        딸림
      );

    /* ⑤ 같은 자리를 자주 갔다 */
    case "spot":
      return line(
        n.key,
        n.level,
        `${글(v.자리)}에 이번 달만 ${수(v.횟수)}번 갔습니다`,
        `합쳐서 ${won(수(v.합계))}`,
        딸림
      );

    /* ⑥ 이어 온 날들 */
    case "streak":
      return line(
        n.key,
        n.level,
        `${수(v.이어)}일 연속으로 썼습니다`,
        `${formatDateLabel(글(v.부터))}부터 어제까지`,
        딸림
      );
    case "rest":
      return 수(v.쉼) === 1
        ? line(n.key, n.level, "어제는 한 푼도 쓰지 않았습니다")
        : line(n.key, n.level, `어제까지 ${수(v.쉼)}일 연속 한 푼도 쓰지 않았습니다`);

    /* ⑦ 카드 실적을 채웠다 */
    case "perf":
      return line(
        n.key,
        n.level,
        `${글(v.카드)}, ${manwon(수(v.문턱))} 구간을 채웠습니다`,
        `이번 달 실적 ${won(수(v.실적))}`,
        딸림
      );

    /* ⑧ 분류별 목표 — 안쓴이 도전 */
    case "goal-over":
      return line(
        n.key,
        n.level,
        `${글(v.길)}, 목표 ${manwon(수(v.목표))}을 ${won(수(v.넘긴돈))} 넘겼습니다`,
        `이번 달 ${won(수(v.쓴돈))}`,
        딸림
      );
    case "goal-will":
      return line(
        n.key,
        n.level,
        `${글(v.길)}, 이대로면 이번 달에 목표를 넘깁니다`,
        `${수(v.날)}일까지 ${won(수(v.쓴돈))} · 이대로면 ${won(수(v.속도))} · 목표 ${manwon(수(v.목표))}`,
        딸림
      );
    case "goal-keep":
      return line(
        n.key,
        n.level,
        `${글(v.길)}, 목표까지 ${won(수(v.남은돈))} 남았습니다`,
        `이번 달 ${won(수(v.쓴돈))} · 목표 ${manwon(수(v.목표))}`,
        딸림
      );

    default:
      return null;
  }
}

/**
 * 센 것들에 말을 붙여 화면이 쓸 꼴로 만든다.
 *
 * 차례는 서버가 매긴 그대로 둔다(bad 먼저, watch, good). 같은 차례를 두 곳에서
 * 매기면 한쪽만 고쳤을 때 어긋난다.
 */
export function 말짓기(센것들: 센것[]): Nudge[] {
  const out: Nudge[] = [];
  센것들.forEach((n) => {
    const 한 = 한마디(n);
    if (한) out.push(한);
  });
  return out;
}
