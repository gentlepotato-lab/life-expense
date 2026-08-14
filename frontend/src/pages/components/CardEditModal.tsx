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
  /**
   * 머리말 아래에 붙는 날짜·시간 입력 줄.
   * 본문 그리드 사이에 끼면 칸이 좁아지고, 어차피 머리말이 날짜를 말하고 있으므로
   * 시점에 관한 입력은 여기에 모은다.
   */
  headerFields?: ReactNode;
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
  headerFields,
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

        {headerFields && (
          <div className="edit-modal__headfields">{headerFields}</div>
        )}

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

/**
 * 편집 팝업 안의 입력 한 칸.
 *
 * 팝업 본문은 12칸 그리드다. span 으로 칸 수를 지정해 좌우 분할을 만든다.
 *   12 = 한 줄 전체 · 8 = 2/3 · 6 = 2분할 · 4 = 3분할 · 3 = 4분할
 * 칸 수를 명시하므로 입력 내용 길이와 무관하게 폭이 고정된다.
 */
export function EditField({
  label,
  children,
  span = 6,
}: {
  label: string;
  children: ReactNode;
  span?: 3 | 4 | 6 | 8 | 12;
}) {
  return (
    <div className={`edit-field edit-field--span-${span}`}>
      <label className="edit-field__label">{label}</label>
      <div className="edit-field__control">{children}</div>
    </div>
  );
}

/** 성격이 다른 항목 묶음 사이를 가르는 얇은 구분선 */
export function EditDivider() {
  return <div className="edit-divider" aria-hidden="true" />;
}
