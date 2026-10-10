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
  /**
   * 읽어 주는 기계에게 알릴 이름.
   *
   * 밝은 쪽에서 어두운 쪽으로 가는 단계일 뿐이라 그 차례를 그대로 적는다.
   * 한동안 칸마다 이름을 붙여 두었는데(흰 종이 · 지금 · 한지 …) 무엇이
   * 더 밝은지가 이름에서 읽히지 않았다. 눈으로는 조각의 흑백이 말해 주고,
   * 그것을 못 보는 쪽에는 몇 번째인지를 말해 주는 편이 낫다.
   */
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
  /* 밝은 쪽 ─ 쓰던 자리를 가운데 두고 위아래로 한 칸씩 */
  {
    key: "paper", label: "밝기 1", dark: false,
    bg: "#FFFFFF", surface: "#FFFFFF", border: "#EDF0F3",
    t1: "#212529", t2: "#6C757D", t3: "#ADB5BD",
  },
  {
    /* 값이 :root에 적힌 것과 한 톨도 다르지 않다 — 오래 쓰던 자리다. */
    key: "now", label: "밝기 2", dark: false,
    bg: "#F8F9FA", surface: "#FFFFFF", border: "#E9ECEF",
    t1: "#212529", t2: "#6C757D", t3: "#ADB5BD",
  },
  {
    key: "hanji", label: "밝기 3", dark: false,
    bg: "#EBEEF2", surface: "#F7F8FA", border: "#DCE1E7",
    t1: "#1F242B", t2: "#646C77", t3: "#A3ABB6",
  },
  {
    /* 밝은 쪽과 어두운 쪽 사이의 회색. 흑백의 진짜 가운데(#808080)까지는
       내려가지 못한다 — 거기서는 금액의 지출빛·수입빛이 바탕에 묻힌다.
       재어 보니 1.0 언저리로, 지금 앱이 쓰는 가장 낮은 자리(1.37)보다도
       낮았다. 숫자가 견디는 데까지만 내려와 멈춘 자리다.

       글씨는 어두운 쪽을 쓴다. 바탕이 회색이어도 아직 밝은 무리다. */
    key: "mist", label: "밝기 4", dark: false,
    bg: "#C2C7CE", surface: "#CDD2D8", border: "#AEB5BE",
    t1: "#1A1E24", t2: "#464D57", t3: "#636B76",
  },

  /* 어두운 쪽 ─ 검정까지 내려가지 않는다. 종이빛이 남아 있는 데까지다. */
  {
    key: "dawn", label: "밝기 5", dark: true,
    bg: "#444B59", surface: "#4E5666", border: "#5C6476",
    t1: "#F2F4F8", t2: "#C3CAD8", t3: "#939CAE",
  },
  {
    key: "moon", label: "밝기 6", dark: true,
    bg: "#363C49", surface: "#404755", border: "#4E5666",
    t1: "#EFF1F7", t2: "#B8C0D0", t3: "#8A93A6",
  },
  {
    key: "dusk", label: "밝기 7", dark: true,
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

  /* 화면 위아래의 시스템 자리도 바탕빛을 따라가게 한다.
     index.html에 흰빛 하나가 박혀 있고 한 번도 바뀌지 않아, 어두운 벌을 써도
     위가 흰 띠로 남았다. 띄워 쓸 때는 위의 상태 표시줄이 이 값을 그대로
     쓰고, 아래 이동 막대는 바닥의 바탕빛을 보고 맞춰 칠한다 — html과 body가
     이미 --color-bg를 깔고 있으므로 이 한 줄이면 위아래가 같이 따라온다.

     칸마다 색은 STEPS가 들고 있다. 여기서 새로 적지 않는다. */
  const 표 = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (표) 표.content = s.bg;
}

/**
 * 시스템을 고른 사람에게는 운영체제가 바뀌는 그 자리에서 따라 바뀌어야 한다.
 * 다시 열 때까지 기다리면 따라가는 것이 아니다.
 */
export function watchSystem(onChange: () => void): void {
  if (typeof window === "undefined" || !window.matchMedia) return;
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", onChange);
}
