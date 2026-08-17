import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * 묶음(구분) 자체를 끌어서 순서를 바꾼다.
 *
 * 손잡이를 머리말 어디에 둘지는 화면마다 달라서, 손잡이 엘리먼트를
 * 넘겨 주고 배치는 호출한 쪽이 정하게 한다.
 * 손잡이는 두 모드에서 늘 자리를 차지한다. 그러지 않으면 편집에
 * 들어가는 순간 머리말이 통째로 밀린다.
 */
export default function SortableGroup({
  id,
  enabled,
  className,
  children,
}: {
  id: number;
  enabled: boolean;
  className: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !enabled });

  const handle = enabled ? (
    <span className="set-group-drag" {...attributes} {...listeners} aria-label="구분 순서 변경">
      ≡
    </span>
  ) : (
    <span className="set-group-drag set-group-drag--empty" aria-hidden="true" />
  );

  return (
    <section
      ref={setNodeRef}
      className={`${className} ${isDragging ? "dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {children(handle)}
    </section>
  );
}
