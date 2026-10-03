import { PinIcon, WaveIcon } from "./FixedIcons";

/**
 * 내역 카드의 고정 · 변동 기호 — 보는 것과 바꾸는 것이 한 몸이다.
 *
 * 카드 실적 제외 단추(PerfExcludeButton)와 같은 결이다. 기호가 곧 단추라
 * 폼에 칸을 따로 만들지 않고, 그 단추처럼 동그라미 안에 기호를 담는다.
 * 누르면 압정과 물결이 번갈아 뒤집힌다.
 *
 * 동그라미는 두 쪽 다 옅게 채운다. 고정에만 색을 주면 변동이 "안 정한 것"처럼
 * 보이지만, 둘은 나란한 두 갈래다. 무엇인지는 빛깔이 아니라 기호가 말한다.
 *
 * 처음에는 분류(소 · 세)에 정해 둔 것을 따르고, 여기서 한 번 누르면 그 건에만
 * 남는다. 뒤에 분류 설정을 바꿔도 손댄 건은 그대로다.
 *
 * 카드의 꾹 누르기와 접은 자국 떼기가 이 단추를 삼키지 않도록
 * `data-no-longpress`를 달고 누름을 여기서 멈춘다.
 */
type Props = {
  /** 지금 이 건이 고정인가 */
  on: boolean;
  /** 뒤집기. 보기만 하는 화면에서는 주지 않는다. */
  onToggle?: (next: boolean) => void;
  /** 보기만 하는 화면(기간 상세)에서는 누를 수 없다. */
  readOnly?: boolean;
};

export default function FixedMark({ on, onToggle, readOnly = false }: Props) {
  const 이름 = on ? "고정" : "변동";
  const title = readOnly ? 이름 : `${이름} 지출이다. 눌러서 ${on ? "변동" : "고정"}으로.`;

  return (
    <button
      type="button"
      className={`fixed-mark${on ? " on" : ""}`}
      data-no-longpress
      disabled={readOnly}
      title={title}
      aria-pressed={on}
      aria-label={`고정/변동, 지금은 ${이름}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (!readOnly) onToggle?.(!on);
      }}
    >
      <span className="fixed-mark__disc" aria-hidden="true">
        {on ? <PinIcon /> : <WaveIcon />}
      </span>
    </button>
  );
}
