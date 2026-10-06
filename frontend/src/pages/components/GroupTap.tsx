import { useCallback, useRef, type ReactNode } from "react";
import useLongPress from "../../hooks/useLongPress";

/**
 * 묶음을 가리키는 자리들이 함께 쓰는 누름.
 *
 * 머리말이든, 메모판이든, 접어 두었을 때 보이는 한 줄이든 묶음을 가리키는
 * 자리는 모두 같게 눌려야 한다 — 그냥 누르면 펼쳐지고 접히고, 꾹 누르면
 * 묶음 팝업이 열린다. 자리마다 따로 적어 두면 한 곳만 고치고 나머지를 잊는다.
 *
 * 꾹 눌러 열고 손을 떼면 click이 뒤따라 온다. 그대로 두면 팝업이 뜨면서
 * 뒤에서 펼쳐지거나 접힌다. 한 번만 삼킨다.
 */
export default function GroupTap({
  className,
  label,
  onToggle,
  onOpen,
  children,
}: {
  className: string;
  /** 읽어 주는 기계에게 알릴 이름 */
  label: string;
  onToggle: () => void;
  onOpen: () => void;
  children: ReactNode;
}) {
  const 방금열림 = useRef(false);

  const { pressing, handlers } = useLongPress(
    useCallback(() => {
      방금열림.current = true;
      onOpen();
    }, [onOpen])
  );

  return (
    <div
      className={`${className}${pressing ? " is-pressing" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={label}
      title="눌러서 펼치기, 꾹 눌러서 묶음 보기"
      onClick={() => {
        if (방금열림.current) {
          방금열림.current = false;
          return;
        }
        onToggle();
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      {...handlers}
    >
      {children}
    </div>
  );
}
