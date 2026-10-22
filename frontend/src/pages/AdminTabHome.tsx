import { useLocation } from "react-router-dom";
import { 탭찾기 } from "../utils/adminTabs";
import AdminMenuList from "./components/AdminMenuList";

/**
 * 탭의 첫 쪽. 화면과 서버와 계정 셋이 함께 쓴다.
 *
 * 사용자 사이트의 내역 탭과 설정 탭 첫 쪽과 같다(pages/History.tsx). 그
 * 탭이 품는 페이지를 칸으로 늘어놓기만 한다. 제목과 안내 한 줄은 틀이
 * 그린다(pages/components/AdminPageHead.tsx).
 *
 * 셋이 하는 일이 같아 조각 하나로 둔다. 어느 탭인지는 길로 가른다.
 * 메인 탭(사용)은 홈처럼 생겨 따로 있다(pages/AdminMain.tsx).
 */
export default function AdminTabHome() {
  const { pathname } = useLocation();
  const 탭 = 탭찾기(pathname);
  if (!탭) return null;
  return <AdminMenuList pages={탭.pages} />;
}
