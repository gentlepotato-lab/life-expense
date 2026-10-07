import { useCallback, useRef, useState } from "react";
import axios from "../../api/client";
import useBackClose from "../../hooks/useBackClose";
import useListFit from "../../hooks/useListFit";
import GroupAddPopup from "./GroupAddPopup";
import GroupItemList, { type GroupMeta } from "./GroupItemList";
import { EditField } from "./CardEditModal";
import { ask, say } from "../../utils/notify";
import { apiErrorMessage } from "../../utils/apiError";
import { type EntryGroup } from "../../utils/groups";

/** 고쳐 적는다는 표시. 쉬고 있는 이름과 메모 끝에 붙는다. */
function PenMark() {
  return (
    <span className="mk-read__pen" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
           strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" />
      </svg>
    </span>
  );
}

/**
 * 묶음 — 담긴 내역을 보고, 이름과 메모를 고치고, 더 담거나 뺀다.
 *
 * 이름과 메모는 쉬고 있을 때 글로 서고 누르면 그 자리가 입력칸이 된다.
 * 처음부터 칸으로 두면 고칠 일이 없는데도 고치는 자리처럼 보인다. 칸과 글의
 * 키가 같아 바뀌는 순간에도 아래가 들썩이지 않는다.
 *
 * [묶음 풀기]는 묶음만 없애고 담겨 있던 내역은 그대로 둔다.
 * [묶음에서 빼기]는 선택한 것만 푼다 — `해제`는 이 앱에서 고른 것을 푼다는
 * 뜻으로 이미 쓰고 있어, 하는 일을 그대로 적었다.
 */
export default function GroupPopup({
  group,
  meta,
  ym,
  onChanged,
  onClose,
}: {
  group: EntryGroup;
  meta: GroupMeta;
  /** 내역 추가가 처음 보여 줄 달 */
  ym: string;
  /** 담긴 것이 바뀌었다 — 연 쪽이 다시 받아 온다. */
  onChanged: () => void;
  onClose: () => void;
}) {


  const [editName, setEditName] = useState(false);
  const [editMemo, setEditMemo] = useState(false);
  const [name, setName] = useState(group.name);
  const [memo, setMemo] = useState(group.memo ?? "");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const 목록 = useRef<HTMLDivElement | null>(null);
  useListFit(목록, group.items.length);

  /* 고쳐 놓고 아직 담지 않은 것이 있는지. 담긴 것과 글자만 견준다. */
  const 고친것 =
    name.trim() !== group.name.trim() || memo.trim() !== (group.memo ?? "").trim();

  /* 담지 않은 채로 닫으면 고친 것이 소리 없이 사라진다. 한 번 묻는다. */
  const 닫기 = async () => {
    if (!고친것) {
      onClose();
      return;
    }
    const 예 = await ask({
      title: "고친 것 버리기",
      body: "담지 않은 이름이나 메모가 있습니다.",
      go: "버리고 닫기",
      danger: true,
    });
    if (예) onClose();
  };

  useBackClose(true, 닫기);

  const togglePick = useCallback((id: number) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /**
   * 이름과 메모를 담는다.
   *
   * 칸을 벗어날 때 곧바로 담던 것을 [저장]으로 옮겼다. 글자를 고치자마자
   * 담기면 고치던 중에 손이 빗나가도 그대로 남아, 무엇이 담겼는지 알 수
   * 없었다. 담는 때를 누르는 사람이 정하는 쪽이 맞다.
   *
   * 담고 나면 닫는다 — 이 앱의 다른 [저장]이 모두 그렇다.
   */
  const save = async () => {
    if (busy) return;
    if (!name.trim()) {
      say.warn("묶음 이름을 적어 주세요.");
      return;
    }
    if (!고친것) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      await axios.patch(`/entry-groups/${group.group_id}`, {
        name: name.trim(),
        memo: memo.trim(),
      });
      say.ok("저장 완료-!! ;-)");
      onChanged();
      onClose();
    } catch (err: unknown) {
      say.bad(apiErrorMessage(err, "담지 못했습니다."));
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (busy) return;
    const yes = await ask({
      title: "묶음 풀기",
      body: `"${group.name}" 묶음을 풉니다.`,
      warn: "담겨 있던 내역은 지워지지 않습니다.",
      go: "묶음 풀기",
    });
    if (!yes) return;
    setBusy(true);
    try {
      await axios.delete(`/entry-groups/${group.group_id}`);
      say.ok("묶음을 풀었습니다.");
      onChanged();
      onClose();
    } catch (err: unknown) {
      say.bad(apiErrorMessage(err, "풀지 못했습니다."));
    } finally {
      setBusy(false);
    }
  };

  const removePicked = async () => {
    if (busy) return;
    if (picked.size === 0) {
      say.warn("뺄 내역을 선택해 주세요.");
      return;
    }
    setBusy(true);
    try {
      await axios.post(`/entry-groups/${group.group_id}/items/remove`, { ids: [...picked] });
      say.ok(`${picked.size}건을 뺐습니다.`);
      setPicked(new Set());
      onChanged();
    } catch (err: unknown) {
      say.bad(apiErrorMessage(err, "빼지 못했습니다."));
    } finally {
      setBusy(false);
    }
  };

  const 합계 = Math.abs(group.net).toLocaleString("ko-KR");
  const 부호 = group.net > 0 ? "plus" : group.net < 0 ? "minus" : "zero";

  return (
    <>
      <div className="popup-overlay" onClick={닫기}>
        <div
          className="popup-panel popup-panel--framed"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="묶음"
        >
          <header className="popup-head">
            <h3 className="popup-head__title">
              묶음
            </h3>
            <span className="date-group__meta">
              <span className="date-group__count">{group.count}</span>
              <span className={`date-group__sum ${부호}`}>
                {group.net > 0 ? "+" : group.net < 0 ? "−" : ""}
                {합계}
              </span>
            </span>
          </header>

          <div className="popup-body edit-grid">
            <EditField label="이름" span={12} required>
              {editName ? (
                <input
                  className="ui-input"
                  value={name}
                  maxLength={60}
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setEditName(false)}
                />
              ) : (
                <button
                  type="button"
                  className="mk-read mk-read--name"
                  onClick={() => setEditName(true)}
                  title="눌러서 고치기"
                >
                  {name}
                  <PenMark />
                </button>
              )}
            </EditField>

            <EditField label="메모" span={12}>
              {editMemo ? (
                <input
                  className="ui-input mk-memo-in"
                  value={memo}
                  maxLength={200}
                  autoFocus
                  onChange={(e) => setMemo(e.target.value)}
                  onBlur={() => setEditMemo(false)}
                />
              ) : (
                <button
                  type="button"
                  className="mk-read mk-read--memo"
                  onClick={() => setEditMemo(true)}
                  title="눌러서 고치기"
                >
                  {memo || "(메모 없음)"}
                  <PenMark />
                </button>
              )}
            </EditField>
          </div>

          <div className="popup-body" style={{ paddingTop: 0 }}>
            <div className="mk-list" ref={목록}>
              {group.items.length === 0 ? (
                <p className="page-empty">담긴 내역이 없습니다.</p>
              ) : (
                <GroupItemList
                  items={group.items}
                  meta={meta}
                  kind={group.kind}
                  picked={picked}
                  onTogglePick={togglePick}
                />
              )}
            </div>
            <button
              type="button"
              className="set-add-btn"
              style={{ marginTop: 8 }}
              onClick={() => setAddOpen(true)}
            >
              <span className="set-add-btn__mark" aria-hidden="true">
                +
              </span>
              내역 추가
            </button>
          </div>

          {/* 다른 팝업과 같은 차례로 — 되돌리는 것, 닫기, 하려던 것 */}
          <div className="btn-row popup-foot mk-foot">
            <button type="button" className="ui-btn" onClick={unlink} disabled={busy}>
              묶음 풀기
            </button>
            <button type="button" className="ui-btn" onClick={removePicked} disabled={busy}>
              묶음에서 빼기
            </button>
            <button type="button" className="ui-btn" onClick={닫기} disabled={busy}>
              닫기
            </button>
            <button type="button" className="ui-btn primary" onClick={save} disabled={busy}>
              저장
            </button>
          </div>
        </div>
      </div>

      {addOpen && (
        <GroupAddPopup
          groupId={group.group_id}
          kind={group.kind}
          ym={ym}
          meta={meta}
          onDone={() => {
            setAddOpen(false);
            onChanged();
          }}
          onClose={() => setAddOpen(false)}
        />
      )}
    </>
  );
}
