import { useState } from "react";
import useBackClose from "../../hooks/useBackClose";
import MonthPicker from "./MonthPicker";
import { EditField } from "./CardEditModal";
import { type Period } from "../../utils/placeBoard";
import { ymNow } from "../../utils/schedule";

/**
 * 어디 쓰나의 기간 고르개.
 *
 * 달 단위로만 고른다 — 어느 동네를 다녔는지는 달로 보면 되고, 날짜까지
 * 고르게 하면 고르는 일이 셈보다 번거로워진다.
 *
 * 고르는 동안에는 팝업 안에서만 바뀌고, [적용]을 눌러야 화면이 다시 받아
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

  /* 여기서는 달을 'YYYY-MM'으로 들고 다니고, 고르개는 'YYYYMM'을 주고받는다.
     고르개 쪽을 고치지 않고 이 자리에서 맞춘다 — 날짜를 적는 꼴은 화면마다
     사정이 있어, 고르개가 그 사정을 다 알게 하면 곧 지저분해진다. */
  const 붙이기 = (v: string) => v.replace("-", "");
  const 떼기 = (v: string) => (v ? `${v.slice(0, 4)}-${v.slice(4)}` : "");

  /* 고를 수 있는 앞뒤 끝 — 적어 둔 것이 있는 만큼만.
     다만 뒤끝은 이번 달까지 열어 둔다. 적어 둔 마지막 달이 지난달이면
     처음 보이는 기간(최근 석 달)의 끝달이 잠겨, 칸에는 "2026년 10월"이
     적혀 있는데 그 10월을 다시 고를 수 없는 꼴이 된다. */
  const 이번달 = ymNow();
  const min = span.from ? 붙이기(span.from) : undefined;
  const max = span.to ? (붙이기(span.to) < 이번달 ? 이번달 : 붙이기(span.to)) : undefined;

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
            <MonthPicker
              value={붙이기(draft.since)}
              min={min}
              max={max}
              placeholder="(전체)"
              clearable
              clearLabel="전체"
              onChange={(v) => setDraft({ ...draft, since: 떼기(v) })}
            />
          </EditField>

          <EditField label="종료월" span={6}>
            <MonthPicker
              value={붙이기(draft.until)}
              min={min}
              max={max}
              placeholder="(전체)"
              clearable
              clearLabel="전체"
              onChange={(v) => setDraft({ ...draft, until: 떼기(v) })}
            />
          </EditField>
        </div>

        <div className="btn-row popup-foot popup-foot--tight">
          <button className="ui-btn" onClick={() => setDraft({ since: "", until: "" })}>
            초기화
          </button>
          {/* 다른 팝업과 같은 차례로 — 되돌리는 것 · 닫기 · 하려던 것 */}
          <button className="ui-btn" onClick={onClose}>
            닫기
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
