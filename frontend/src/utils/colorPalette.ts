/**
 * 구분에 쓰는 색 팔레트.
 *
 * DB에는 헥사값이 아니라 여기 적힌 토큰 이름('indigo' 등)만 담는다.
 * 나중에 색감을 손볼 때 화면만 고치면 되고 DB는 건드릴 필요가 없다.
 *
 * 순서는 backend/app/routers/counterparts.py의 PALETTE와 같아야 한다.
 * 구분을 새로 만들 때 서버가 이 순서대로 아직 안 쓰인 색을 골라 준다.
 *
 * 이름이 가리키는 색과 화면에 보이는 이름은 고른 빛깔 벌을 따른다. 값은
 * utils/palettes.ts 한 곳에만 적는다. 여기서는 부를 때마다 그쪽을 다시
 * 읽는다 — 모듈이 읽히는 차례에 기대면 벌이 늦게 끼워졌을 때 옛 색이
 * 굳은 채로 남는다.
 */
import { CAT_KEYS, currentPalette } from "./palettes";

export type ColorToken = {
  key: string;
  label: string;
  /** 아바타처럼 꽉 찬 배경에 쓰는 색 */
  solid: string;
};

/** 고르개에 늘어놓을 열 가지 */
export const colorTokens = (): ColorToken[] => {
  const cats = currentPalette().cats;
  return CAT_KEYS.map((key, i) => ({ key, label: cats[i].label, solid: cats[i].solid }));
};

/** 토큰 이름 → 색. 모르는 이름이면 회색으로 떨어진다. */
export const colorOf = (key: string | null | undefined): string => {
  const cats = currentPalette().cats;
  const i = key ? CAT_KEYS.indexOf(key as (typeof CAT_KEYS)[number]) : -1;
  return i >= 0 ? cats[i].solid : cats[9].solid;
};
