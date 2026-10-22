import { useNavigate } from "react-router-dom";
import { ADMIN_TABS } from "../utils/adminTabs";
import { ArtDash, ArtLogs, ArtUsers } from "./components/AdminArt";

/**
 * 메인 탭(사용)의 첫 쪽.
 *
 * 사용자 사이트의 홈과 같은 짜임이다(pages/Home.tsx). 위 한 행에 둘이
 * 나란히 서고, 그 아래 한 줄에 하나씩 선다. 나란히 서는 칸은 그림이 위에
 * 글이 아래에 오고, 한 줄을 다 쓰는 칸은 글이 왼쪽에 그림이 오른쪽에 온다.
 *
 * 보라 머리띠는 이 쪽에만 선다(pages/Admin.tsx). 사용자 사이트에서
 * 「돈을 쓰다」가 홈에만 서고 다른 쪽은 제 이름을 다는 것과 같은 잣대다.
 *
 * 칸에 적는 이름과 한 줄은 등록부가 쥔다(utils/adminTabs.ts). 여기서는
 * 그림만 짝지어 준다. 글을 두 곳에 적으면 한쪽만 고치게 된다.
 */

/** 길마다의 그림. 등록부는 글만 쥐므로 짝은 여기서 맺는다. */
const 그림: Record<string, React.ReactNode> = {
  "/admin/dash": <ArtDash />,
  "/admin/logs": <ArtLogs />,
  "/admin/users": <ArtUsers />,
};

export default function AdminMain() {
  const navigate = useNavigate();
  const 쪽들 = ADMIN_TABS[0].pages;
  /* 앞의 둘은 나란히, 나머지는 한 줄씩. 홈이 둘과 넷으로 나누는 것과 같은
     꼴이다. 자리가 늘어도 앞의 둘만 나란히 선다. */
  const 나란히 = 쪽들.slice(0, 2);
  const 한줄씩 = 쪽들.slice(2);

  const 글 = (쪽: (typeof 쪽들)[number]) => (
    <span className="home-card__text">
      <span className="home-card__title">{쪽.name}</span>
      {Array.isArray(쪽.desc) ? (
        <span className="home-card__desc tag-row">
          {쪽.desc.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </span>
      ) : (
        <span className="home-card__desc">{쪽.desc}</span>
      )}
    </span>
  );

  return (
    <>
      {/* 위 한 행. 둘이 나란히 선다. */}
      <div className="home-row">
        {나란히.map((쪽) => (
          <button
            key={쪽.path}
            type="button"
            className="home-card home-card--half"
            onClick={() => navigate(쪽.path)}
          >
            <span className="home-card__art">{그림[쪽.path]}</span>
            {글(쪽)}
          </button>
        ))}
      </div>

      {/* 아래. 한 줄에 하나씩 선다. */}
      {한줄씩.map((쪽) => (
        <button
          key={쪽.path}
          type="button"
          className="home-card home-card--wide"
          onClick={() => navigate(쪽.path)}
        >
          {글(쪽)}
          <span className="home-card__art">{그림[쪽.path]}</span>
        </button>
      ))}
    </>
  );
}
