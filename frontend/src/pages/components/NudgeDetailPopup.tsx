import { useEffect, useState } from "react";
import useBackClose from "../../hooks/useBackClose";
import useRevealDrag from "../../hooks/useRevealDrag";
import { PAGE_ICON } from "./MenuIcons";
import { formatDateLabel } from "../../utils/dateGroup";
import type { Nudge, NudgeItem, NudgeLink } from "../../utils/nudges";

/**
 * 잔소리 한 줄을 꾹 눌렀을 때 펼쳐지는 상세.
 *
 * 껍데기는 다른 팝업과 같은 틀(popup-overlay · popup-panel--framed)이다.
 * 안에는 날짜 · 분류 · 메모만 적는다 — 더 캐고 싶으면 바닥의 단추로 그
 * 내역 화면으로 건너뛴다.
 */

/** 한 줄 — 왼쪽에 날짜 · 분류 · 메모, 오른쪽에 금액.
    가려 둔 갈래는 금액에만 테이프를 붙인다. 옆으로 끌면 잠깐 걷힌다. */
function DetailRow({ item }: { item: NudgeItem }) {
  const [revealed, setRevealed] = useState(false);
  const onDrag = useRevealDrag(setRevealed);
  const taped = !!item.blur && !revealed;

  return (
    <div className="nudge-detail__row">
      <span className="nudge-detail__what">
        {item.date && <span className="nudge-detail__date">{formatDateLabel(item.date)}</span>}
        {item.cat && <span className="nudge-detail__cat">{item.cat}</span>}
        {item.memo && <span className="nudge-detail__memo">{item.memo}</span>}
      </span>
      {item.amount !== undefined && (
        <span
          className={`nudge-detail__amount${taped ? " is-taped" : ""}`}
          onMouseDown={item.blur ? onDrag : undefined}
          onTouchStart={item.blur ? onDrag : undefined}
        >
          {Math.round(item.amount).toLocaleString("ko-KR")}
          {taped && <span className="nudge__tape" aria-hidden="true" />}
        </span>
      )}
    </div>
  );
}

/** 어느 잔소리가 어느 화면으로 이어지는지 */
const GO: Record<NudgeLink, { label: string; path: string }> = {
  expense: { label: "지출 내역", path: "/entries" },
  pending: { label: "대기 내역", path: "/pending-entries" },
  scheduled: { label: "정기 내역", path: "/scheduled-entries" },
};

export default function NudgeDetailPopup({
  nudge,
  onClose,
  onGo,
}: {
  nudge: Nudge;
  onClose: () => void;
  onGo: (path: string) => void;
}) {
  useBackClose(true, onClose);

  useEffect(() => {
    document.documentElement.classList.add("modal-open");
    return () => document.documentElement.classList.remove("modal-open");
  }, []);

  const items = nudge.items ?? [];
  const go = nudge.link ? GO[nudge.link] : null;

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel popup-panel--framed"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="잔소리 상세"
      >
        <header className="popup-head">
          <h3 className="popup-head__title nudge-detail__title">{nudge.say}</h3>
        </header>

        <div className="popup-body nudge-detail">
          {nudge.meta && <p className="nudge-detail__meta">{nudge.meta}</p>}

          <div className="nudge-detail__list">
            {items.map((it) => (
              <DetailRow key={it.key} item={it} />
            ))}
          </div>
        </div>

        <div className="btn-row popup-foot">
          {go && (
            <button
              className="ui-btn nudge-detail__go"
              onClick={() => onGo(go.path)}
              aria-label={`${go.label}(으)로 가기`}
              title={go.label}
            >
              <span className="nudge-detail__go-icon" aria-hidden="true">
                {PAGE_ICON[go.path]}
              </span>
              <span className="nudge-detail__go-arrow" aria-hidden="true">
                <svg
                  viewBox="0 0 32 32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 16h13M17 11l5 5-5 5" />
                </svg>
              </span>
            </button>
          )}
          <button className="ui-btn nudge-detail__close" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
