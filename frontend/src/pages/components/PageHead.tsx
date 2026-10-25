import { useEffect, useReducer } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  PAGE_TITLE,
  PAGE_NOTE,
  HOME_PILL_TABS,
  ENTRY_TABS,
  SETTING_TABS,
} from "../../utils/pageTitles";
import { keepOn, onMenuOff } from "../../utils/menuRegistry";
import useHeadPin from "../../hooks/useHeadPin";
import PenMark from "./PenMark";
import PageNote from "./PageNote";
import { 관리자길 } from "../../utils/adminPath";

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
  /* 꺼 놓은 메뉴는 알약에서도 뺀다. 목록에서만 빼고 알약을 두면 거기로
     가는 길이 남는다. */
  if (ENTRY_TABS.includes(pathname)) return keepOn(ENTRY_TABS);
  if (SETTING_TABS.includes(pathname)) return keepOn(SETTING_TABS);
  /* 홈 탭에서 알약으로 묶는 셋(utils/pageTitles.ts의 HOME_PILL_TABS). 홈
     자신과 나머지 쪽에는 두지 않는다. 탭 첫 쪽은 카드로 들어가는 자리이고,
     내역과 설정도 그 첫 쪽(/history, /settings)에는 알약이 없다. */
  if (HOME_PILL_TABS.includes(pathname)) return keepOn(HOME_PILL_TABS);
  return null;
}

/**
 * 갈래 탭에 자기 자리가 없는 곁가지 화면은 어미 화면을 켠 것으로 본다.
 * 그래야 머리말 높이가 그대로라 오갈 때 아래 내용이 튀지 않는다.
 */
const PARENT: Record<string, string> = {
  "/calendar/detail": "/calendar",
};

export default function PageHead() {
  const { pathname } = useLocation();

  /* 관리자 페이지는 제 머리띠를 쓴다. 사용자 화면의 머리말이 함께 서면
     제목이 둘이 된다(pages/Admin.tsx). 자리가 /admin 아래로 쪼개져 있으므로
     그 아래까지 본다(utils/adminPath.ts). */
  const 관리자인가 = 관리자길(pathname);

  /* 꺼 놓은 메뉴 목록은 앱이 뜬 뒤에 도착한다. 그때 알약을 다시 그린다.
     아무것도 꺼져 있지 않으면 목록이 그대로라 한 줄도 달라지지 않는다. */
  const [, 다시] = useReducer((n: number) => n + 1, 0);
  useEffect(() => onMenuOff(다시), []);
  const navigate = useNavigate();

  /* 머리말과 첫 줄 도구를 위에 붙인다. 굴리는 쪽을 보고 감추거나 드러낸다. */
  useHeadPin();

  const title = PAGE_TITLE[pathname] ?? "돈을 쓰다";
  /* 알약이 어디에 놓일지는 어미 화면으로 따진다. */
  const tabKey = PARENT[pathname] ?? pathname;
  const subs = subTabsFor(tabKey);
  const index = subs ? subs.indexOf(tabKey) : -1;
  /* 갈래 탭이 선 화면에서도 둔다. 제목과 탭 사이에 끼어 선다. */
  const note = PAGE_NOTE[pathname];

  useEffect(() => {
    /* 관리자 쪽 제목은 그쪽이 쥔다(pages/Admin.tsx). 여기서도 적으면 자리를
       옮길 때마다 창 제목이 「돈을 쓰다와 돈을 쓰다」로 덮였다. 훅은 조건
       없이 돌려야 하므로 안에서 가른다. */
    if (관리자길(pathname)) return;
    /* 쪽 이름은 적지 않는다. 탭에 보이는 자리가 좁아 앞의 몇 글자만 뜨는데,
       거기에 쪽 이름이 먼저 서면 탭 여럿을 열어 놓았을 때 어느 것이 이 앱인지
       알 수 없다. 관리자 쪽은 「돈을 쓰다(admin)」으로 갈린다. */
    document.title = "돈을 쓰다";
  }, [pathname]);

  /* 관리자 화면에서는 아무것도 그리지 않는다. 훅은 위에서 모두 돌았으므로
     부르는 차례가 흐트러지지 않는다. */
  if (관리자인가) return null;

  return (
    <header className="page-head">
      <div className="page-head__row">
        {/* 글자만 기울이고 네모 바탕은 반듯하게 두려면 한 겹이 더 있어야 한다.
            바깥이 바탕, 안이 기울어진 글자와 형광펜 띠다. */}
        <h1 className="page-title">
          <span className="page-title__in">{title}</span>
        </h1>
        {/* 안내는 제목 옆의 ⓘ에서 쪽지로 뜬다(PageNote.tsx). 화면을 옮기면
            다시 세워 닫힌 자리에서 시작한다. */}
        {note && <PageNote key={pathname} 제목={title} 안내={note} />}
      </div>

      {/* 만년필 자국이 서는 줄. 안내 글이 쪽지로 들어가면서 글은 빠졌고 줄의
          자리와 키는 그대로다. 비운 자리의 절반을 자국이 쓴다. 오른쪽 끝은
          홈의 반쪽 카드(.home-card--half)와 같은 세로줄에 선다. */}
      {note && (
        <div className="page-doodle-row">
          <PenMark />
        </div>
      )}

      {subs && (
        <div
          className="subtabs"
          role="tablist"
          /* 갈래 수가 화면마다 다르다(내역 4개와 설정 3개).
             알약 폭을 여기서 알려 줘야 CSS가 맞춰 자를 수 있다. */
          style={{ "--tab-n": subs.length } as React.CSSProperties}
        >
          {/* 켜진 갈래를 덮는 알약 하나. 자리만 옮기므로 미끄러진다. */}
          <span
            className="subtabs__thumb"
            /* 3D로 적으면 어느 기기에서나 합성기가 맡는다. 본줄기가 막혀도 미끄러진다. */
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
