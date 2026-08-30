import { useState } from "react";
import useBackClose from "../../hooks/useBackClose";
import SingleSelect from "./SingleSelect";
import { EditField } from "./CardEditModal";
import { monthOptions, type Period } from "../../utils/placeBoard";

/**
 * 어디 쓰나의 기간 고르개.
 *
 * 달 단위로만 고른다 — 어느 동네를 다녔는지는 달로 보면 되고, 날짜까지
 * 고르게 하면 고르는 일이 셈보다 번거로워진다.
 *
 * 고르는 동안에는 팝업 안에서만 바뀌고, [적용] 을 눌러야 화면이 다시 받아
 * 온다. 달을 하나 옮길 때마다 500곳을 다시 받아 오면 손이 무겁다.
 */
export default function PlacePeriodPopup({
  span,
  period,
  onApply,
  onClose,
}: {
  /** 고를 수 있는 앞뒤 달 — 적어 둔 것이 있는 만큼만 */
  span: { from: string | null; to: string | null };
  period: Period;
  onApply: (next: Period) => void;
  onClose: () => void;
}) {
  useBackClose(true, onClose);
  const [draft, setDraft] = useState<Period>(period);

  const months = monthOptions(span.from, span.to);
  const all = { value: "", label: "(전체)" };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel popup-panel--framed"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="기간"
      >
        <header className="popup-head">
          <h3 className="popup-head__title">기간</h3>
        </header>

        <div className="popup-body edit-grid">
          <EditField label="시작월" span={6}>
            <SingleSelect
              noun="달"
              options={[all, ...months]}
              selected={draft.since}
              placeholder="(전체)"
              onChange={(v) => setDraft({ ...draft, since: v })}
            />
          </EditField>

          <EditField label="종료월" span={6}>
            <SingleSelect
              noun="달"
              options={[all, ...months]}
              selected={draft.until}
              placeholder="(전체)"
              onChange={(v) => setDraft({ ...draft, until: v })}
            />
          </EditField>
        </div>

        <div className="btn-row popup-foot popup-foot--tight">
          <button className="ui-btn" onClick={() => setDraft({ since: "", until: "" })}>
            초기화
          </button>
          <button
            className="ui-btn primary"
            onClick={() => {
              /* 거꾸로 골랐으면 서버가 물리기 전에 여기서 바로잡는다. */
              const [a, b] =
                draft.since && draft.until && draft.since > draft.until
                  ? [draft.until, draft.since]
                  : [draft.since, draft.until];
              onApply({ since: a, until: b });
            }}
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
