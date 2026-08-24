import { useCallback, useRef, useState } from "react";
import CardEditModal from "./CardEditModal";
import EntryForm from "./EntryForm";

/**
 * 지출 내역에서 바로 한 건 적는 팝업.
 *
 * 쓰기 화면으로 넘어갔다 돌아오면 보던 자리를 잃는다. 목록을 보다가
 * 떠오른 것을 그 자리에서 적고 닫는 쪽이 흐름이 끊기지 않는다.
 *
 * 칸은 쓰기 화면과 같은 것(EntryForm)을 쓰고, 껍데기만 카드 편집 팝업의
 * 틀(CardEditModal)을 두른다 — 다른 팝업과 배치 · 정렬이 어긋나지 않는다.
 */
export default function WriteEntryModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  /** 저장한 뒤 목록을 다시 읽으라고 알린다.
      적힌 것이 그 화면 목록에 안 드러나는 곳(대기 · 정기)은 넘기지 않는다 */
  onSaved?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);

  /* 바닥의 저장 단추가 폼의 전송을 대신 누른다.
     requestSubmit 이라 폼이 들고 있는 필수값 검사가 그대로 돈다. */
  const save = useCallback(() => {
    formRef.current?.requestSubmit();
  }, []);

  const handleSaved = useCallback(() => {
    onSaved?.();
    onClose();
  }, [onSaved, onClose]);

  return (
    <CardEditModal
      title="쓰기"
      onClose={onClose}
      onSave={save}
      saveDisabled={!dirty}
      saveLabel="전송"
    >
      <EntryForm
        ref={formRef}
        className="entry-form--modal"
        showSubmit={false}
        onDirtyChange={setDirty}
        onSaved={handleSaved}
      />
    </CardEditModal>
  );
}
