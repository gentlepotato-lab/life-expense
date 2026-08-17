import { useNavigate } from "react-router-dom";
import { PAGE_TITLE } from "../../utils/pageTitles";

/**
 * 탭 안에서 상세 화면으로 들어가는 목록.
 *
 * 홈과 같은 칸 모양(.home-card--wide)을 쓴다. 탭이 달라도 들어가는 방식이
 * 같아야 손이 헷갈리지 않는다.
 *
 * 이름은 경로 하나로 정해지므로(utils/pageTitles.ts) 여기서는 한 줄 설명과
 * 그림만 갖는다.
 */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** 경로별 한 줄 설명과 그림 */
const ITEM: Record<string, { desc: string; icon: React.ReactNode }> = {
  "/entries": {
    desc: "기록을 마친 지출과 수입",
    icon: (
      <svg viewBox="0 0 32 32" {...stroke}>
        <path d="M6 5h20v22H6z" />
        <path d="M11 12h10M11 17h10M11 22h6" />
      </svg>
    ),
  },
  "/pending-entries": {
    desc: "확정 전에 검수하는 항목",
    icon: (
      /* 모래시계 — 아래에 모래가 조금 쌓였다 */
      <svg viewBox="0 0 32 32" {...stroke}>
        {/* 위아래 테 */}
        <path d="M9 5h14M9 27h14" />
        {/* 유리 — 가운데가 잘록하다 */}
        <path d="M11 5v3.4c0 3.6 5 5.6 5 7.6s-5 4-5 7.6V27" />
        <path d="M21 5v3.4c0 3.6-5 5.6-5 7.6s5 4 5 7.6V27" />
        {/* 아래에 쌓인 모래.
            위쪽에도 남은 모래를 그려 봤지만, 26px 에서는 잘록한 목의 선과 붙어
            덩어리로 보였다. 목의 틈이 0.5px 도 안 돼 떼어 놓을 수가 없다.
            아래에 쌓인 것만으로도 "모래가 내려앉는 중" 은 충분히 읽힌다. */}
        <path
          d="M12 25.7c0-3.1 2.3-4.8 4-4.8s4 1.7 4 4.8z"
          fill="currentColor"
          stroke="none"
        />
      </svg>
    ),
  },
  "/scheduled-entries": {
    desc: "매달 반복되는 지출",
    icon: (
      <svg viewBox="0 0 32 32" {...stroke}>
        <path d="M6 9h20v18H6z" />
        <path d="M6 15h20M11 5v6M21 5v6" />
        <path d="M13 21h6" />
      </svg>
    ),
  },
  "/categories": {
    desc: "중분류 · 소분류 · 세분류",
    icon: (
      <svg viewBox="0 0 32 32" {...stroke}>
        <path d="M5 8h9l2 3h11v13H5z" />
        <path d="M5 15h22" />
      </svg>
    ),
  },
  "/payment-methods": {
    desc: "카드 · 계좌 · 간편결제",
    icon: (
      <svg viewBox="0 0 32 32" {...stroke}>
        <rect x="4" y="8" width="24" height="16" rx="3" />
        <path d="M4 14h24M8 19h5" />
      </svg>
    ),
  },
  "/counterparts": {
    desc: "금액을 나눠 낸 사람",
    icon: (
      <svg viewBox="0 0 32 32" {...stroke}>
        <circle cx="12" cy="12" r="4.5" />
        <path d="M4 25c0-4.4 3.6-7 8-7s8 2.6 8 7" />
        <circle cx="23" cy="13" r="3.5" />
        <path d="M22 19c3.4.3 6 2.8 6 6" />
      </svg>
    ),
  },
};

export default function MenuList({ paths }: { paths: string[] }) {
  const navigate = useNavigate();

  return (
    <div className="menu-list">
      {paths.map((to) => (
        <button
          key={to}
          type="button"
          className="home-card home-card--wide menu-card"
          onClick={() => navigate(to)}
        >
          <span className="home-card__text">
            <span className="home-card__title">{PAGE_TITLE[to]}</span>
            <span className="home-card__desc">{ITEM[to].desc}</span>
          </span>
          <span className="menu-card__icon">{ITEM[to].icon}</span>
        </button>
      ))}
    </div>
  );
}
