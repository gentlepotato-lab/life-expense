/**
 * 빛깔 여섯 벌.
 *
 * 앱의 색은 그동안 네 군데에 흩어져 있었다 — :root 토큰, 씀씀이 그림의 다섯
 * 조각, 구분에 쓰는 열 가지, 첫 화면 그림. 벌째로 갈아 끼우려면 넷을 한자리에
 * 모아 두어야 한다. 여기가 그 한자리다.
 *
 * 색을 새로 쓸 일이 생기면 값을 코드에 박지 말고 여기에 칸을 늘린 뒤 CSS
 * 변수로 꺼내 쓴다. 한 자리라도 박아 두면 그 자리만 안 바뀌어 벌이 깨진다.
 *
 * 구분 열 가지의 열쇠(indigo 등)는 DB에 담기는 이름이라 절대 바꾸지 않는다.
 * 벌마다 달라지는 것은 그 열쇠가 가리키는 색과 화면에 보이는 이름뿐이다.
 * 차례는 backend/app/routers/counterparts.py의 PALETTE와 같아야 한다.
 */

/** DB에 담기는 이름. 차례와 글자 모두 고정이다. */
export const CAT_KEYS = [
  "indigo", "teal", "amber", "rose", "violet",
  "sky", "lime", "orange", "cyan", "slate",
] as const;

export type Tone = {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  success: string;
  successDark: string;
  danger: string;
  dangerDark: string;
  /** 넘길 낌새를 알리는 색. 좋지도 나쁘지도 않은 가운데 자리다. */
  amber: string;
  /** 0원. 들어옴도 나감도 아니라 제3의 빛깔을 준다. */
  zero: string;
  zeroDark: string;
  /** 좋은 쪽 딱지. 옅은 바탕과 그 위에 앉는 글씨 한 벌이다. */
  successTint: string;
  successInk: string;
};

export type Palette = {
  key: string;
  /** 조각과 탭에 보이는 이름 */
  label: string;
  tone: Tone;
  /** 씀씀이의 막대와 도넛과 꺾은선, 다섯 조각 */
  chart: [string, string, string, string, string];
  /** 나머지를 묶은 기타 */
  chartEtc: string;
  /** 요일별 뒤에 깔리는 옅은 색 */
  chartWeek: string;
  /** 구분 열 가지. CAT_KEYS와 차례가 같다. */
  cats: { label: string; solid: string }[];
  /** 첫 화면 그림에 쓰는 세 가지 */
  art: { ink: string; aqua: string; tint: string };
};

export const PALETTES: Palette[] = [
  /* 쪽빛 — 처음부터 써 온 빛깔. 값이 :root에 적힌 것과 한 톨도 다르지 않다. */
  {
    key: "jjok",
    label: "쪽빛",
    tone: {
      primary: "#5B5FEF", primaryDark: "#4548D6", primaryLight: "#E8E9FD",
      success: "#00C7BE", successDark: "#00A89F",
      danger: "#FF5C57", dangerDark: "#E64842", amber: "#F5A524",
      zero: "#C6A4DF", zeroDark: "#9E7DB6",
      successTint: "#E2F7F6", successInk: "#007A73",
    },
    chart: ["#FF7FA8", "#4FB0F5", "#22C97E", "#B47CFF", "#FF8A5C"],
    chartEtc: "#94A3B8",
    chartWeek: "#E3D3FF",
    cats: [
      { label: "남보라", solid: "#5B5FEF" }, { label: "청록", solid: "#00C7BE" },
      { label: "주황", solid: "#FF9500" }, { label: "분홍", solid: "#F2547D" },
      { label: "보라", solid: "#9B5DE5" }, { label: "하늘", solid: "#3BA3F5" },
      { label: "연두", solid: "#5FBF56" }, { label: "귤", solid: "#F2711C" },
      { label: "물빛", solid: "#22B8CF" }, { label: "회색", solid: "#98A2B3" },
    ],
    art: { ink: "#5B5FEF", aqua: "#00C7BE", tint: "#C9CDF6" },
  },

  /* 황토 — 찬 빛을 한 점도 쓰지 않는다. 구운 흙과 마른 이끼와 겨자. */
  {
    key: "hwangto",
    label: "황토",
    tone: {
      primary: "#8C5E3C", primaryDark: "#734B2E", primaryLight: "#F2E8DE",
      success: "#6F9055", successDark: "#5B7845",
      danger: "#C4573C", dangerDark: "#A8452C", amber: "#D9A441",
      zero: "#C2A878", zeroDark: "#9C8355",
      successTint: "#ECF1E7", successInk: "#435A31",
    },
    chart: ["#C4573C", "#6F9055", "#D9A441", "#8C5E3C", "#B8A07A"],
    chartEtc: "#A69C8E",
    chartWeek: "#E7DCC6",
    cats: [
      { label: "흙", solid: "#8C5E3C" }, { label: "이끼", solid: "#6F9055" },
      { label: "겨자", solid: "#D9A441" }, { label: "벽돌", solid: "#C4573C" },
      { label: "고동", solid: "#A8705F" }, { label: "모래", solid: "#B8A07A" },
      { label: "수풀", solid: "#5F7A4E" }, { label: "누룩", solid: "#E0B36B" },
      { label: "잿빛", solid: "#8A7F6B" }, { label: "돌", solid: "#A6A096" },
    ],
    art: { ink: "#8C5E3C", aqua: "#6F9055", tint: "#E0D2BE" },
  },

  /* 먹빛 — 단추를 가라앉히고 빛깔은 숫자에만 준다. 장부는 조용하고 셈만 선다. */
  {
    key: "meok",
    label: "먹빛",
    tone: {
      primary: "#3F4E63", primaryDark: "#2F3C4E", primaryLight: "#E4E8EE",
      success: "#3E9E82", successDark: "#31846C",
      danger: "#E0653F", dangerDark: "#C5502C", amber: "#E0A93F",
      zero: "#A8617E", zeroDark: "#8A4D66",
      successTint: "#E3F2EE", successInk: "#24614F",
    },
    chart: ["#E0653F", "#3E9E82", "#E0A93F", "#5B7FA8", "#A8617E"],
    chartEtc: "#8D95A3",
    chartWeek: "#DCE2EA",
    cats: [
      { label: "먹", solid: "#3F4E63" }, { label: "비취", solid: "#3E9E82" },
      { label: "주홍", solid: "#E0653F" }, { label: "치자", solid: "#E0A93F" },
      { label: "자두", solid: "#A8617E" }, { label: "쪽", solid: "#5B7FA8" },
      { label: "풀", solid: "#6FA85B" }, { label: "황토", solid: "#C97B3F" },
      { label: "옥", solid: "#4F9E9E" }, { label: "재", solid: "#8D95A3" },
    ],
    art: { ink: "#3F4E63", aqua: "#3E9E82", tint: "#CFD6E0" },
  },

  /* 숯빛 — 단추를 거의 무채색까지 떨어뜨리고 숫자만 채도를 끝까지 올린다. */
  {
    key: "sut",
    label: "숯빛",
    tone: {
      primary: "#2F3033", primaryDark: "#1C1D1F", primaryLight: "#E8E9EA",
      success: "#5FAE2E", successDark: "#4C8F24",
      danger: "#FF6B35", dangerDark: "#E2531F", amber: "#FFB020",
      zero: "#7B61FF", zeroDark: "#5F48D4",
      successTint: "#ECF5E4", successInk: "#3A6B1B",
    },
    chart: ["#FF6B35", "#5FAE2E", "#FFB020", "#2F3033", "#00A3A3"],
    chartEtc: "#9BA0A6",
    chartWeek: "#DDE0E3",
    cats: [
      { label: "숯", solid: "#2F3033" }, { label: "라임", solid: "#5FAE2E" },
      { label: "감귤", solid: "#FF6B35" }, { label: "살구", solid: "#FFB020" },
      { label: "청록", solid: "#00A3A3" }, { label: "자홍", solid: "#E0417A" },
      { label: "보라", solid: "#7B61FF" }, { label: "밤", solid: "#C7511A" },
      { label: "침엽", solid: "#0E8F6E" }, { label: "재", solid: "#9BA0A6" },
    ],
    art: { ink: "#2F3033", aqua: "#5FAE2E", tint: "#CFD2D5" },
  },

  /* 포도 — 붉은 기 도는 보라라 쪽빛의 남보라와는 결이 다르다. */
  {
    key: "podo",
    label: "포도",
    tone: {
      primary: "#6B3F5E", primaryDark: "#55304A", primaryLight: "#F0E6ED",
      success: "#8CA83F", successDark: "#728A31",
      danger: "#C2344D", dangerDark: "#A32439", amber: "#E08B3F",
      zero: "#5E8C8C", zeroDark: "#497070",
      successTint: "#F0F3E3", successInk: "#566627",
    },
    chart: ["#C2344D", "#8CA83F", "#E08B3F", "#6B3F5E", "#5E8C8C"],
    chartEtc: "#A79BA3",
    chartWeek: "#E6DCE3",
    cats: [
      { label: "포도", solid: "#6B3F5E" }, { label: "배", solid: "#8CA83F" },
      { label: "살구", solid: "#E08B3F" }, { label: "석류", solid: "#C2344D" },
      { label: "쑥", solid: "#5E8C8C" }, { label: "자목련", solid: "#A8628C" },
      { label: "솔", solid: "#4F7A3F" }, { label: "모과", solid: "#D0A24A" },
      { label: "밤", solid: "#8A5B3F" }, { label: "재", solid: "#A79BA3" },
    ],
    art: { ink: "#6B3F5E", aqua: "#8CA83F", tint: "#DCC9D6" },
  },

  /* 크레용 — 섞지 않은 원색만 쓴다. 채도를 낮추지 않아 화면이 쨍하다. */
  {
    key: "crayon",
    label: "크레용",
    tone: {
      primary: "#1E5FD8", primaryDark: "#1549AF", primaryLight: "#E1EAFB",
      success: "#00A84F", successDark: "#008C41",
      danger: "#E8261A", dangerDark: "#C51A10", amber: "#FFC400",
      zero: "#8A2BE2", zeroDark: "#6D1FB5",
      successTint: "#E0F4E8", successInk: "#006B32",
    },
    chart: ["#E8261A", "#1E5FD8", "#FFC400", "#00A84F", "#8A2BE2"],
    chartEtc: "#8E939B",
    chartWeek: "#D8DEE8",
    cats: [
      { label: "파랑", solid: "#1E5FD8" }, { label: "빨강", solid: "#E8261A" },
      { label: "노랑", solid: "#FFC400" }, { label: "초록", solid: "#00A84F" },
      { label: "보라", solid: "#8A2BE2" }, { label: "주황", solid: "#FF7A00" },
      { label: "하늘", solid: "#00B8D4" }, { label: "분홍", solid: "#E0007A" },
      { label: "갈색", solid: "#6B4E1E" }, { label: "회색", solid: "#8E939B" },
    ],
    art: { ink: "#1E5FD8", aqua: "#00A84F", tint: "#BDD0F2" },
  },
];

/** 고르지 않았을 때 쓰는 것 — 처음부터 써 온 쪽빛이다. */
export const DEFAULT_PALETTE = "jjok";

const BY_KEY = new Map(PALETTES.map((p) => [p.key, p]));

export function paletteOf(key: string | null | undefined): Palette {
  return (key && BY_KEY.get(key)) || PALETTES[0];
}

/* 지금 쓰는 벌. 갈아 끼우는 일은 앱이 뜰 때 한 번뿐이라(테이프와 같은 약속)
   화면들은 이 값을 불러 쓰기만 하면 된다. */
let 쓰는것: Palette = PALETTES[0];

export const currentPalette = (): Palette => 쓰는것;

/**
 * 화면 전체에 벌을 끼운다.
 *
 * 값은 CSS 변수로 내보낸다. 그래야 스타일시트도, 그림 속성도, 화면 코드도
 * 같은 한 곳을 보게 된다.
 */
export function applyPalette(key: string): void {
  const p = paletteOf(key);
  쓰는것 = p;
  /* 어느 벌이 끼워졌는지 겉에 적어 둔다. 예시 그림을 찍는 스크립트가 이것을
     보고 제 벌로 떴는지 확인한다. 조용히 옛 색으로 찍히는 것이 제일 나쁘다. */
  document.documentElement.dataset.palette = p.key;
  const s = document.documentElement.style;
  const t = p.tone;
  s.setProperty("--color-primary", t.primary);
  s.setProperty("--color-primary-dark", t.primaryDark);
  s.setProperty("--color-primary-light", t.primaryLight);
  s.setProperty("--color-success", t.success);
  s.setProperty("--color-success-dark", t.successDark);
  s.setProperty("--color-danger", t.danger);
  s.setProperty("--color-danger-dark", t.dangerDark);
  s.setProperty("--color-amber", t.amber);
  s.setProperty("--color-zero", t.zero);
  s.setProperty("--color-zero-dark", t.zeroDark);
  s.setProperty("--color-success-tint", t.successTint);
  s.setProperty("--color-success-ink", t.successInk);
  p.chart.forEach((c, i) => s.setProperty(`--chart-${i + 1}`, c));
  s.setProperty("--chart-etc", p.chartEtc);
  s.setProperty("--chart-week", p.chartWeek);
  p.cats.forEach((c, i) => s.setProperty(`--cat-${i + 1}`, c.solid));
  s.setProperty("--art-ink", p.art.ink);
  s.setProperty("--art-aqua", p.art.aqua);
  s.setProperty("--art-tint", p.art.tint);
}
