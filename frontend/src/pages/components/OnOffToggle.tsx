import { BulbOnIcon, BulbOffIcon } from "./SkipIcons";

/**
 * 켬과 끔 전구 스위치.
 *
 * 돈쓴이의 「어떻게 볼까?」가 쓰는 그 스위치다(pages/Me.tsx의 onoff).
 * 꼴과 빛깔은 index.css 159절이 쥔다. 두 짝이 나란히 서서, 선택할 것이 둘임을
 * 눌러 보지 않아도 알게 한다.
 *
 * 돈쓴이 쪽을 부품으로 빼내지 않고 같은 짜임을 여기 다시 적은 까닭은, 그
 * 화면을 건드리지 않기로 했기 때문이다. 꼴을 고칠 일이 생기면 두 곳을
 * 함께 고쳐야 한다.
 *
 * 막혀 있을 때도 그리는 것이 규칙이다. 편집 중에만 나타나게 하면 켜졌는지
 * 꺼졌는지를 보려고 편집에 들어가야 한다.
 */
export default function OnOffToggle({
  이름,
  켜짐,
  막힘 = false,
  켬말,
  끔말,
  on바뀜,
}: {
  /** 무엇의 켬과 끔인가. 읽어 주는 이름이다. */
  이름: string;
  켜짐: boolean;
  /** 눌러도 안 바뀌는 상태. 편집 중이 아닐 때 그렇다. */
  막힘?: boolean;
  켬말: string;
  끔말: string;
  on바뀜: (켠다: boolean) => void;
}) {
  return (
    <span
      className={`set-fixed set-onoff${켜짐 ? " set-onoff--on" : ""}`}
      role="group"
      aria-label={이름}
    >
      <button
        type="button"
        className={켜짐 ? "on" : ""}
        aria-pressed={켜짐}
        disabled={막힘}
        title={켬말}
        onClick={(e) => {
          e.stopPropagation();
          on바뀜(true);
        }}
      >
        <BulbOnIcon />
      </button>
      <button
        type="button"
        className={켜짐 ? "" : "on"}
        aria-pressed={!켜짐}
        disabled={막힘}
        title={끔말}
        onClick={(e) => {
          e.stopPropagation();
          on바뀜(false);
        }}
      >
        <BulbOffIcon />
      </button>
    </span>
  );
}
