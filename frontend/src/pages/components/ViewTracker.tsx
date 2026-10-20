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
 */
export default function ViewTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    화면적기(pathname);
  }, [pathname]);

  return null;
}
