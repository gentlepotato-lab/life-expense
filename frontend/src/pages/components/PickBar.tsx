import { useEffect } from "react";
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
  onDelete,
  more,
  unit = "건",
}: {
  /** 고른 수 */
  count: number;
  /** 고를 수 있는 전부의 수. 다 골랐으면 [모두 선택]이 쉰다. */
  all: number;
  onAll: () => void;
  onClear: () => void;
  onReceipt: () => void;
  /**
   * 고른 것을 한꺼번에 지운다. 주지 않으면 단추가 서지 않는다 —
   * 묶음처럼 지우는 뜻이 다른 쪽이 있다.
   */
  onDelete?: () => void;
  /** 그 쪽에만 있는 단추 */
  more?: ReactNode;
  /** 세는 낱말. 묶음 내역은 건이 아니라 묶음을 센다. */
  unit?: string;
}) {
  /* 고르는 동안 맨 위로는 비킨다.

     막대는 아래 이동 막대 바로 위에 서고, 맨 위로도 같은 자리를 쓴다. 재어
     보니 44×32만큼 겹쳐 [영수증]을 덮었다. 겹치는 것은 그 하나뿐이라
     (내보내기와 담기는 막대보다 위에 선다) 떠 있는 단추를 줄줄이 올릴
     까닭이 없다. 팝업이 뜰 때 이미 같은 식으로 비키고 있다.

     고르기를 풀면 곧바로 돌아온다. */
  useEffect(() => {
    if (count === 0) return;
    document.documentElement.classList.add("picking");
    return () => document.documentElement.classList.remove("picking");
  }, [count]);

  if (count === 0) return null;

  return (
    <div className="pick-bar" role="toolbar" aria-label="선택한 내역">
      {/* 아주 좁은 화면에서는 꼬리말을 접는다. 360px에서 일곱 조각이
          한 줄에 다 들어가지 않는데, 막대가 두 줄이 되면 그만큼 올라와
          카드를 더 가린다. 무엇을 센 수인지는 막대가 떠 있는 것만으로
          알 수 있다. */}
      <span className="pick-bar__n">
        {count}
        {unit}
        <span className="pick-bar__n-tail">{" 선택"}</span>
      </span>
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
      {onDelete && (
        /* 되돌릴 수 없는 일이라 다른 단추와 빛깔을 가른다. 누르면 바로
           지우지 않고 한 번 되묻는다(부르는 쪽이 맡는다). */
        <button type="button" className="pick-bar__del" onClick={onDelete}>
          제거
        </button>
      )}
      <button type="button" className="pick-bar__go" onClick={onReceipt}>
        영수증
      </button>
    </div>
  );
}
