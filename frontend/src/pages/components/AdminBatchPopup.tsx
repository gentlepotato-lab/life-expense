import useBackClose from "../../hooks/useBackClose";
import useScrollLock from "../../hooks/useScrollLock";
import SingleSelect from "./SingleSelect";
import { EditField, EditDivider } from "./CardEditModal";

/**
 * 배치의 도는 때를 고치는 판.
 *
 * 껍데기와 바닥 단추는 공지를 고치는 판과 같다(AdminNoticePopup.tsx).
 * .popup-overlay와 .popup-panel--framed, 칸은 EditField, 바닥은
 * .btn-row.popup-foot이다. 관리자 쪽에서 무엇을 고치든 판 하나로 열어야
 * 손이 헷갈리지 않는다.
 *
 * 묻는 칸은 정기 내역이 묻는 것과 같은 꼴로 둔다(pages/ScheduledEntries.tsx).
 * 날짜는 사용자 사이트의 DayPicker로, 시각은 type="time" 칸으로 받는다. 거기도 「매월 몇 일
 * 몇 시」를 묻는 자리라, 다른 꼴로 물으면 같은 앱으로 읽히지 않는다.
 */

export type 초안 = {
  /** minute | daily | monthly */
  kind: string;
  /** 매월 도는 것만 쓴다. 표가 28일까지만 받는다. 29일부터는 없는 달이 있다. */
  day_of_month: number;
  /** "HH:MM". 매분 도는 것은 쓰지 않는다. */
  time: string;
};

/** 선택할 수 있는 날. 없는 달이 생기지 않도록 28일에서 멈춘다. */
const 날들 = Array.from({ length: 28 }, (_, i) => i + 1);

export default function AdminBatchPopup({
  이름,
  값,
  on바뀜,
  on저장,
  onClose,
}: {
  이름: string;
  값: 초안;
  on바뀜: (next: 초안) => void;
  on저장: () => void;
  onClose: () => void;
}) {
  /* 뒤로 가기로 닫는다. 사용자 화면의 판들과 같다. */
  useBackClose(true, onClose);
  /* 열려 있는 동안 뒤쪽은 구르지 않는다. */
  useScrollLock(true);

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel popup-panel--framed"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${이름} 편집`}
      >
        <header className="popup-head">
          <h3 className="popup-head__title">{이름}</h3>
        </header>

        <div className="popup-body edit-grid">
          <EditField label="주기" span={12} required>
            <SingleSelect
              noun="주기"
              options={[
                { value: "minute", label: "매분" },
                { value: "daily", label: "매일" },
                { value: "monthly", label: "매월" },
              ]}
              selected={값.kind}
              onChange={(v) => on바뀜({ ...값, kind: v })}
              placeholder="(주기)"
            />
          </EditField>

          {/* 매분 도는 일에는 더 물을 것이 없다. 칸을 비우는 대신 아예
              세우지 않는다. 빈 칸이 둘 서면 무엇을 적어야 하는지 헷갈린다. */}
          {값.kind !== "minute" && (
            <>
              <EditDivider />

              {값.kind === "monthly" && (
                <EditField label="날짜" span={6} required>
                  <SingleSelect
                    noun="날짜"
                    options={날들.map((d) => ({ value: String(d), label: `${d}일` }))}
                    selected={String(값.day_of_month)}
                    onChange={(v) => on바뀜({ ...값, day_of_month: Number(v) || 1 })}
                    placeholder="(일)"
                  />
                </EditField>
              )}

              <EditField label="시간" span={값.kind === "monthly" ? 6 : 12} required>
                <input
                  type="time"
                  className="ui-input"
                  step="60"
                  value={값.time}
                  onChange={(e) => on바뀜({ ...값, time: e.target.value })}
                />
              </EditField>

              <EditField label="" span={12}>
                <p className="admin-hint">바꾼 시간은 다음 차례부터 돕니다.</p>
              </EditField>
            </>
          )}
        </div>

        <div className="btn-row popup-foot">
          {/* 사용자 화면의 팝업과 같은 차례다. 닫기 다음에 하려던 것. */}
          <button type="button" className="ui-btn" onClick={onClose}>
            닫기
          </button>
          <button type="button" className="ui-btn primary" onClick={on저장}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
