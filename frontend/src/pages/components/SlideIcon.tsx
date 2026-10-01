import PenIcon from "./PenIcon";

/**
 * 쓰기 슬라이드(beta)의 기호.
 *
 * 로고의 만년필에 걸음점 셋을 얹었다. 옆에 선 쓰기 단추와 같은 펜을 써서
 * 한 핏줄임을 보이고, 아래 걸음점으로 "넘기며 적는다"를 말한다. 팝업 바닥의
 * 걸음점과 같은 모양이라, 눌러서 열면 그 점이 그대로 이어진다.
 *
 * 펜은 PenIcon을 그대로 불러 쓴다 — 로고에서 떼어 온 길을 또 한 벌 적어
 * 두면 로고가 바뀔 때 한쪽만 고쳐진다. 걸음점만 그 위에 겹쳐 둔다.
 */
export default function SlideIcon() {
  return (
    <span className="slide-icon">
      <PenIcon size={17} />
      <svg
        className="slide-icon__steps"
        viewBox="0 0 16 4"
        aria-hidden="true"
        focusable="false"
      >
        {/* 첫 칸이 길쭉한 것은 지금 선 자리를 뜻한다. */}
        <rect x="0" y="0.5" width="7" height="3" rx="1.5" fill="currentColor" />
        <circle cx="10.5" cy="2" r="1.5" fill="currentColor" opacity={0.4} />
        <circle cx="14.5" cy="2" r="1.5" fill="currentColor" opacity={0.4} />
      </svg>
    </span>
  );
}
