/**
 * 묶음을 펼치고 접는 작은 삼각형.
 *
 * 두 상태 모두 같은 자리·같은 크기를 차지한다. 접었다 펴는 것으로
 * 옆 항목이 밀리면 안 되기 때문이다.
 * 자식이 없어 접을 것이 없는 줄에서는 자리만 남기고 감춘다(hidden).
 */
export default function CollapseToggle({
  open,
  onToggle,
  hidden = false,
  label,
}: {
  open: boolean;
  onToggle: () => void;
  hidden?: boolean;
  label: string;
}) {
  if (hidden) {
    return <span className="set-toggle set-toggle--empty" aria-hidden="true" />;
  }

  return (
    <button
      type="button"
      className={`set-toggle ${open ? "open" : ""}`}
      title={open ? `${label} 접기` : `${label} 펼치기`}
      aria-label={open ? `${label} 접기` : `${label} 펼치기`}
      aria-expanded={open}
      onClick={(e) => {
        // 머리말 전체가 이름 편집 영역인 화면이 있어 여기서 끊는다
        e.stopPropagation();
        onToggle();
      }}
    >
      {/* 접힘 ">" · 펼침 "v" — 90° 회전만 하므로 자리가 흔들리지 않는다.
          끝을 둥글게 깎아 획이 부드럽게 보이게 한다. */}
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M9 5.5 L16 12 L9 18.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/**
 * "모두 펼치기 / 모두 접기".
 * 목록 맨 위 추가 버튼과 같은 줄에 둔다.
 */
export function CollapseAllButtons({
  onExpandAll,
  onCollapseAll,
}: {
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  return (
    <div className="set-bulk">
      <button type="button" className="set-bulk__btn" onClick={onExpandAll}>
        모두 펼치기
      </button>
      <span className="set-bulk__sep" aria-hidden="true" />
      <button type="button" className="set-bulk__btn" onClick={onCollapseAll}>
        모두 접기
      </button>
    </div>
  );
}
