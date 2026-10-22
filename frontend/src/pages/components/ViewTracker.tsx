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
 * 관리자 쪽도 그대로 적는다. 전에는 /admin 하나를 건너뛰었다 — 거기가 첫
 * 자리로 넘겨 주기만 하는 자리였기 때문이다. 이제 /admin은 메인 탭의 첫
 * 쪽이라 제 알맹이가 있어, 건너뛰면 그 탭에 몇 번 들렀는지가 사라진다
 * (utils/adminTabs.ts).
 */
export default function ViewTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    화면적기(pathname);
  }, [pathname]);

  return null;
}
