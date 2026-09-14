import { useNavigate } from "react-router-dom";
import { PAGE_ICON } from "./MenuIcons";
import { closeOverlays } from "../../hooks/useBackClose";

/**
 * 그 화면으로 건너뛰는 단추.
 *
 * 잔소리 상세가 바닥에 다는 것과 같은 생김새다 — 이름은 떼고 그 화면의
 * 그림과 화살표만 남긴다. 화살표가 "여기서 저기로 간다"를 말해 주므로
 * 좁은 자리에도 들어간다.
 *
 * 붙는 자리마다 크기가 다르므로(돈쓴이의 칸 · 팝업 바닥 · 쓰기의 전송 줄)
 * 치수는 className으로 밖에서 준다. 여기서는 생김새와 하는 일만 맡는다.
 */
export default function GoToButton({
  to,
  label,
  className = "",
  inPopup = false,
}: {
  to: string;
  label: string;
  className?: string;
  /**
   * 팝업 안에서 누르는 것인가.
   *
   * 그냥 옮겨 가면 팝업이 뒤로 가기용으로 끼워 둔 칸이 남아, 다음 뒤로 가기가
   * 한 번 헛돈다. 열려 있는 것을 먼저 걷고 나서 옮긴다.
   */
  inPopup?: boolean;
}) {
  const navigate = useNavigate();

  const go = () => {
    if (inPopup) void closeOverlays().then(() => navigate(to));
    else navigate(to);
  };

  return (
    <button
      type="button"
      className={`ui-btn nudge-detail__go ${className}`.trim()}
      onClick={go}
      aria-label={`${label}(으)로 가기`}
      title={label}
    >
      <span className="nudge-detail__go-icon" aria-hidden="true">
        {PAGE_ICON[to]}
      </span>
      <span className="nudge-detail__go-arrow" aria-hidden="true">
        <svg
          viewBox="0 0 32 32"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 16h13M17 11l5 5-5 5" />
        </svg>
      </span>
    </button>
  );
}
