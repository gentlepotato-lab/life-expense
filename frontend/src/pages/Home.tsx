import { useNavigate } from "react-router-dom";
import {
  ArtWrite,
  ArtProfile,
  ArtChart,
  ArtNudge,
} from "./components/HomeArt";
import QuickActions from "./components/QuickActions";

/**
 * 첫 화면.
 *
 * 이름은 서비스 이름의 "쓰다"를 넷이 나눠 갖는다.
 *   쓰기 — 돈을 쓴다, 그리고 적는다.
 *   돈쓴이 — 그 돈을 쓴 사람, 곰 글쓴이처럼
 *   씀씀이 — 어떻게 써 왔는지
 *   잔소리 — 쓰기 전에 한마디
 *
 * 속은 아직 비어 있다. 그래서 칸마다 무엇이 들어올 자리인지 그림으로 미리 보여 준다.
 */

const TOP = [
  {
    to: "/write",
    title: "쓰기",
    desc: "지출 · 수입 입력",
    art: <ArtWrite />,
  },
  {
    to: "/me",
    title: "돈쓴이",
    desc: "내 정보",
    art: <ArtProfile />,
  },
];

const WIDE = [
  {
    to: "/charts",
    title: "씀씀이",
    desc: "지출 추이와 분석",
    art: <ArtChart />,
  },
  {
    to: "/nudges",
    title: "잔소리",
    desc: "알림과 추천",
    art: <ArtNudge />,
  },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="page-wrap home">

      {/* 위 한 행 — 둘이 나란히 */}
      <div className="home-row">
        {TOP.map((d) => (
          <button
            key={d.to}
            type="button"
            className="home-card home-card--half"
            onClick={() => navigate(d.to)}
          >
            <span className="home-card__art">{d.art}</span>
            <span className="home-card__text">
              <span className="home-card__title">{d.title}</span>
              <span className="home-card__desc">{d.desc}</span>
            </span>
          </button>
        ))}
      </div>

      {/* 아래 — 한 줄에 하나씩 */}
      {WIDE.map((d) => (
        <button
          key={d.to}
          type="button"
          className="home-card home-card--wide"
          onClick={() => navigate(d.to)}
        >
          <span className="home-card__text">
            <span className="home-card__title">{d.title}</span>
            <span className="home-card__desc">{d.desc}</span>
          </span>
          <span className="home-card__art">{d.art}</span>
        </button>
      ))}

      <QuickActions />
    </div>
  );
}
