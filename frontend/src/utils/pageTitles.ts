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
  "/places": "어디 쓰나",
  "/charts": "씀씀이",
  /* 씀씀이에 딸린 곁가지. 홈 묶음에 넣지 않는다 — HOME_TABS는 돈쓴이의
     첫 화면 고르개가 늘어놓는 목록이기도 해서, 곁가지가 섞이면 첫 화면으로
     고를 수 있는 것처럼 보인다. */
  "/charts/detail": "씀씀이 내역",
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

/**
 * 제목 밑에 서는 한 줄 — 이 화면이 무엇을 하는 곳인지.
 *
 * 모든 화면이 갖는다. 갈래 탭이 있는 화면에서는 제목과 탭 사이에 끼어
 * 선다 — 제목이 무엇인지 말하고, 한 줄이 풀어 주고, 탭이 갈래를 늘어놓는
 * 차례다. 그래서 갈래가 있고 없고로 빠지는 화면이 없다.
 *
 * 중괄호로 감싼 말은 다른 화면의 이름이다. 가리키는 곳이 한눈에 잡히도록
 * 조금 짙게 선다.
 *
 * 한 줄로 끝나야 한다 — 두 줄이 되면 그 화면만 머리말이 깊어져, 같은 탭
 * 안에서 갈래를 옮길 때 아래 내용이 들썩인다. 가장 좁은 360px에서 쓸 수
 * 있는 폭은 329px다.
 */
export const PAGE_NOTE: Record<string, string> = {
  "/": "자주 쓰는 화면을 모았습니다.",

  /* 홈에 딸린 화면들 */
  "/write": "지출과 수입을 기록합니다.",
  "/me": "내 정보와 화면 설정을 관리합니다.",
  "/places": "장소와 가게를 관리합니다.",
  "/charts": "지출 추이와 분석을 확인합니다.",
  "/charts/detail": "선택한 분류의 지출 내역을 확인합니다.",
  "/nudges": "알림과 추천을 확인합니다.",

  /* 내역 탭 */
  "/history": "기록한 지출과 수입을 확인합니다.",
  "/entries": "기록을 마친 지출과 수입을 확인합니다.",
  "/pending-entries": "확정 전에 검수하는 항목을 관리합니다.",
  "/scheduled-entries": "정기적으로 반복되는 지출을 관리합니다.",
  "/calendar": "한 달을 한눈에 확인합니다.",
  "/calendar/detail": "선택한 기간의 지출과 수입을 확인합니다.",

  /* 설정 탭 */
  /* 설정 첫 화면에만 둘째 문장이 붙는다. 여기에 없는 설정이 어디 있는지를
     모르면 돈쓴이까지 찾아갈 길이 없다. */
  "/settings": "지출에 사용하는 항목을 관리합니다. 화면 설정은 {돈쓴이}에 있습니다.",
  "/categories": "중분류, 소분류, 세분류를 관리합니다.",
  "/payment-methods": "카드, 계좌, 간편결제를 관리합니다.",
  "/counterparts": "금액을 나눠 낸 사람을 관리합니다.",
  "/goals": "분류마다 이 달의 목표를 정합니다.",
};

/**
 * 홈 탭이 품는 화면들 — 홈 자신과 거기서 들어가는 것들.
 *
 * 아래 이동 막대가 "지금 홈에 있다"고 볼 자리이자, 돈쓴이의 첫 화면 고르개가
 * 늘어놓을 목록이다. 두 곳이 따로 들고 있으면 화면을 하나 더할 때 한쪽만
 * 고치게 된다.
 */
export const HOME_TABS = [
  "/",
  "/write",
  "/me",
  "/places",
  "/charts",
  "/nudges",
];

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
