/**
 * 밝기 여섯 칸.
 *
 * 빛깔(utils/palettes.ts)이 강조색의 축이라면 이것은 바탕과 글씨의 축이다.
 * 둘은 곱해진다. 여섯 벌 곱하기 여섯 칸.
 *
 * 칸이 바꾸는 것은 중성 여섯뿐이다. 그 여섯은 이미 화면 곳곳에서 변수로
 * 쓰이고 있어(사백여든 곳) 값만 갈아 끼우면 화면이 따라온다. 어두운 칸에서
 * 뒤집히는 몇 자리는 index.css 147절이 맡는다.
 *
 * 고른 것은 세 가지로 담는다.
 *   theme_mode   light | dark | system
 *   theme_light  밝은 쪽에서 마지막으로 고른 칸
 *   theme_dark   어두운 쪽에서 마지막으로 고른 칸
 * 시스템을 고르면 운영체제가 밝은지 어두운지만 알려 주므로, 어느 칸으로
 * 갈지는 위 둘에서 꺼내 쓴다. 애써 고른 칸이 시스템에서 무시되지 않는다.
 */

export type Step = {
  key: string;
  /** 조각에 붙는 이름 */
  label: string;
  /** 어두운 쪽 칸인가 */
  dark: boolean;
  bg: string;
  surface: string;
  border: string;
  /** 글씨 세 단 */
  t1: string;
  t2: string;
  t3: string;
};

export const STEPS: Step[] = [
  /* 밝은 쪽 ─ 지금 쓰던 것을 가운데 두고 위아래로 한 칸씩 */
  {
    key: "paper", label: "흰 종이", dark: false,
    bg: "#FFFFFF", surface: "#FFFFFF", border: "#EDF0F3",
    t1: "#212529", t2: "#6C757D", t3: "#ADB5BD",
  },
  {
    /* 값이 :root에 적힌 것과 한 톨도 다르지 않다. */
    key: "now", label: "지금", dark: false,
    bg: "#F8F9FA", surface: "#FFFFFF", border: "#E9ECEF",
    t1: "#212529", t2: "#6C757D", t3: "#ADB5BD",
  },
  {
    key: "hanji", label: "한지", dark: false,
    bg: "#EBEEF2", surface: "#F7F8FA", border: "#DCE1E7",
    t1: "#1F242B", t2: "#646C77", t3: "#A3ABB6",
  },

  /* 어두운 쪽 ─ 검정이 아니라 달빛 아래 종이빛이다 */
  {
    key: "dawn", label: "새벽빛", dark: true,
    bg: "#444B59", surface: "#4E5666", border: "#5C6476",
    t1: "#F2F4F8", t2: "#C3CAD8", t3: "#939CAE",
  },
  {
    key: "moon", label: "달빛", dark: true,
    bg: "#363C49", surface: "#404755", border: "#4E5666",
    t1: "#EFF1F7", t2: "#B8C0D0", t3: "#8A93A6",
  },
  {
    key: "dusk", label: "그믐빛", dark: true,
    bg: "#282D38", surface: "#323844", border: "#3F4653",
    t1: "#EBEEF4", t2: "#ACB5C5", t3: "#7C859A",
  },
];

export type ThemeMode = "light" | "dark" | "system";

export const DEFAULT_MODE: ThemeMode = "light";
/** 고르지 않았을 때 쓰는 칸 — 밝은 쪽은 지금까지 쓰던 것이다. */
export const DEFAULT_LIGHT = "now";
export const DEFAULT_DARK = "moon";

const BY_KEY = new Map(STEPS.map((s) => [s.key, s]));

export const stepOf = (key: string | null | undefined): Step =>
  (key && BY_KEY.get(key)) || STEPS[1];

/** 운영체제가 어두운 쪽을 쓰고 있는가 */
export const systemDark = (): boolean =>
  typeof window !== "undefined" &&
  !!window.matchMedia &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

/** 고른 셋으로부터 지금 서야 할 칸을 고른다. */
export function resolveStep(mode: string, light: string, dark: string): Step {
  if (mode === "system") return stepOf(systemDark() ? dark : light);
  return stepOf(mode === "dark" ? dark : light);
}

let 쓰는칸: Step = STEPS[1];

export const currentStep = (): Step => 쓰는칸;

/**
 * 화면 전체에 칸을 끼운다.
 *
 * 어두운 칸인지를 `<html>`에 적어 둔다. 어두운 쪽에서만 뒤집히는 자리를
 * 147절이 그 표시를 보고 덮는다.
 */
export function applyTheme(mode: string, light: string, dark: string): void {
  const s = resolveStep(mode, light, dark);
  쓰는칸 = s;
  const root = document.documentElement;
  root.dataset.step = s.key;
  if (s.dark) root.dataset.dark = "1";
  else delete root.dataset.dark;

  const st = root.style;
  st.setProperty("--color-bg", s.bg);
  st.setProperty("--color-surface", s.surface);
  st.setProperty("--color-border", s.border);
  st.setProperty("--color-text-primary", s.t1);
  st.setProperty("--color-text-secondary", s.t2);
  st.setProperty("--color-text-tertiary", s.t3);
}

/**
 * 시스템을 고른 사람에게는 운영체제가 바뀌는 그 자리에서 따라 바뀌어야 한다.
 * 다시 열 때까지 기다리면 따라가는 것이 아니다.
 */
export function watchSystem(onChange: () => void): void {
  if (typeof window === "undefined" || !window.matchMedia) return;
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", onChange);
}
