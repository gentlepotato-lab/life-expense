import { useNavigate } from "react-router-dom";
import QuickActions from "./components/QuickActions";

/**
 * 아직 속을 채우지 않은 화면.
 *
 * 홈에서 문은 냈지만 안에 무엇을 둘지는 뒤에 정하기로 했다.
 * 빈 화면에 덩그러니 떨어지지 않도록, 이름과 돌아가는 길만 둔다.
 * 이름은 PageHead 가 경로를 보고 알아서 붙인다.
 */
export default function Blank() {
  const navigate = useNavigate();

  return (
    <div className="page-wrap">

      <div className="blank-page">
        <p className="blank-page__line">아직 비어 있습니다.</p>
        <button type="button" className="ui-btn small" onClick={() => navigate("/")}>
          홈으로
        </button>
      </div>

      <QuickActions />
    </div>
  );
}
