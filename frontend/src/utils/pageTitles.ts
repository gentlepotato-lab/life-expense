/**
 * 화면 이름표 — 한 곳에서만 정한다.
 *
 * 굳이 우리말로 비틀지 않는다. 이미 굳어진 말(IN/OUT 등)은 그대로 두고,
 * 화면 이름은 짧고 흔한 말로 짓는다.
 */
export const PAGE_TITLE: Record<string, string> = {
  "/": "돈을 쓰다",

  /* 홈에 딸린 화면들 */
  "/write": "쓰기",
  "/me": "돈쓴이",
  "/charts": "씀씀이",
  "/nudges": "잔소리",

  /* 내역 탭 */
  "/history": "내역",
  "/entries": "지출 내역",
  "/pending-entries": "대기 내역",
  "/scheduled-entries": "정기 내역",
  "/calendar": "달력",
  "/calendar/detail": "기간 내역",

  /* 설정 탭 */
  "/settings": "설정",
  "/categories": "분류",
  "/payment-methods": "결제 수단",
  "/counterparts": "함께한 상대",
  "/goals": "안쓴이 도전",
};

/** 내역 탭이 품는 화면들 */
export const ENTRY_TABS = [
  "/entries",
  "/pending-entries",
  "/scheduled-entries",
  "/calendar",
];

/** 설정 탭이 품는 화면들 */
export const SETTING_TABS = [
  "/categories",
  "/payment-methods",
  "/counterparts",
  "/goals",
];
