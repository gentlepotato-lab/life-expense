import axios from "../api/client";

/**
 * 앱 설정을 화면들이 나눠 쓰는 자리.
 *
 * 설정은 돈쓴이에서 담고 서버가 들고 있지만, 쓰는 쪽은 첫 그림을 그리는 그
 * 순간에 값이 있어야 한다 — Blur를 켠 채로 열지 끈 채로 열지는 useState의
 * 초깃값에서 정해지므로, 받아 온 뒤에 알려 줘 봐야 이미 늦다. 그래서 받아 온
 * 값을 브라우저에 한 벌 남겨 두고 다음 번에는 그것으로 먼저 그린다. 서버에서
 * 받아 온 값은 뒤따라 와서 이 자리를 갱신하고, 다음에 열 때부터 반영된다.
 */

export type Prefs = Record<string, string>;

/** 담아 둔 것이 없을 때의 값 — 서버의 PREF_KEYS와 같아야 한다. */
const FALLBACK: Prefs = {
  blur_default: "0",
  exclude_default: "1",
  home_path: "/",
  nudge_on: "1",
  tape_style: "flower",
};

const STORE_KEY = "life-expense:prefs";

const readStore = (): Prefs => {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Prefs;
  } catch {
    return {};
  }
};

let cache: Prefs = { ...FALLBACK, ...readStore() };

/** 담아 둔 값 하나 */
export function pref(key: string): string {
  return cache[key] ?? FALLBACK[key] ?? "";
}

/** 켬·끔으로 쓰는 값 */
export function prefOn(key: string): boolean {
  return pref(key) === "1";
}

/** 새 값으로 갈아 끼운다 — 돈쓴이에서 담고 나면 부른다. */
export function putPrefs(next: Prefs): void {
  cache = { ...FALLBACK, ...next };
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(cache));
  } catch {
    /* 저장 공간이 막혀 있어도 이번 판은 그대로 돈다 */
  }
}

/** 서버에서 받아 와 자리를 갱신한다. 앱이 뜰 때 한 번 부른다. */
export async function loadPrefs(): Promise<void> {
  try {
    const res = await axios.get<Prefs>("/profile/prefs");
    putPrefs(res.data);
  } catch {
    /* 못 받아 오면 지난번에 담아 둔 것으로 돈다 */
  }
}

/**
 * 첫 화면을 한 번만 옮기기 위한 표시.
 *
 * 탭의 홈까지 가로채면 홈에 갈 길이 사라진다. 앱을 새로 연 그때만 옮긴다.
 */
let homeUsed = false;

export function takeHome(): string {
  if (homeUsed) return "/";
  homeUsed = true;
  return pref("home_path") || "/";
}
