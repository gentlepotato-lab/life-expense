/**
 * 관리자 사이트의 탭과 페이지 등록부.
 *
 * 사용자 사이트가 화면 이름과 안내 한 줄을 한 곳에서 쥐듯(utils/pageTitles.ts),
 * 관리자 쪽도 여기 한 곳에서 쥔다. 전에는 자리 목록이 pages/Admin.tsx 안에만
 * 있어서, 대시보드의 화면별 조회 수가 같은 목록을 따로 적고 있었다. 자리를
 * 하나 늘리면 두 곳을 함께 고쳐야 했다.
 *
 * 탭은 넷이고 탭마다 첫 쪽이 있다. 첫 쪽은 사용자 사이트의 내역 탭과 설정
 * 탭처럼 들어갈 페이지를 칸으로 늘어놓는 자리다. 메인 탭(사용)만 홈처럼
 * 생겼고, 서비스 이름이 제목 자리에 서는 것도 거기뿐이다.
 */

/** 탭 안의 페이지 하나. */
export type 관리자쪽 = {
  path: string;
  /** 쪽 이름. 갈래 알약과 제목과 액션 기록이 함께 쓴다. */
  name: string;
  /** 제목 밑 한 줄. 사용자 사이트의 PAGE_NOTE와 같은 자리, 같은 꼴이다. */
  note: string;
  /**
   * 탭 첫 쪽의 칸에 적는 한 줄.
   *
   * 나열이면 딱지로 늘어놓는다. 가운뎃점으로 이으면 어디까지가 한 덩어리인지
   * 눈에 잡히지 않는다(pages/components/MenuList.tsx).
   */
  desc: string | string[];
  /**
   * 갈래 알약에 자기 자리가 없는 곁가지라면 그 어미 쪽의 길.
   *
   * 알약은 어미를 켠 것으로 두고 머리말 높이도 그대로 둔다. 그래야 오갈 때
   * 아래 내용이 튀지 않는다. 사용자 사이트의 PARENT와 같은 잣대다
   * (pages/components/PageHead.tsx).
   */
  under?: string;
};

/** 바닥 막대의 칸 하나. */
export type 관리자탭 = {
  key: string;
  /** 바닥 막대에 적는 이름. 넷이 가로를 나눠 가지므로 짧게 짓는다. */
  name: string;
  /** 탭 첫 쪽의 길. */
  path: string;
  /**
   * 탭 첫 쪽의 제목.
   *
   * 메인 탭에는 서비스 이름이 선다. 사용자 사이트의 홈에서 「돈을 쓰다」가
   * 제목 자리에 서는 것과 같다.
   */
  title: string;
  /**
   * 제목 옆에 본문 글꼴로 서는 갈래.
   *
   * 음영과 밑줄은 서비스 이름에만 든다. 「돈을 쓰다 관리자」를 통째로
   * 입혔더니 「관리자」까지 멋 부린 글씨가 되어 이름인지 갈래인지 흐려졌다.
   */
  kind?: string;
  note: string;
  pages: 관리자쪽[];
};

export const ADMIN_TABS: 관리자탭[] = [
  {
    key: "use",
    name: "사용",
    path: "/admin",
    title: "돈을 쓰다",
    kind: "관리자",
    note: "자주 쓰는 화면을 모았습니다.",
    pages: [
      {
        path: "/admin/dash",
        name: "대시보드",
        note: "조회 수와 사용 횟수를 확인합니다.",
        desc: "조회 수와 사용 횟수",
      },
      {
        path: "/admin/logs",
        name: "액션 기록",
        note: "쌓인 기록을 한 줄씩 확인합니다. 줄을 꾹 누르면 그 이름의 기록만 모아 봅니다.",
        desc: "한 줄씩 쌓인 기록",
      },
      {
        path: "/admin/users",
        name: "사용자",
        note: "사용자와 권한을 관리합니다.",
        desc: ["사용자", "권한"],
      },
    ],
  },
  {
    key: "screen",
    name: "화면",
    path: "/admin/screen",
    title: "화면",
    note: "사용자 사이트에 뜨는 것을 관리합니다.",
    pages: [
      {
        path: "/admin/notice",
        name: "공지",
        note: "사용자에게 띄울 공지를 관리합니다.",
        desc: "사용자에게 띄울 공지",
      },
      {
        path: "/admin/doodle",
        name: "문구",
        note: "쪽지에 뜨는 모양과 문구를 관리합니다.",
        desc: ["모양", "문구"],
      },
      {
        path: "/admin/menu",
        name: "메뉴",
        note: "사용자 사이트에 뜨는 메뉴를 관리합니다.",
        desc: "사용자 사이트에 뜨는 메뉴",
      },
    ],
  },
  {
    key: "server",
    name: "서버",
    path: "/admin/server",
    title: "서버",
    note: "정기적으로 도는 작업과 바깥 요청을 관리합니다.",
    pages: [
      {
        path: "/admin/batch",
        name: "배치",
        note: "정기적으로 반복되는 작업과 시간을 관리합니다.",
        desc: "정기적으로 반복되는 작업",
      },
      {
        path: "/admin/api",
        name: "외부 API",
        note: "외부에 보내는 API 요청의 상태를 확인합니다. 줄을 꾹 누르면 그 API의 호출 기록만 모아 봅니다. 호출한 기록은 90일까지 남습니다.",
        desc: ["공휴일", "지도"],
      },
      {
        path: "/admin/db",
        name: "DB",
        note: "쌓인 데이터와 서버 정보를 확인합니다. 줄을 꾹 누르면 그 표를 따로 봅니다.",
        desc: "쌓인 데이터와 서버 정보",
      },
    ],
  },
  {
    key: "account",
    name: "계정",
    path: "/admin/account",
    title: "계정",
    note: "관리자 계정을 관리합니다.",
    pages: [
      {
        path: "/admin/pw",
        name: "비밀번호",
        note: "관리자 비밀번호를 바꿉니다.",
        desc: "관리자 비밀번호",
      },
      {
        path: "/admin/login-log",
        name: "로그인 기록",
        note: "로그인한 기기와 시간을 확인합니다.",
        desc: "로그인한 기기와 시간",
      },
    ],
  },
];

/**
 * 갈래 알약에 서지 않는 곁가지 쪽들.
 *
 * 탭의 pages에 넣으면 알약이 하나 더 늘어, 카드에서만 들어가는 자리가
 * 늘 떠 있게 된다. 사용자 사이트도 씀씀이 내역과 기간 내역을 알약에 두지
 * 않는다(utils/pageTitles.ts).
 */
const 곁가지: 관리자쪽[] = [
  {
    path: "/admin/batch-runs",
    name: "배치 이력",
    note: "작업이 실행된 기록을 한 줄씩 확인합니다. 실행 기록은 90일까지 남고, 최근 200줄까지 보입니다.",
    desc: "작업이 실행된 기록",
    under: "/admin/batch",
  },
  {
    path: "/admin/log-detail",
    name: "액션 상세",
    note: "선택한 이름의 기록을 한 줄씩 확인합니다.",
    desc: "선택한 이름의 기록",
    under: "/admin/logs",
  },
  {
    path: "/admin/notice-detail",
    name: "공지 상세",
    note: "선택한 공지의 내용과 기간을 확인합니다.",
    desc: "선택한 공지의 내용과 기간",
    under: "/admin/notice",
  },
  {
    path: "/admin/api-detail",
    name: "호출 기록",
    note: "선택한 API를 호출한 기록을 확인합니다.",
    desc: "선택한 API를 호출한 기록",
    under: "/admin/api",
  },
  {
    path: "/admin/db-detail",
    name: "표 상세",
    note: "선택한 화면이 쓰는 표를 확인합니다.",
    desc: "선택한 화면이 쓰는 표",
    under: "/admin/db",
  },
];

/** 길로 탭을 찾는다. 탭 첫 쪽이든 그 안의 페이지든 그 탭을 돌려준다. */
export function 탭찾기(pathname: string): 관리자탭 | undefined {
  /* 곁가지는 제 어미가 선 탭에 든다. */
  const 길 = 쪽찾기(pathname)?.under ?? pathname;
  return ADMIN_TABS.find(
    (t) => t.path === 길 || t.pages.some((p) => p.path === 길)
  );
}

/** 길로 페이지를 찾는다. 탭 첫 쪽은 페이지가 아니므로 없다. */
export function 쪽찾기(pathname: string): 관리자쪽 | undefined {
  for (const t of ADMIN_TABS) {
    const 찾은것 = t.pages.find((p) => p.path === pathname);
    if (찾은것) return 찾은것;
  }
  return 곁가지.find((p) => p.path === pathname);
}

/** 그 길의 이름. 대시보드의 화면별 조회 수가 딱지에 쓴다. */
export function 관리자쪽이름(pathname: string): string | undefined {
  const 탭 = ADMIN_TABS.find((t) => t.path === pathname);
  if (탭) return 탭.name;
  return 쪽찾기(pathname)?.name;
}
