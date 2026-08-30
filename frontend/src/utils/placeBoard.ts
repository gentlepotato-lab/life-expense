/**
 * 어디 쓰나 — 장소 한 벌을 넷으로 돌려 보는 셈.
 *
 * 기간만 서버에서 걸러 오고, 고르고 묶는 일은 여기서 한다. 넷을 따로 받아
 * 오면 같은 것을 네 번 세게 되고, 500곳 남짓이라 한 벌이 무겁지 않다.
 */

export type BoardPlace = {
  place_id: number;
  place_name: string;
  city: string | null;
  district: string | null;
  town: string | null;
  address: string | null;
  phone: string | null;
  place_url: string | null;
  kind: string | null;
  kind2: string | null;
  lat: number | null;
  lng: number | null;
  used_count: number;
  total: number;
  last_used: string | null;
};

/** 서버가 알려 주는, 고를 수 있는 앞뒤 달 */
export type BoardSpan = { from: string | null; to: string | null };

export type BoardData = { span: BoardSpan; places: BoardPlace[] };

/** 걸어 둔 기간 — 달 단위(`YYYY-MM`)다. 빈 글자는 안 건 것이다. */
export type Period = { since: string; until: string };

export const NO_PERIOD: Period = { since: "", until: "" };

/** 처음 보는 기간은 석 달이다. 몇 해치를 통째로 펼치면 지금 어디를 다니는지가 안 보인다. */
export const DEFAULT_MONTHS = 3;

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** 오늘이 든 달까지 거슬러 n달 — 석 달이면 지지난달부터 이번 달까지다. */
export function recentMonths(n: number = DEFAULT_MONTHS): Period {
  const now = new Date();
  const back = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1);
  return { since: ym(back), until: ym(now) };
}

/**
 * 고를 수 있는 달을 최근 것부터 늘어놓는다.
 *
 * 적어 둔 것이 있는 만큼만 만든다 — 아무것도 없는 달을 골라 봐야 빈 목록만
 * 나온다. 앞뒤를 모르면(아직 아무것도 안 적었으면) 하나도 만들지 않는다.
 */
export function monthOptions(from: string | null, to: string | null) {
  if (!from || !to) return [];
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);

  const out: { value: string; label: string }[] = [];
  for (let y = ty, m = tm; y > fy || (y === fy && m >= fm); ) {
    out.push({ value: `${y}-${String(m).padStart(2, "0")}`, label: `${y}. ${m}.` });
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

/** 걸어 둔 기간을 단추에 적을 말로 */
export function periodLabel(p: Period): string {
  const say = (v: string) => {
    const [y, m] = v.split("-");
    return `${y}. ${Number(m)}.`;
  };
  if (!p.since && !p.until) return "기간";
  if (p.since && p.until) {
    return p.since === p.until ? say(p.since) : `${say(p.since)} ~ ${say(p.until)}`;
  }
  return p.since ? `${say(p.since)} ~` : `~ ${say(p.until)}`;
}

/** 어떤 잣대로 볼지 */
export type BoardView = "often" | "much" | "where" | "kind";

export const VIEWS: { key: BoardView; label: string }[] = [
  { key: "much", label: "많이 쓴 곳" },
  { key: "often", label: "자주 간 곳" },
  { key: "where", label: "지역" },
  { key: "kind", label: "업종" },
];

/** 접을 수 있는 잣대 — 묶음이 있는 둘뿐이다. */
export const FOLDS: BoardView[] = ["where", "kind"];

/** 묶음을 무엇으로 세울지 — 다녀온 횟수인가 쓴 돈인가 */
export type BoardSort = "visits" | "money";

export const SORTS: { key: BoardSort; label: string }[] = [
  { key: "visits", label: "횟수" },
  { key: "money", label: "금액" },
];

/**
 * 묶음 하나.
 *
 * 지역은 시도 아래 시군구가 한 겹 더 있다(children). 업종은 한 겹뿐이라
 * 곳들이 바로 달린다(places). 자주 · 많이는 묶음이 하나뿐이다.
 */
export type BoardNode = {
  key: string;
  label: string;
  /** 든 곳의 수 */
  count: number;
  /** 그 곳들에 다녀온 횟수를 다 더한 것 */
  visits: number;
  total: number;
  places: BoardPlace[];
  children: BoardNode[];
};

/** 이름 · 동네 · 업종 어느 쪽으로 쳐도 걸리게 한다 */
export function narrow(rows: BoardPlace[], q: string): BoardPlace[] {
  const key = q.trim().toLowerCase();
  if (!key) return rows;
  return rows.filter((p) =>
    [p.place_name, p.city, p.district, p.town, p.kind, p.kind2, p.address]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(key))
  );
}

const byName = (a: BoardPlace, b: BoardPlace) =>
  a.place_name.localeCompare(b.place_name, "ko-KR");

const often = (a: BoardPlace, b: BoardPlace) =>
  b.used_count - a.used_count || b.total - a.total || byName(a, b);

const rich = (a: BoardPlace, b: BoardPlace) =>
  b.total - a.total || b.used_count - a.used_count || byName(a, b);

/* 묶음 안의 줄도 묶음과 같은 잣대로 세운다. 묶음은 금액 순인데 그 안의
   줄은 횟수 순이면 무엇을 보고 있는지 헷갈린다. */
const placeBy = (sort: BoardSort) => (sort === "visits" ? often : rich);

const sum = (list: BoardPlace[]) => list.reduce((n, p) => n + p.total, 0);
const hits = (list: BoardPlace[]) => list.reduce((n, p) => n + p.used_count, 0);

/**
 * 묶음 차례.
 *
 * 자주 간 쪽과 많이 쓴 쪽은 다르다 — 매일 들르는 편의점이 있는 동네와,
 * 한 번 갔지만 큰돈을 쓴 동네가 그렇다. 어느 쪽으로 볼지는 화면에서 고른다.
 */
const bulkBy = (sort: BoardSort) => (a: BoardNode, b: BoardNode) =>
  (sort === "visits" ? b.visits - a.visits : b.total - a.total) ||
  (sort === "visits" ? b.total - a.total : b.visits - a.visits) ||
  b.count - a.count ||
  a.label.localeCompare(b.label, "ko-KR");

/** 같은 이름끼리 담는다. 담은 차례는 지키므로 먼저 나온 것이 앞에 선다. */
function bagBy(rows: BoardPlace[], name: (p: BoardPlace) => string) {
  const bag = new Map<string, BoardPlace[]>();
  for (const p of rows) {
    const label = name(p);
    const got = bag.get(label);
    if (got) got.push(p);
    else bag.set(label, [p]);
  }
  return bag;
}

/**
 * 잣대대로 묶어 돌려준다.
 *
 * 자주 · 많이는 묶음이 하나뿐이라 줄만 세운다. 업종은 한 겹, 지역은
 * 시도 아래 시군구까지 두 겹이다 — 분류 화면이 중분류 아래 소분류를 두는
 * 것과 같은 짜임이라, 접고 펴는 손놀림도 그쪽과 같다.
 */
export function board(
  rows: BoardPlace[],
  view: BoardView,
  sort: BoardSort = "money",
): BoardNode[] {
  const byBulk = bulkBy(sort);
  const byPlace = placeBy(sort);

  if (view === "often" || view === "much") {
    /* 자주 · 많이는 잣대 이름이 곧 세우는 기준이라 정렬 고르개를 두지 않는다. */
    const sorted = [...rows].sort(view === "often" ? often : rich);
    return [
      {
        key: view,
        label: view === "often" ? "자주 간 곳" : "많이 쓴 곳",
        count: sorted.length,
        visits: hits(sorted),
        total: sum(sorted),
        places: sorted,
        children: [],
      },
    ];
  }

  if (view === "kind") {
    return [...bagBy(rows, (p) => p.kind || "무엇인지 모를 곳").entries()]
      .map(([label, places]) => ({
        key: `kind:${label}`,
        label,
        count: places.length,
        visits: hits(places),
        total: sum(places),
        places: places.sort(byPlace),
        children: [],
      }))
      .sort(byBulk);
  }

  return [...bagBy(rows, (p) => p.city || "어딘지 모를 곳").entries()]
    .map(([city, inCity]) => {
      const children = [...bagBy(inCity, (p) => p.district || "어딘지 모를 곳").entries()]
        .map(([district, places]) => ({
          key: `where:${city}/${district}`,
          label: district,
          count: places.length,
          visits: hits(places),
          total: sum(places),
          places: places.sort(byPlace),
          children: [],
        }))
        .sort(byBulk);

      return {
        key: `where:${city}`,
        label: city,
        count: inCity.length,
        visits: hits(inCity),
        total: sum(inCity),
        places: [],
        children,
      };
    })
    .sort(byBulk);
}

/** 묶음과 그 아래 묶음의 열쇠를 모두 모은다 — 모두 펼치기에 쓴다. */
export function allKeys(nodes: BoardNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    out.push(n.key);
    for (const kid of n.children) out.push(kid.key);
  }
  return out;
}
