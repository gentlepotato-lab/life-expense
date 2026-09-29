import type { LockAt } from "../../hooks/useEditLock";

/**
 * 편집이 아닐 때 고칠 자리를 덮는 한 겹과, 눌렀을 때 뜨는 안내 한 줄.
 *
 * 아래 조각들은 disabled라 눌러도 사건이 나지 않는다. 그래서 위에 한 겹 깔아
 * 그 누름을 받는다. 읽어 주는 기계에게는 잠긴 것으로 남아야 하므로 disabled를
 * 풀지는 않는다.
 *
 * 덮개는 자리를 잡아 줄 부모가 필요하다(position: relative). 덮을 줄이
 * 그것을 이미 들고 있지 않으면 `lock-host`를 함께 달아 준다.
 */

/**
 * 덮개 — 편집이 아닐 때만 깔린다. 편집 중에는 아무것도 그리지 않는다.
 *
 * 줄 하나를 통째로 잠그는 자리(돈쓴이의 설정 줄)에 쓴다. 줄 안에 편집과
 * 상관없이 눌러야 하는 것(접고 펴기 같은 것)이 있으면 이것 말고 조각마다
 * `aria-disabled`를 달고 누름을 받는 쪽을 쓴다 — 덮개는 그런 것까지 막는다.
 */
export function EditLockCover({
  editMode,
  onLock,
}: {
  editMode: boolean;
  onLock: (e: React.MouseEvent<HTMLElement>) => void;
}) {
  if (editMode) return null;
  return (
    <button
      type="button"
      className="edit-lock"
      aria-label="편집 버튼을 누른 후 선택하세요."
      onClick={onLock}
    />
  );
}

/** 안내 한 줄 — 화면에 하나면 된다. 화면 맨 끝에 둔다. */
export function EditLockTip({
  lockAt,
  tipRef,
}: {
  lockAt: LockAt;
  tipRef: React.RefObject<HTMLSpanElement | null>;
}) {
  if (!lockAt) return null;
  return (
    <span key={lockAt.n} className="edit-lock__tip" role="status" ref={tipRef}>
      편집 버튼을 누른 후 선택하세요.
    </span>
  );
}
