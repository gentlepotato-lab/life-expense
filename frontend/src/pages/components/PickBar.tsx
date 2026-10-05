import type { ReactNode } from "react";

/**
 * 고른 것이 있을 때만 아래에서 올라오는 막대.
 *
 * 영수증 단추를 도구 줄에 넣어 봤더니 360px에서 지출과 정기의 도구 줄이 두
 * 줄이 되어(24 → 56, 47px) 아래 내용이 통째로 밀렸다. 고를 때만 넣는 쪽은
 * 고를 때마다 밀렸다 돌아와 더 나빴다. 그래서 도구 줄을 건드리지 않고 따로
 * 띄운다.
 *
 * 쪽마다 하나씩 쓰므로 지출과 대기와 정기와 기간 내역이 모두 같은 꼴이 된다.
 * 대기의 [선택 전송]처럼 그 쪽에만 있는 단추는 more로 받는다.
 */
export default function PickBar({
  count,
  all,
  onAll,
  onClear,
  onReceipt,
  more,
}: {
  /** 고른 수 */
  count: number;
  /** 고를 수 있는 전부의 수. 다 골랐으면 [모두 선택]이 쉰다. */
  all: number;
  onAll: () => void;
  onClear: () => void;
  onReceipt: () => void;
  /** 그 쪽에만 있는 단추 */
  more?: ReactNode;
}) {
  if (count === 0) return null;

  return (
    <div className="pick-bar" role="toolbar" aria-label="고른 내역">
      <span className="pick-bar__n">{count}건 선택</span>
      <button
        type="button"
        className="pick-bar__sub"
        onClick={onAll}
        disabled={count >= all}
      >
        모두 선택
      </button>
      <button type="button" className="pick-bar__sub" onClick={onClear}>
        해제
      </button>
      {more}
      <button type="button" className="pick-bar__go" onClick={onReceipt}>
        영수증
      </button>
    </div>
  );
}
