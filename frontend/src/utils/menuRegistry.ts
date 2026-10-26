/**
 * 끌 수 있는 메뉴의 등록부.
 *
 * 관리자 페이지에서 메뉴를 끄고 켜려면 "무엇을 끌 수 있는지"를 어딘가 한
 * 곳에 적어야 한다. 그 한 곳이 여기다. 여기 한 줄 더하면 관리자 페이지에
 * 저절로 스위치가 하나 늘어난다.
 *
 * 서버는 **꺼진 열쇠만** 든다(prefs_site의 menu_off). 켜진 것을 적지 않는
 * 까닭은, 새 기능을 더했을 때 목록에 없다고 꺼져 버리면 안 되기 때문이다.
 * 아무것도 적혀 있지 않으면 전부 켜짐이고, 그것이 지금 화면과 같은 상태다.
 *
 * 끄면 세 가지가 함께 일어나야 한다.
 *   ① 메뉴 목록에서 빠진다(MenuList가 쓰는 경로 배열).
 *   ② 주소로 직접 들어오면 홈으로 보낸다(라우터 문지기).
 *   ③ 그 화면을 가리키는 다른 자리도 함께 거둔다(아래 곁길).
 *
 * ③을 빠뜨리면 끈 화면으로 가는 죽은 단추가 남는다. 눌러도 홈으로 튕기니
 * 고장으로 보인다. 그래서 등록부가 경로만이 아니라 곁길까지 든다.
 */

/** 끌 수 있는 메뉴 한 줄. */
export type MenuEntry = {
  /** 서버에 적히는 열쇠. 경로에서 슬래시를 뗀 꼴로 짓는다. */
  key: string;
  /** 그 메뉴가 여는 화면의 경로. */
  path: string;
  /** 어느 탭에 속한 메뉴인지. 관리자 페이지가 묶어서 보여 준다. */
  group: "내역" | "설정";
  /**
   * 그 화면을 가리키는 다른 자리.
   *
   * 메뉴 말고도 거기로 가는 길이 있으면 적는다. 끄면 이 자리들도 함께
   * 거둔다. 지금은 없지만 화면을 더하면서 생긴다.
   */
  sidePaths?: string[];
};

/**
 * 끌 수 있는 메뉴.
 *
 * 홈 탭과 아래 이동 막대는 넣지 않는다. 홈과 내역과 설정 셋뿐이라 하나만
 * 꺼도 앱이 꽤 이상해지고, 쓰기와 돈쓴이는 앱이 돌아가는 데 필요하다.
 * 끌 수 있는 것은 내역 탭과 설정 탭 안의 아홉이다.
 */
export const MENU_REGISTRY: MenuEntry[] = [
  { key: "entries", path: "/entries", group: "내역" },
  { key: "entries-pending", path: "/entries-pending", group: "내역" },
  { key: "entries-scheduled", path: "/entries-scheduled", group: "내역" },
  { key: "calendar", path: "/calendar", group: "내역", sidePaths: ["/calendar/detail"] },
  { key: "entries-groups", path: "/entries-groups", group: "내역" },
  { key: "categories", path: "/categories", group: "설정" },
  { key: "payment-methods", path: "/payment-methods", group: "설정" },
  { key: "counterparts", path: "/counterparts", group: "설정" },
  { key: "goals", path: "/goals", group: "설정" },
];

/** 경로로 등록부 한 줄을 찾는다. 등록부에 없는 화면은 끌 수 없다. */
export function 등록된것(path: string): MenuEntry | undefined {
  return MENU_REGISTRY.find((m) => m.path === path || (m.sidePaths ?? []).includes(path));
}

/**
 * 꺼진 열쇠 목록.
 *
 * 앱이 뜰 때 한 번 받아 이 모듈에 얹는다. 화면마다 따로 받으면 메뉴를
 * 그릴 때마다 요청이 나간다. 받기 전에는 빈 목록이라 전부 켜진 것으로
 * 보이고, 그것이 지금 화면과 같은 상태다.
 */
let 꺼진것: Set<string> = new Set();
const 듣는이 = new Set<() => void>();

/** 받아 온 목록을 얹는다. 앱이 뜰 때 한 번 부른다. */
export function putMenuOff(keys: string[]): void {
  꺼진것 = new Set(keys);
  듣는이.forEach((f) => f());
}

/** 목록이 바뀌면 알린다. 그려진 메뉴를 다시 그리게 한다. */
export function onMenuOff(f: () => void): () => void {
  듣는이.add(f);
  return () => {
    듣는이.delete(f);
  };
}

/** 이 경로가 꺼져 있는지. 등록부에 없으면 늘 켜진 것으로 본다. */
export function isMenuOff(path: string): boolean {
  const 줄 = 등록된것(path);
  return !!줄 && 꺼진것.has(줄.key);
}

/**
 * 꺼진 경로를 걸러 낸다.
 *
 * 목록이 비어 있으면 받은 배열을 그대로 돌려준다. 새 배열을 만들지 않아야
 * 메뉴를 쥔 쪽이 공연히 다시 그리지 않는다.
 */
export function keepOn(paths: string[]): string[] {
  if (꺼진것.size === 0) return paths;
  return paths.filter((p) => !isMenuOff(p));
}
