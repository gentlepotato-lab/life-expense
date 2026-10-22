import { useLocation, useNavigate } from "react-router-dom";
import { ADMIN_TABS, 탭찾기 } from "../../utils/adminTabs";

/**
 * 관리자 사이트의 아래 이동 막대.
 *
 * 사용자 사이트의 것과 같은 조각, 같은 클래스를 쓴다(TabBar.tsx). 그림이
 * 위, 이름이 아래에 서고 켜진 칸만 잉크로 선다. 빛깔은 currentColor를 타고
 * 와 이 쪽의 보라를 따르므로 따로 매기지 않는다.
 *
 * 사용자 쪽 막대를 그대로 가져다 쓰지 않고 따로 둔 까닭은 두 가지다. 가는
 * 곳이 다르고, 꺼 놓은 메뉴를 거르는 일이 여기서는 없다.
 *
 * 그림은 24 상자에 1.7 두께로 그린다. 사용자 쪽 막대와 같은 잣대다.
 */

const 선 = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** 탭마다의 그림. 등록부에 그림까지 넣지 않는 것은 거기가 글만 쥐기 때문이다. */
const 탭그림: Record<string, React.ReactNode> = {
  /* 사용. 막대 셋. 조회 수를 세는 자리다. */
  use: (
    <svg viewBox="0 0 24 24" {...선}>
      <path d="M4 19h16" />
      <path d="M7 19v-6M12 19V6M17 19v-9" />
    </svg>
  ),
  /* 화면. 머리말과 본문으로 나뉜 쪽. */
  screen: (
    <svg viewBox="0 0 24 24" {...선}>
      <path d="M4 5h16v14H4z" />
      <path d="M4 9.5h16" />
      <path d="M9 9.5V19" />
    </svg>
  ),
  /* 서버. 쌓아 올린 두 칸. */
  server: (
    <svg viewBox="0 0 24 24" {...선}>
      <path d="M4 5h16v5H4zM4 14h16v5H4z" />
      <path d="M7.5 7.5h.01M7.5 16.5h.01" />
    </svg>
  ),
  /* 계정. 자물쇠. 비밀번호가 사는 자리다. */
  account: (
    <svg viewBox="0 0 24 24" {...선}>
      <path d="M6 10.5h12v9H6z" />
      <path d="M9 10.5V8a3 3 0 0 1 6 0v2.5" />
    </svg>
  ),
};

export default function AdminTabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const 지금탭 = 탭찾기(pathname);

  return (
    <nav className="tabbar" aria-label="주요 화면">
      {ADMIN_TABS.map((t) => {
        const 켜짐 = 지금탭?.key === t.key;
        return (
          <button
            key={t.key}
            type="button"
            className={`tabbar__item${켜짐 ? " on" : ""}`}
            aria-current={켜짐 ? "page" : undefined}
            onClick={() => pathname !== t.path && navigate(t.path)}
          >
            <span className="tabbar__icon">{탭그림[t.key]}</span>
            <span className="tabbar__label">{t.name}</span>
          </button>
        );
      })}
    </nav>
  );
}
