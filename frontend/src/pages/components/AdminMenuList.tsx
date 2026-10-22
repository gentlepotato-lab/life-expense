import { useNavigate } from "react-router-dom";
import type { 관리자쪽 } from "../../utils/adminTabs";
import { ADMIN_ICON } from "./AdminIcons";

/**
 * 탭 첫 쪽에서 페이지로 들어가는 목록.
 *
 * 사용자 사이트의 내역 탭과 설정 탭 첫 쪽이 쓰는 그 칸, 그 클래스를 그대로
 * 쓴다(MenuList.tsx). 이름이 왼쪽 위, 한 줄 설명이 그 아래, 그림이 오른쪽
 * 끝이다. 탭이 달라도 들어가는 방식이 같아야 손이 헷갈리지 않는다.
 *
 * 설명이 한 문장이 아니라 몇 가지를 늘어놓는 것이면 딱지로 준다.
 */
export default function AdminMenuList({ pages }: { pages: 관리자쪽[] }) {
  const navigate = useNavigate();

  return (
    <div className="menu-list">
      {pages.map((p) => (
        <button
          key={p.path}
          type="button"
          className="home-card home-card--wide menu-card"
          onClick={() => navigate(p.path)}
        >
          <span className="home-card__text">
            <span className="home-card__title">{p.name}</span>
            {Array.isArray(p.desc) ? (
              <span className="home-card__desc tag-row">
                {p.desc.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </span>
            ) : (
              <span className="home-card__desc">{p.desc}</span>
            )}
          </span>
          <span className="menu-card__icon">{ADMIN_ICON[p.path]}</span>
        </button>
      ))}
    </div>
  );
}
