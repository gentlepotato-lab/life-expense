import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PAGE_TITLE, ENTRY_TABS, SETTING_TABS } from "../../utils/pageTitles";

/**
 * 모든 화면의 머리말.
 *
 * App 이 화면 바깥에서 한 번만 그린다. 페이지 안에서 각자 그리면 화면을 옮길
 * 때마다 새로 만들어져서, 갈래 탭의 알약이 미끄러질 과거가 없어진다.
 * 여기 한 자리에 남아 있으므로 옮겨 다녀도 같은 알약이 자리만 옮긴다.
 *
 * 제목은 왼쪽 위. 웹 앱으로 띄우는 만큼 브라우저 탭 제목도 같이 맞춘다.
 */
function subTabsFor(pathname: string): string[] | null {
  if (ENTRY_TABS.includes(pathname)) return ENTRY_TABS;
  if (SETTING_TABS.includes(pathname)) return SETTING_TABS;
  return null;
}

export default function PageHead() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const title = PAGE_TITLE[pathname] ?? "돈을 쓰다";
  const subs = subTabsFor(pathname);
  const index = subs ? subs.indexOf(pathname) : -1;

  useEffect(() => {
    document.title = pathname === "/" ? "돈을 쓰다" : `${title} · 돈을 쓰다`;
  }, [pathname, title]);

  return (
    <header className="page-head">
      <div className="page-head__row">
        <h1 className="page-title">{title}</h1>
      </div>

      {subs && (
        <div className="subtabs" role="tablist">
          {/* 켜진 갈래를 덮는 알약 하나. 자리만 옮기므로 미끄러진다 */}
          <span
            className="subtabs__thumb"
            /* 3D 로 적어 두면 어느 기기에서나 합성기가 맡는다 — 본줄기가 막혀도 미끄러진다 */
            style={{ transform: `translate3d(${index * 100}%, 0, 0)` }}
            aria-hidden="true"
          />
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
