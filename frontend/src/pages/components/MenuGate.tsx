import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isMenuOff, onMenuOff } from "../../utils/menuRegistry";

/**
 * 꺼 놓은 메뉴의 화면을 막는 문지기.
 *
 * 메뉴 목록에서 빼는 것만으로는 모자라다. 주소를 아는 사람은 그대로
 * 들어오고, 앞서 고른 첫 화면이 그 화면일 수도 있다.
 *
 * 아무것도 그리지 않는다. 라우터 안에 한 번만 서서 지금 경로를 보고,
 * 꺼진 것이면 홈으로 보낸다.
 *
 * 꺼진 목록은 앱이 뜬 뒤에 도착하므로, 도착할 때 다시 본다. 그때 이미 그
 * 화면에 서 있으면 그 자리에서 홈으로 보낸다.
 */
export default function MenuGate() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const 보기 = () => {
      if (isMenuOff(pathname)) navigate("/", { replace: true });
    };
    보기();
    return onMenuOff(보기);
  }, [pathname, navigate]);

  return null;
}
