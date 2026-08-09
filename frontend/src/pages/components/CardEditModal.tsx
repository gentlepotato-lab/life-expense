import { useEffect } from "react";
import type { ReactNode } from "react";

type CardEditModalProps = {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
  saveDisabled?: boolean;
  saveLabel?: string;
  deleteLabel?: string;
  /** 저장 버튼 왼쪽에 들어가는 추가 액션 (예: Pending 의 "전송") */
  footerExtra?: ReactNode;
  children: ReactNode;
};

/**
 * 카드를 꾹 눌렀을 때 뜨는 편집 팝업의 공통 껍데기.
 * 안에 들어가는 입력 필드는 페이지마다 다르므로 children 으로 받는다.
 */
export default function CardEditModal({
  title,
  subtitle,
  onClose,
  onSave,
  onDelete,
  saveDisabled = false,
  saveLabel = "저장",
  deleteLabel = "삭제",
  footerExtra,
  children,
}: CardEditModalProps) {
  // Esc 로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel edit-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="edit-modal__head">
          <div className="edit-modal__head-text">
            <h3 className="edit-modal__title">{title}</h3>
            {subtitle && <p className="edit-modal__subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="edit-modal__close"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        <div className="edit-modal__body">{children}</div>

        <footer className="edit-modal__foot">
          {onDelete ? (
            <button type="button" className="delete-btn" onClick={onDelete}>
              {deleteLabel}
            </button>
          ) : (
            <span />
          )}

          <div className="edit-modal__foot-right">
            {footerExtra}
            <button type="button" className="ui-btn" onClick={onClose}>
              닫기
            </button>
            <button
              type="button"
              className="ui-btn primary"
              onClick={onSave}
              disabled={saveDisabled}
            >
              {saveLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/** 편집 팝업 안에서 쓰는 라벨 + 입력 한 줄 */
export function EditField({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`edit-field ${wide ? "edit-field--wide" : ""}`}>
      <label className="edit-field__label">{label}</label>
      <div className="edit-field__control">{children}</div>
    </div>
  );
}
