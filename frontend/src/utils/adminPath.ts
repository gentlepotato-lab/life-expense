/**
 * 관리자 화면의 길인가.
 *
 * 관리자 자리는 /admin 아래로 쪼개져 있다(/admin/dash 등, App.tsx).
 * 사용자 화면의 부품 가운데 "관리자 쪽에서는 서지 않는" 것들이 이 잣대를
 * 함께 쓴다 — 바닥 탭(TabBar)과 쪽 머리말(PageHead)이다.
 *
 * 여기 한 곳에 둔 까닭은 저마다 `pathname === "/admin"`으로 적었다가
 * 자리를 길로 쪼갰을 때 한꺼번에 어긋났기 때문이다. 관리자 화면에 사용자
 * 바닥 탭이 떠서 마지막 카드를 덮었다.
 *
 * ViewTracker는 이 잣대를 쓰지 않는다. 거기는 /admin 하나만 건너뛰고
 * 자리들은 적어야 해서 재는 것이 다르다.
 */
export function 관리자길(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}
