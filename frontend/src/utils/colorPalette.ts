/**
 * 구분에 쓰는 색 팔레트.
 *
 * DB 에는 헥사값이 아니라 여기 적힌 토큰 이름('indigo' 등)만 담는다.
 * 나중에 색감을 손볼 때 화면만 고치면 되고 DB 는 건드릴 필요가 없다.
 *
 * 순서는 backend/app/routers/counterparts.py 의 PALETTE 와 같아야 한다.
 * 구분을 새로 만들 때 서버가 이 순서대로 아직 안 쓰인 색을 골라 준다.
 */
export type ColorToken = {
  key: string;
  label: string;
  /** 아바타처럼 꽉 찬 배경에 쓰는 색 */
  solid: string;
};

export const COLOR_TOKENS: ColorToken[] = [
  { key: "indigo", label: "남보라", solid: "#5B5FEF" },
  { key: "teal", label: "청록", solid: "#00C7BE" },
  { key: "amber", label: "주황", solid: "#FF9500" },
  { key: "rose", label: "분홍", solid: "#F2547D" },
  { key: "violet", label: "보라", solid: "#9B5DE5" },
  { key: "sky", label: "하늘", solid: "#3BA3F5" },
  { key: "lime", label: "연두", solid: "#5FBF56" },
  { key: "orange", label: "귤", solid: "#F2711C" },
  { key: "cyan", label: "물빛", solid: "#22B8CF" },
  { key: "slate", label: "회색", solid: "#98A2B3" },
];

const BY_KEY = new Map(COLOR_TOKENS.map((t) => [t.key, t]));

/** 토큰 이름 → 색. 모르는 이름이면 회색으로 떨어진다 */
export const colorOf = (key: string | null | undefined): string =>
  (key && BY_KEY.get(key)?.solid) || "#98A2B3";
