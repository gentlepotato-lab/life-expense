import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PAGE_TITLE, PAGE_NOTE, ENTRY_TABS, SETTING_TABS } from "../../utils/pageTitles";
import useHeadPin from "../../hooks/useHeadPin";

/**
 * 모든 화면의 머리말.
 *
 * App이 화면 바깥에서 한 번만 그린다. 페이지 안에서 각자 그리면 화면을 옮길
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

/**
 * 갈래 탭에 자기 자리가 없는 곁가지 화면은 어미 화면을 켠 것으로 본다.
 * 그래야 머리말 높이가 그대로라 오갈 때 아래 내용이 튀지 않는다.
 */
const PARENT: Record<string, string> = {
  "/calendar/detail": "/calendar",
};

/**
 * 안내 한 줄을 조각으로 가른다.
 *
 * 중괄호로 감싼 말은 다른 화면의 이름이라 조금 짙게 세운다. 누를 수 있는
 * 것은 아니므로 단추나 링크로 만들지 않는다 — 가리키기만 한다.
 *
 * split에 묶음(괄호)을 쓰면 가른 자리의 알맹이도 함께 끼어 나온다. 짝수
 * 자리가 보통 글, 홀수 자리가 화면 이름이다.
 */
function noteParts(note: string) {
  return note.split(/\{([^}]+)\}/).map((part, i) =>
    i % 2 === 0 ? (
      part
    ) : (
      <em key={i} className="page-note__at">
        {part}
      </em>
    )
  );
}

export default function PageHead() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  /* 머리말과 첫 줄 도구를 위에 붙인다. 굴리는 쪽을 보고 감추거나 드러낸다. */
  useHeadPin();

  const title = PAGE_TITLE[pathname] ?? "돈을 쓰다";
  /* 알약이 어디에 놓일지는 어미 화면으로 따진다. */
  const tabKey = PARENT[pathname] ?? pathname;
  const subs = subTabsFor(tabKey);
  const index = subs ? subs.indexOf(tabKey) : -1;
  /* 갈래 탭이 선 화면에서도 둔다 — 제목과 탭 사이에 끼어 선다. */
  const note = PAGE_NOTE[pathname];

  useEffect(() => {
    document.title = pathname === "/" ? "돈을 쓰다" : `${title} · 돈을 쓰다`;
  }, [pathname, title]);

  return (
    <header className="page-head">
      <div className="page-head__row">
        {/* 글자만 기울이고 네모 바탕은 반듯하게 두려면 한 겹이 더 있어야 한다.
            바깥이 바탕, 안이 기울어진 글자와 형광펜 띠다. */}
        <h1 className="page-title">
          <span className="page-title__in">{title}</span>
        </h1>
      </div>

      {note && <p className="page-note">{noteParts(note)}</p>}

      {subs && (
        <div
          className="subtabs"
          role="tablist"
          /* 갈래 수가 화면마다 다르다(내역 4개 · 설정 3개).
             알약 폭을 여기서 알려 줘야 CSS가 맞춰 자를 수 있다. */
          style={{ "--tab-n": subs.length } as React.CSSProperties}
        >
          {/* 켜진 갈래를 덮는 알약 하나. 자리만 옮기므로 미끄러진다. */}
          <span
            className="subtabs__thumb"
            /* 3D로 적어 두면 어느 기기에서나 합성기가 맡는다 — 본줄기가 막혀도 미끄러진다. */
            style={{ transform: `translate3d(${index * 100}%, 0, 0)` }}
            aria-hidden="true"
          />
          {subs.map((to) => (
            <button
              key={to}
              type="button"
              role="tab"
              aria-selected={to === tabKey}
              className={`subtabs__item${to === tabKey ? " on" : ""}`}
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
