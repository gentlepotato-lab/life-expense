import { useRef, useState } from "react";
import axios from "../../api/client";
import useBackClose from "../../hooks/useBackClose";
import useListFit from "../../hooks/useListFit";
import { EditField } from "./CardEditModal";
import GroupItemList, { type GroupMeta } from "./GroupItemList";
import { say } from "../../utils/notify";
import { apiErrorMessage } from "../../utils/apiError";
import type { GroupItem, GroupKind } from "../../utils/groups";

/**
 * 묶기 — 고른 내역을 한 덩이로 만든다.
 *
 * 영수증과 같은 걸음이다. 카드를 골라 아래 막대에서 [묶기]를 누르면 이것이
 * 뜨고, 이름을 적어 묶는다. 여기서 보이는 목록은 고른 그것들이라 고르는
 * 상자를 다시 세우지 않는다 — 잘못 골랐으면 닫고 다시 고르면 된다.
 */
export default function GroupMakePopup({
  kind,
  items,
  meta,
  onDone,
  onClose,
}: {
  kind: GroupKind;
  items: GroupItem[];
  meta: GroupMeta;
  onDone: () => void;
  onClose: () => void;
}) {
  useBackClose(true, onClose);
  const [name, setName] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const 목록 = useRef<HTMLDivElement | null>(null);
  useListFit(목록, items.length);

  const save = async () => {
    if (saving) return;
    if (!name.trim()) {
      say.warn("묶음 이름을 적어 주세요.");
      return;
    }
    setSaving(true);
    try {
      await axios.post("/entry-groups", {
        name: name.trim(),
        memo: memo.trim() || null,
        kind,
        ids: items.map((r) => r.entry_id),
      });
      say.ok("묶었습니다.");
      onDone();
    } catch (err: unknown) {
      say.bad(apiErrorMessage(err, "묶지 못했습니다."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel popup-panel--framed"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="묶기"
      >
        <header className="popup-head">
          <h3 className="popup-head__title">묶기</h3>
        </header>

        <div className="popup-body edit-grid">
          <EditField label="이름" span={12} required>
            <input
              className="ui-input"
              value={name}
              placeholder="(제주 여행)"
              maxLength={60}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </EditField>
          <EditField label="메모" span={12}>
            <input
              className="ui-input"
              value={memo}
              maxLength={200}
              onChange={(e) => setMemo(e.target.value)}
            />
          </EditField>
        </div>

        <div className="popup-body" style={{ paddingTop: 0 }}>
          <p className="mk-note">아래 내역을 묶습니다.</p>
          <div className="mk-list" ref={목록}>
            <GroupItemList items={items} meta={meta} kind={kind} />
          </div>
        </div>

        <div className="btn-row popup-foot">
          <button type="button" className="ui-btn" onClick={onClose}>
            닫기
          </button>
          <button type="button" className="ui-btn primary" onClick={save} disabled={saving}>
            묶기
          </button>
        </div>
      </div>
    </div>
  );
}
