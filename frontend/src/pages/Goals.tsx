import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../api/client";
import { apiErrorMessage } from "../utils/apiError";
import SingleSelect from "./components/SingleSelect";
import QuickActions from "./components/QuickActions";
import NudgeDetailPopup from "./components/NudgeDetailPopup";
import useLongPress from "../hooks/useLongPress";
import type { Nudge } from "../utils/nudges";
import { useGoalBoard } from "../hooks/useNudges";
import { invalidateNudges } from "../hooks/useNudges";
import { standsOf, type GoalStand } from "../utils/goalStand";
import { manwon } from "../utils/amount";
import { visible } from "../utils/visible";

/**
 * 안쓴이 도전 — 분류에 목표 금액을 걸고 이번 달을 견준다.
 *
 * 지출에 거는 목표라 덜 쓰면 이긴다. 모든 분류에 걸 필요는 없고, 지켜보고
 * 싶은 것만 골라 건다.
 *
 * 세는 잣대와 걸러 내기는 잔소리와 한 벌을 쓴다(useGoalBoard). 두 화면이
 * 같은 달을 두고 다른 숫자를 말하면 그게 제일 나쁘다.
 */

type Cat = { id: number; name: string; is_active?: number };
type Cat2 = Cat & { cat1_id: number };
type Cat3 = Cat & { cat2_id: number };

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

/** 막대와 글씨의 결 — 넘겼는지, 넘길 낌새인지, 잘 지키는 중인지 */
function toneOf(st: GoalStand): "over" | "watch" | "safe" {
  if (st.over) return "over";
  if (st.willOver) return "watch";
  return "safe";
}

/**
 * 꾹 눌렀을 때 펼칠 것 — 그 목표에 든 내역 낱낱.
 *
 * 잔소리 상세와 같은 팝업(NudgeDetailPopup)을 쓴다. 보여 줄 것이 똑같은데
 * 화면마다 다른 상자를 두면 손이 헷갈린다. 그래서 잔소리 한 줄의 꼴에
 * 맞춰 넘긴다.
 */
function detailOf(
  st: GoalStand,
  catPath: (r: { cat1_id?: number | null; cat2_id?: number | null; cat3_id?: number | null }) => string,
  masked: Set<string>
): Nudge {
  return {
    key: `goal-${st.goal.goal_id}`,
    level: st.over ? "bad" : st.willOver ? "watch" : "good",
    say: st.goal.path,
    meta: `이번 달 ${won(st.spent)} · ${st.rows.length}건 · 목표 ${manwon(st.goal.amount)}`,
    blur: st.rows.some((r) => masked.has(r.key)),
    items: [...st.rows]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((r) => ({
        key: r.key,
        date: r.date,
        cat: catPath(r),
        memo: (r.place_name ?? "").trim() || (r.memo ?? "").trim() || undefined,
        amount: r.net,
        blur: masked.has(r.key),
      })),
    link: "expense",
  };
}

/** 목표 한 줄. 꾹 누르기를 걸어야 해서 따로 떼어 둔다 */
function GoalRowView({
  st,
  editMode,
  draft,
  memoDraft,
  onDraft,
  onMemoDraft,
  onRemove,
  onPick,
}: {
  st: GoalStand;
  editMode: boolean;
  draft: string;
  memoDraft: string;
  onDraft: (v: string) => void;
  onMemoDraft: (v: string) => void;
  onRemove: () => void;
  onPick: () => void;
}) {
  const { pressing, handlers } = useLongPress(onPick, {
    disabled: editMode || st.rows.length === 0,
  });
  const tone = toneOf(st);

  return (
    <div
      className={`goal-row goal-row--${tone}${pressing ? " is-pressing" : ""}`}
      {...handlers}
    >
      <div className="goal-row__head">
        <span className="goal-row__path">
          {st.goal.emoji && <span className="goal-row__emoji">{st.goal.emoji}</span>}
          {st.goal.path}
        </span>

        {editMode ? (
          <input
            type="number"
            className="amount-input goal-row__amount"
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
          />
        ) : (
          <span className="goal-row__amount goal-row__amount--text">
            {Math.round(st.goal.amount).toLocaleString("ko-KR")}
          </span>
        )}
        <span className="goal-row__unit">원</span>

        {editMode && (
          <button
            type="button"
            className="set-remove"
            aria-label={`${st.goal.path} 목표 제거`}
            onClick={onRemove}
          >
            ×
          </button>
        )}
      </div>

      {(editMode || memoDraft) && (
        <input
          type="text"
          className="memo-input goal-row__memo"
          placeholder="(메모)"
          readOnly={!editMode}
          value={memoDraft}
          onChange={(e) => onMemoDraft(e.target.value)}
        />
      )}

      <div className="goal-bar">
        <span
          className="goal-bar__fill"
          style={{ width: `${Math.min(100, Math.round(st.ratio * 100))}%` }}
        />
      </div>

      <div className="goal-row__foot">
        <span className="goal-row__spent">
          {won(st.spent)} / {manwon(st.goal.amount)}
        </span>
        <span className="goal-row__left">
          {st.over
            ? `${won(-st.left)} 넘겼습니다.`
            : st.willOver
              ? `이대로면 ${won(st.pace)}`
              : `${won(st.left)} 남았습니다.`}
        </span>
      </div>
    </div>
  );
}

export default function Goals() {
  /* 한 건 고치면 셈이 달라진다 — 그때만 다시 받는다 */
  const [reloadKey, setReloadKey] = useState(0);
  const { goals, rows, masked, today, catPath, ready } = useGoalBoard({ reloadKey });

  /* 꾹 눌러 펼친 목표 */
  const [picked, setPicked] = useState<Nudge | null>(null);
  const navigate = useNavigate();

  /* 팝업이 뒤로 가기용 자리를 하나 밀어 두고 있다. 그냥 옮기면 그 자리를
     되감으면서 방금 연 화면에서 튕겨 나온다 — 잔소리 화면과 같은 처리다. */
  const goAfterClose = (path: string) => {
    const onPop = () => {
      window.removeEventListener("popstate", onPop);
      window.setTimeout(() => navigate(path), 0);
    };
    window.addEventListener("popstate", onPop);
    window.history.back();
  };

  const [editMode, setEditMode] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  /* 새로 걸 목표 */
  const [cat1, setCat1] = useState("");
  const [cat2, setCat2] = useState("");
  const [cat3, setCat3] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  /* 고르는 목록 — 분류 세 벌 */
  const [cat1List, setCat1List] = useState<Cat[]>([]);
  const [cat2List, setCat2List] = useState<Cat2[]>([]);
  const [cat3List, setCat3List] = useState<Cat3[]>([]);

  useEffect(() => {
    axios.get("/categories/lvl1").then((r) => setCat1List(r.data)).catch(() => setCat1List([]));
    axios.get("/categories/lvl2").then((r) => setCat2List(r.data)).catch(() => setCat2List([]));
    axios.get("/categories/lvl3").then((r) => setCat3List(r.data)).catch(() => setCat3List([]));
  }, []);

  /* 금액 칸은 화면이 들고 있다가 칸을 떠날 때 그 줄만 저장한다 —
     연회비와 같은 방식이다 */
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [memoDraft, setMemoDraft] = useState<Record<number, string>>({});
  useEffect(() => {
    setDraft(Object.fromEntries(goals.map((g) => [g.goal_id, String(g.amount)])));
    setMemoDraft(Object.fromEntries(goals.map((g) => [g.goal_id, g.memo ?? ""])));
  }, [goals]);

  const stands = useMemo(
    () => (ready ? standsOf(goals, rows, today) : []),
    [ready, goals, rows, today]
  );

  const again = () => {
    invalidateNudges();
    setReloadKey((k) => k + 1);
  };

  const add = async () => {
    try {
      await axios.post("/goals", {
        cat1_id: cat1 || null,
        cat2_id: cat2 || null,
        cat3_id: cat3 || null,
        amount,
        memo,
      });
      setCat1("");
      setCat2("");
      setCat3("");
      setAmount("");
      setMemo("");
      setAddOpen(false);
      again();
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  };

  /* 다른 설정 화면처럼 고친 것은 [저장] 을 눌러야 담긴다.
     칸을 떠나자마자 보내면 편집 모드가 있는 뜻이 없다 */
  const saveAmount = async (goalId: number, value: string) => {
    const before = goals.find((g) => g.goal_id === goalId);
    if (!before || String(before.amount) === value.trim()) return;
    try {
      await axios.post(`/goals/${goalId}/amount`, { amount: value });
      again();
    } catch (err) {
      alert(apiErrorMessage(err));
      setDraft((d) => ({ ...d, [goalId]: String(before.amount) }));
    }
  };

  const saveMemo = async (goalId: number, value: string) => {
    const before = goals.find((g) => g.goal_id === goalId);
    if (!before || (before.memo ?? "") === value.trim()) return;
    try {
      await axios.post(`/goals/${goalId}/memo`, { memo: value });
      again();
    } catch (err) {
      alert(apiErrorMessage(err));
      setMemoDraft((d) => ({ ...d, [goalId]: before.memo ?? "" }));
    }
  };

  /* 고친 금액을 모아 보내고 편집을 닫는다.
     칸을 떠날 때 이미 보낸 것은 값이 같으니 그냥 지나간다 */
  const saveAll = async () => {
    const amountChanged = goals.filter((g) => {
      const v = draft[g.goal_id];
      return v != null && v.trim() !== "" && Number(v) !== g.amount;
    });
    const memoChanged = goals.filter((g) => {
      const m = memoDraft[g.goal_id];
      return m != null && m.trim() !== (g.memo ?? "");
    });

    /* 손댄 것이 없으면 다른 설정 화면과 같은 말로 알린다 */
    if (amountChanged.length === 0 && memoChanged.length === 0) {
      alert("변경된 내용이 없습니다만...?");
      setEditMode(false);
      return;
    }

    for (const g of amountChanged) await saveAmount(g.goal_id, draft[g.goal_id]);
    for (const g of memoChanged) await saveMemo(g.goal_id, memoDraft[g.goal_id]);
    setEditMode(false);
  };

  const remove = async (goalId: number, path: string) => {
    if (!window.confirm(`${path} 목표를 지울까요?`)) return;
    try {
      await axios.delete(`/goals/${goalId}`);
      again();
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  };

  /* 고른 중분류 아래의 것만. 감춘 분류는 새로 고를 때 빼는 기존 규칙 그대로다 */
  const cat2Options = visible(cat2List).filter((c) => String(c.cat1_id) === cat1);
  const cat3Options = visible(cat3List).filter((c) => String(c.cat2_id) === cat2);

  return (
    <div className="page-wrap">
      <div className="cat-toolbar goal-toolbar">
        <div className="cat-toolbar-btns">
          <div className="btn-row">
            <button
              className="ui-btn primary"
              onClick={() => (editMode ? saveAll() : setEditMode(true))}
            >
              {editMode ? "저장" : "편집"}
            </button>
          </div>
        </div>
      </div>

      <div className="cat-card">
        <div className="set-add-bar">
          <button
            type="button"
            className={`set-add-btn ${addOpen ? "on" : ""}`}
            onClick={() => setAddOpen((v) => !v)}
          >
            <span className="set-add-btn__mark" aria-hidden="true">+</span>
            새 목표 추가
          </button>
        </div>

        {addOpen && (
          <div className="set-add-form set-add-form--col set-draft">
            <div className="set-draft__head">
              <span className="set-draft__name">새 목표</span>
            </div>

            <div className="goal-add__row">
              <div className="goal-add__cat">
                <SingleSelect
                  noun="중분류"
                  placeholder="(중분류)"
                  options={visible(cat1List).map((c) => ({ value: String(c.id), label: c.name }))}
                  selected={cat1}
                  onChange={(v) => {
                    setCat1(v);
                    setCat2("");
                    setCat3("");
                  }}
                />
              </div>

              {/* 아래 두 칸은 처음부터 자리를 지킨다 — 중분류를 고를 때마다
                  칸이 생겼다 없어졌다 하면 줄이 들썩인다 */}
              <div className="goal-add__cat">
                <SingleSelect
                  noun="소분류"
                  placeholder="(소분류)"
                  options={[
                    { value: "", label: "(중분류 전체)" },
                    ...cat2Options.map((c) => ({ value: String(c.id), label: c.name })),
                  ]}
                  selected={cat2}
                  onChange={(v) => {
                    setCat2(v);
                    setCat3("");
                  }}
                />
              </div>

              <div className="goal-add__cat">
                <SingleSelect
                  noun="세분류"
                  placeholder="(세분류)"
                  options={[
                    { value: "", label: "(소분류 전체)" },
                    ...cat3Options.map((c) => ({ value: String(c.id), label: c.name })),
                  ]}
                  selected={cat3}
                  onChange={setCat3}
                />
              </div>
            </div>

            <div className="goal-add__row">
              <input
                type="text"
                className="memo-input goal-add__memo"
                placeholder="(메모)"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
              <input
                type="number"
                className="amount-input"
                placeholder="(목표 금액)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <span className="goal-add__unit">원</span>
              <button className="ui-btn" onClick={add}>추가</button>
            </div>
          </div>
        )}

        {!ready && <div className="page-empty">세어 보는 중입니다.</div>}
        {ready && stands.length === 0 && (
          <div className="page-empty">아직 설정한 목표가 없습니다.</div>
        )}

        {stands.map((st) => (
          <GoalRowView
            key={st.goal.goal_id}
            st={st}
            editMode={editMode}
            draft={draft[st.goal.goal_id] ?? ""}
            memoDraft={memoDraft[st.goal.goal_id] ?? ""}
            onDraft={(v) => setDraft((d) => ({ ...d, [st.goal.goal_id]: v }))}
            onMemoDraft={(v) => setMemoDraft((d) => ({ ...d, [st.goal.goal_id]: v }))}
            onRemove={() => remove(st.goal.goal_id, st.goal.path)}
            onPick={() => setPicked(detailOf(st, catPath, masked))}
          />
        ))}
      </div>

      {picked && (
        <NudgeDetailPopup
          nudge={picked}
          onClose={() => setPicked(null)}
          onGo={goAfterClose}
        />
      )}

      <QuickActions onSaved={again} />
    </div>
  );
}
