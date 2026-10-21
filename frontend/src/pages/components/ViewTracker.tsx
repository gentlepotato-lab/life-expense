import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { 화면적기 } from "../../utils/track";

/**
 * 어느 화면에 들어갔는지 적는다.
 *
 * 아무것도 그리지 않는다. 라우터 안에 한 번만 서서 경로가 바뀔 때마다
 * 한 줄 적는다. 적는 일은 모였다가 나중에 한 번에 나가므로, 화면을
 * 옮길 때마다 요청이 나가지는 않는다(utils/track.ts).
 *
 * 같은 경로로 다시 들어온 것도 센다. "몇 번 드나들었나"가 물음이지
 * "몇 가지 화면을 보았나"가 아니기 때문이다.
 *
 * 관리자 쪽은 건너뛴다. 거기는 주소 하나(/admin) 아래에서 알약으로 자리를
 * 옮기므로, 여기서 적으면 다섯 자리가 모두 /admin 한 줄로 뭉친다. 제가
 * 자리마다 적는다(pages/Admin.tsx).
 */
export default function ViewTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname === "/admin" || pathname.startsWith("/admin/")) return;
    화면적기(pathname);
  }, [pathname]);

  return null;
}
