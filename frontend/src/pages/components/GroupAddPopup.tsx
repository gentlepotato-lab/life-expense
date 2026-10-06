import { useCallback, useEffect, useState } from "react";
import axios from "../../api/client";
import useBackClose from "../../hooks/useBackClose";
import GroupItemList, { type GroupMeta } from "./GroupItemList";
import { say } from "../../utils/notify";
import { apiErrorMessage } from "../../utils/apiError";
import { KIND_NAME, type GroupItem, type GroupKind } from "../../utils/groups";

/** 'YYYY-MM'을 달만큼 옮긴다. */
function shiftYm(ym: string, step: number): string {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7)) + step;
  const d = new Date(y, m - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 내역 추가 — 이미 적어 둔 내역 가운데 골라 묶음에 담는다.
 *
 * 새로 적는 자리가 아니다. 그래서 달을 옮겨 가며 훑고, 분류나 장소나 결제
 * 수단이나 메모로 찾는다. 보이는 것은 같은 갈래이면서 아직 어느 묶음에도
 * 들지 않은 것뿐이다 — 한 건이 두 묶음에 들면 합계가 두 번 셈해진다.
 *
 * 거르는 일은 서버가 한다. 달 하나가 수백 건이라 다 받아 와 화면에서 거르면
 * 팝업이 뜨는 데만 한참 걸린다.
 */
export default function GroupAddPopup({
  groupId,
  kind,
  ym,
  meta,
  onDone,
  onClose,
}: {
  groupId: number;
  kind: GroupKind;
  /** 처음 보여 줄 달. 정기 내역은 달이 없어 쓰지 않는다. */
  ym: string;
  meta: GroupMeta;
  onDone: () => void;
  onClose: () => void;
}) {
  useBackClose(true, onClose);

  const [month, setMonth] = useState(ym);
  const [typed, setTyped] = useState("");
  const [find, setFind] = useState("");
  const [rows, setRows] = useState<GroupItem[]>([]);
  const [ready, setReady] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const byMonth = kind !== "scheduled";

  const load = useCallback(() => {
    setReady(false);
    axios
      .get("/entry-groups/candidates", {
        params: { kind, ym: byMonth ? month : undefined, q: find || undefined },
      })
      .then((r) => setRows(r.data))
      .catch((err: unknown) => {
        setRows([]);
        say.warn(apiErrorMessage(err, "내역을 불러오지 못했습니다."));
      })
      .finally(() => setReady(true));
  }, [kind, byMonth, month, find]);

  useEffect(load, [load]);

  const togglePick = useCallback((id: number) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const save = async () => {
    if (saving) return;
    if (picked.size === 0) {
      say.warn("담을 내역을 선택해 주세요.");
      return;
    }
    setSaving(true);
    try {
      await axios.post(`/entry-groups/${groupId}/items`, { ids: [...picked] });
      say.ok(`${picked.size}건을 담았습니다.`);
      onDone();
    } catch (err: unknown) {
      say.bad(apiErrorMessage(err, "담지 못했습니다."));
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
        aria-label="내역 추가"
      >
        <header className="popup-head">
          <h3 className="popup-head__title">내역 추가</h3>
          {picked.size > 0 && (
            <span className="date-group__meta">
              <span className="date-group__count">{picked.size}</span>
            </span>
          )}
        </header>

        <div className="popup-body">
          {byMonth && (
            <div className="mk-month">
              <button
                type="button"
                className="ui-btn"
                aria-label="이전 달"
                onClick={() => setMonth((m) => shiftYm(m, -1))}
              >
                ‹
              </button>
              <span className="mk-month__label">
                {Number(month.slice(0, 4))}년 {Number(month.slice(5, 7))}월
              </span>
              <button
                type="button"
                className="ui-btn"
                aria-label="다음 달"
                onClick={() => setMonth((m) => shiftYm(m, 1))}
              >
                ›
              </button>
            </div>
          )}

          <div className="mk-find">
            <input
              className="ui-input"
              value={typed}
              placeholder="(찾기 — 분류, 장소, 결제 수단, 메모)"
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

          <p className="mk-note">
            아직 어느 묶음에도 들지 않은 {KIND_NAME[kind]}만 보입니다.
          </p>

          <div className="mk-list">
            {!ready ? (
              <p className="page-empty">불러오는 중입니다.</p>
            ) : rows.length === 0 ? (
              <p className="page-empty">담을 수 있는 내역이 없습니다.</p>
            ) : (
              <GroupItemList items={rows} meta={meta} picked={picked} onTogglePick={togglePick} />
            )}
          </div>
        </div>

        <div className="btn-row popup-foot">
          <button type="button" className="ui-btn" onClick={onClose}>
            닫기
          </button>
          <button type="button" className="ui-btn primary" onClick={save} disabled={saving}>
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
