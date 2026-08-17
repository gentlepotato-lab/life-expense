import { useLocation, useNavigate } from "react-router-dom";

/**
 * 화면 아래에 늘 붙어 있는 이동 막대.
 *
 * 전에는 왼쪽 위 ☰ 를 눌러 목록을 펼쳐야 했다. 한 손으로 쥐고 쓰는 화면에서는
 * 손가락이 닿는 아래쪽에 두는 편이 빠르다.
 *
 * 묶음은 셋이다 — 홈 · 내역 · 설정.
 * "쓰기" 는 홈에 딸린 화면이라 여기 두지 않는다. 홈 첫 칸에서 바로 들어간다.
 *
 * "내역" 과 "설정" 은 안에서 다시 갈라지므로(SubTabs), 그 하위 경로에 있을 때도
 * 해당 묶음이 켜진 것으로 본다.
 */

type Tab = {
  label: string;
  /** 눌렀을 때 갈 곳 */
  to: string;
  /** 이 묶음이 켜진 것으로 볼 경로들 */
  match: string[];
  icon: React.ReactNode;
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const TABS: Tab[] = [
  {
    label: "홈",
    to: "/",
    /* 쓰기 · 쓰는 사람 · 씀씀이 · 잔소리는 홈에 딸린 화면이다.
       그 안에 있을 때도 홈이 켜져 있어야 어디에 있는지 알 수 있다. */
    match: ["/", "/write", "/me", "/charts", "/nudges"],
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M4 10.5 12 4l8 6.5" />
        <path d="M6 10v9h12v-9" />
      </svg>
    ),
  },
  {
    label: "내역",
    to: "/history",
    match: [
      "/history",
      "/entries",
      "/pending-entries",
      "/scheduled-entries",
      "/calendar",
      "/calendar/detail",
    ],
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <path d="M5 4h14v16H5z" />
        <path d="M8.5 9h7M8.5 13h7M8.5 17h4" />
      </svg>
    ),
  },
  {
    label: "설정",
    to: "/settings",
    match: ["/settings", "/categories", "/payment-methods", "/counterparts"],
    icon: (
      <svg viewBox="0 0 24 24" {...stroke}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
      </svg>
    ),
  },
];

export default function TabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="tabbar" aria-label="주요 화면">
      {TABS.map((tab) => {
        const on = tab.match.includes(pathname);
        return (
          <button
            key={tab.label}
            type="button"
            className={`tabbar__item${on ? " on" : ""}`}
            aria-current={on ? "page" : undefined}
            onClick={() => navigate(tab.to)}
          >
            <span className="tabbar__icon">{tab.icon}</span>
            <span className="tabbar__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
