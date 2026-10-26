import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "../../api/client";
import useBackClose from "../../hooks/useBackClose";
import { EditField } from "./CardEditModal";
import GroupItemList, { type GroupMeta } from "./GroupItemList";
import { say } from "../../utils/notify";
import { apiErrorMessage } from "../../utils/apiError";
import { formatDateLabel } from "../../utils/dateGroup";
import type { EntryGroup, GroupItem, GroupKind } from "../../utils/groups";
import Waiting from "./Waiting";

/**
 * 묶기. 선택한 내역을 한 덩이로 만들거나, 이미 있는 묶음에 넣는다.
 *
 * 영수증과 같은 걸음이다. 카드를 선택해 아래 막대에서 [묶기]를 누르면 이것이
 * 뜬다. 여기서 보이는 목록은 선택한 그것들이라 선택하는 상자를 다시 세우지
 * 않는다. 잘못 선택했으면 닫고 다시 선택하면 된다.
 *
 * 갈래는 제목 줄 오른쪽 끝의 스위치로 가른다. 아래 막대에 단추를 하나 더
 * 두는 쪽은 360px에서 막대가 잘려 쓸 수 없었다(지출 329 → 335, 대기 → 370).
 *
 * 기존 묶음 쪽은 기간을 가리지 않고 모두 보여 준다. 넣으려는 묶음이 지금
 * 보고 있는 달에 걸쳐 있으란 법이 없다. 여행처럼 날이 걸친 묶음은 목록을
 * 어느 달로 두고 보느냐에 따라 보였다 말았다 했다. 찾는 칸이 따로 있으므로
 * 많아도 선택하기 어렵지 않다.
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
  const [mode, setMode] = useState<"new" | "old">("new");
  const [name, setName] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  /* 기존 묶음 쪽 */
  const [groups, setGroups] = useState<EntryGroup[]>([]);
  const [ready, setReady] = useState(false);
  const [선택묶음, set선택묶음] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [find, setFind] = useState("");

  const load = useCallback(() => {
    setReady(false);
    axios
      .get("/entries-groups", {
        params: {
          kind,
          name: find || undefined,
        },
      })
      .then((r) => setGroups(r.data))
      .catch((err: unknown) => {
        setGroups([]);
        say.warn(apiErrorMessage(err, "묶음을 불러오지 못했습니다."));
      })
      .finally(() => setReady(true));
  }, [kind, find]);

  useEffect(() => {
    if (mode !== "old") return;
    load();
  }, [mode, load]);

  /* 이미 다른 묶음에 든 것이 섞였는지. 내역 줄이 묶음 이름까지 이고 오므로
     따로 물어볼 것이 없다. */
  const 든것 = useMemo(() => items.filter((r) => r.group_id != null), [items]);
  const 든묶음 = useMemo(() => {
    const 본것 = new Set<string>();
    for (const r of 든것) {
      const n = r.group_name;
      if (n) 본것.add(n);
    }
    return [...본것];
  }, [든것]);
  const 막힘 = 든것.length > 0;

  const 기간말 = "모든 묶음이 보입니다.";

  const save = async () => {
    if (saving) return;
    if (!name.trim()) {
      say.warn("묶음 이름을 적어 주세요.");
      return;
    }
    setSaving(true);
    try {
      await axios.post("/entries-groups", {
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

  const add = async () => {
    if (saving) return;
    /* 한 건이 두 묶음에 들면 합계가 두 번 계산된다. 조용히 건너뛰지 않고
       어느 묶음에 들어 있는지 대면서 막는다. */
    if (막힘) {
      say.warn(`이미 포함된 묶음이 있습니다. ${든묶음.join(", ")} 묶음에서 제외한 후 다시 추가하세요.`);
      return;
    }
    if (선택묶음 === null) {
      say.warn("추가할 묶음을 선택해 주세요.");
      return;
    }
    setSaving(true);
    try {
      await axios.post(`/entries-groups/${선택묶음}/items`, {
        ids: items.map((r) => r.entry_id),
      });
      say.ok(`${items.length}건을 추가했습니다.`);
      onDone();
    } catch (err: unknown) {
      say.bad(apiErrorMessage(err, "추가하지 못했습니다."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel popup-panel--framed popup-panel--mk"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="묶기"
      >
        <header className="popup-head">
          <h3 className="popup-head__title">묶기</h3>
          <div className="mk-switch" role="group" aria-label="묶는 곳">
            <button
              type="button"
              className={`mk-switch__b${mode === "new" ? " on" : ""}`}
              aria-pressed={mode === "new"}
              onClick={() => setMode("new")}
            >
              새 묶음
            </button>
            <button
              type="button"
              className={`mk-switch__b${mode === "old" ? " on" : ""}`}
              aria-pressed={mode === "old"}
              onClick={() => setMode("old")}
            >
              기존 묶음
            </button>
          </div>
        </header>

        {mode === "new" ? (
          <>
            <div className="popup-body edit-grid">
              <EditField label="이름" span={12} required>
                <input
                  className="ui-input"
                  value={name}
                  placeholder="(묶음)"
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

            <div className="popup-body mk-fill" style={{ paddingTop: 0 }}>
              <p className="mk-note">아래 내역을 묶습니다.</p>
              <div className="mk-list">
                <GroupItemList items={items} meta={meta} kind={kind} />
              </div>
            </div>
          </>
        ) : (
          <div className="popup-body mk-fill">
            {/* 새 묶음의 [이름]과 같은 이름표를 단다. 갈래를 바꿔도 첫 입력칸이
                제자리에 선다. 별표는 적어야 하는 새 묶음에만 붙는다. */}
            <EditField label="이름" span={12}>
              <div className="mk-find">
                <input
                  className="ui-input"
                  value={typed}
                  placeholder="(묶음)"
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setFind(typed.trim());
                    }
                  }}
                />
                <button type="button" className="ui-btn" onClick={() => setFind(typed.trim())}>
                  찾기
                </button>
              </div>
            </EditField>

            <p className="mk-note">{기간말}</p>

            <div className="mk-picklist">
              {!ready ? (
                <Waiting />
              ) : groups.length === 0 ? (
                <p className="page-empty">조회된 묶음이 없습니다.</p>
              ) : (
                groups.map((g) => (
                  <button
                    key={g.group_id}
                    type="button"
                    className={`mk-pickrow${선택묶음 === g.group_id ? " is-on" : ""}`}
                    aria-pressed={선택묶음 === g.group_id}
                    onClick={() => set선택묶음(g.group_id)}
                  >
                    <span className="mk-pickrow__mark">✓</span>
                    <span className="mk-pickrow__title">
                      <span className="mk-pickrow__name">{g.name}</span>
                      <span className="date-group__count">{g.count}</span>
                    </span>
                    <span className="mk-pickrow__meta">
                      <span
                        className={`date-group__sum ${g.net > 0 ? "plus" : g.net < 0 ? "minus" : "zero"}`}
                      >
                        {g.net > 0 ? "+" : g.net < 0 ? "−" : ""}
                        {Math.abs(g.net).toLocaleString("ko-KR")}
                      </span>
                    </span>
                    <span className="mk-pickrow__when">
                      {g.date_from
                        ? g.date_from === g.date_to
                          ? formatDateLabel(g.date_from)
                          : `${formatDateLabel(g.date_from)} ~ ${formatDateLabel(g.date_to ?? g.date_from)}`
                        : "담긴 내역 없음"}
                    </span>
                  </button>
                ))
              )}
            </div>

            <p className="mk-note mk-note--tail">선택한 {items.length}건을 이 묶음에 추가합니다.</p>
            {막힘 && (
              <p className="mk-warn">
                이미 다른 묶음에 든 <b>{든것.length}건</b>이 섞여 있어 추가할 수 없습니다.
              </p>
            )}
          </div>
        )}

        <div className="btn-row popup-foot">
          <button type="button" className="ui-btn" onClick={onClose}>
            닫기
          </button>
          {mode === "new" ? (
            <button type="button" className="ui-btn primary" onClick={save} disabled={saving}>
              묶기
            </button>
          ) : (
            <button
              type="button"
              className="ui-btn primary"
              aria-disabled={막힘 || undefined}
              onClick={add}
              disabled={saving}
            >
              추가
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
