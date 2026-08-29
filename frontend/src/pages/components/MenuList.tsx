import { useNavigate } from "react-router-dom";
import { PAGE_TITLE } from "../../utils/pageTitles";
import { PAGE_ICON } from "./MenuIcons";

/**
 * 탭 안에서 상세 화면으로 들어가는 목록.
 *
 * 홈과 같은 칸 모양(.home-card--wide)을 쓴다. 탭이 달라도 들어가는 방식이
 * 같아야 손이 헷갈리지 않는다.
 *
 * 이름은 경로 하나로 정해지므로(utils/pageTitles.ts) 여기서는 한 줄 설명만
 * 갖는다. 그림은 잔소리 상세의 건너뛰기 단추도 함께 쓰므로 따로 두었다.
 * (MenuIcons.tsx).
 */

/** 경로별 한 줄 설명 */
const DESC: Record<string, string> = {
  "/entries": "기록을 마친 지출과 수입",
  "/pending-entries": "확정 전에 검수하는 항목",
  "/scheduled-entries": "매달 반복되는 지출",
  "/calendar": "한 달을 한눈에",
  "/categories": "중분류 · 소분류 · 세분류",
  "/payment-methods": "카드 · 계좌 · 간편결제",
  "/counterparts": "금액을 나눠 낸 사람",
  "/goals": "분류마다 정한 이 달의 목표",
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
            <span className="home-card__desc">{DESC[to]}</span>
          </span>
          <span className="menu-card__icon">{PAGE_ICON[to]}</span>
        </button>
      ))}
    </div>
  );
}
