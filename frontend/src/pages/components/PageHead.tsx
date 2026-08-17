import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PAGE_TITLE, ENTRY_TABS, SETTING_TABS } from "../../utils/pageTitles";

/**
 * 모든 화면의 머리말.
 *
 * 제목은 왼쪽 위에 둔다. 웹 앱으로 띄우는 만큼 탭 제목(document.title)도
 * 같은 이름으로 맞춰 준다 — "쓴 내역 · 돈을 쓰다" 처럼.
 */
function subTabsFor(pathname: string): string[] | null {
  if (ENTRY_TABS.includes(pathname)) return ENTRY_TABS;
  if (SETTING_TABS.includes(pathname)) return SETTING_TABS;
  return null;
}

export default function PageHead({ right }: { right?: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const title = PAGE_TITLE[pathname] ?? "돈을 쓰다";
  const subs = subTabsFor(pathname);

  useEffect(() => {
    document.title = pathname === "/" ? "돈을 쓰다" : `${title} · 돈을 쓰다`;
  }, [pathname, title]);

  return (
    <header className="page-head">
      <div className="page-head__row">
        <h1 className="page-title">{title}</h1>
        {right && <div className="page-head__right">{right}</div>}
      </div>

      {subs && (
        <div className="subtabs" role="tablist">
          {subs.map((to) => (
            <button
              key={to}
              type="button"
              role="tab"
              aria-selected={to === pathname}
              className={`subtabs__item${to === pathname ? " on" : ""}`}
              onClick={() => to !== pathname && navigate(to)}
            >
              {PAGE_TITLE[to]}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
