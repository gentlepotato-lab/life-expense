import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../api/client";
import { apiErrorMessage } from "../utils/apiError";
import useBackClose from "../hooks/useBackClose";
import SingleSelect from "./components/SingleSelect";
import MonthPicker from "./components/MonthPicker";
import MonthNav from "./components/MonthNav";
import useMonthSpan from "../hooks/useMonthSpan";
import QuickActions from "./components/QuickActions";
import useEditLock from "../hooks/useEditLock";
import { EditLockTip } from "./components/EditLock";
import NudgeDetailPopup from "./components/NudgeDetailPopup";
import useLongPress from "../hooks/useLongPress";
import type { Nudge } from "../utils/nudges";
import { useGoalBoard } from "../hooks/useNudges";
import { invalidateNudges } from "../hooks/useNudges";
import { standsOf, 걸린달, 비낀까닭, type GoalStand } from "../utils/goalStand";
import { manwon } from "../utils/amount";
import { visible } from "../utils/visible";
import { say, ask } from "../utils/notify";
/**
 * 안쓴이 도전 — 분류에 도전 금액을 걸고 그 달을 견준다.
 *
 * 지출에 거는 도전이라 덜 쓰면 이긴다. 모든 분류에 걸 필요는 없고, 지켜보고
 * 싶은 것만 골라 건다.
 *
 * 세는 잣대와 걸러 내기는 잔소리와 한 벌을 쓴다(useGoalBoard). 두 화면이
 * 같은 달을 두고 다른 숫자를 말하면 그게 제일 나쁘다.
 */

type Cat = { id: number; name: string; is_active?: number };
type Cat2 = Cat & { cat1_id: number };
type Cat3 = Cat & { cat2_id: number };

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

/** 달 막대에 적는 말 — 지출 내역과 같은 꼴이다. */
const ymLabel = (ym: string) => `${Number(ym.slice(0, 4))}년 ${Number(ym.slice(5, 7))}월`;

/** 그 달의 마지막 날. 지난 달은 이 날을 오늘로 삼아 센다 — 달이 끝났으므로
    "이대로면"이 없고 쓴 돈이 곧 그 달의 결과다. */
const 말일 = (ym: string) => {
  const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
  return `${ym}-${String(d).padStart(2, "0")}`;
};

/** 연월 고르개가 쓰는 꼴('YYYYMM')로. 셈은 'YYYY-MM'을 쓴다. */
const 짧은연월 = (ym: string) => ym.replace("-", "");

/** 고르개가 돌려준 'YYYYMM'을 셈이 쓰는 꼴로. */
const 긴연월 = (ym: string) => `${ym.slice(0, 4)}-${ym.slice(4)}`;

/** 보고 있는 달이 어느 쪽인지 — 할 말이 셋 다 다르다. */
type 달때 = "지난" | "이번" | "올";

/** 막대와 글씨의 결 — 넘겼는지, 넘길 낌새인지, 잘 지키는 중인지 */
function toneOf(st: GoalStand): "over" | "watch" | "safe" {
  if (st.over) return "over";
  if (st.willOver) return "watch";
  return "safe";
}

/**
 * 꾹 눌렀을 때 펼칠 것 — 그 도전에 든 내역 낱낱.
 *
 * 잔소리 상세와 같은 팝업(NudgeDetailPopup)을 쓴다. 보여 줄 것이 똑같은데
 * 화면마다 다른 상자를 두면 손이 헷갈린다. 그래서 잔소리 한 줄의 꼴에
 * 맞춰 넘긴다.
 */
function detailOf(
  st: GoalStand,
  달이름: string,
  catPath: (r: { cat1_id?: number | null; cat2_id?: number | null; cat3_id?: number | null }) => string,
  masked: Set<string>
): Nudge {
  return {
    key: `goal-${st.goal.goal_id}`,
    level: st.over ? "bad" : st.willOver ? "watch" : "good",
    say: st.goal.path,
    meta: `${달이름} ${won(st.spent)} · ${st.rows.length}건 · 도전 ${manwon(st.goal.amount)}`,
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

/** 도전 한 줄. 꾹 누르기를 걸어야 해서 따로 떼어 둔다. */
function GoalRowView({
  st,
  editMode,
  때,
  비낌,
  맨뒤달,
  startDraft,
  endDraft,
  onStartDraft,
  onEndDraft,
  draft,
  memoDraft,
  onDraft,
  onMemoDraft,
  onRemove,
  onPick,
  onLocked,
}: {
  st: GoalStand;
  editMode: boolean;
  /** 보고 있는 달이 지난 달인지, 이번 달인지, 아직 오지 않은 달인지 */
  때: 달때;
  /** 그 달에 걸려 있지 않았다면 왜인지 */
  비낌: "before" | "after" | null;
  /** 시작 연월로 고를 수 있는 맨 뒤 — 앞으로 올 달부터 셀 수는 없다. */
  맨뒤달: string;
  startDraft: string;
  endDraft: string;
  onStartDraft: (v: string) => void;
  onEndDraft: (v: string) => void;
  draft: string;
  memoDraft: string;
  onDraft: (v: string) => void;
  onMemoDraft: (v: string) => void;
  onRemove: () => void;
  onPick: () => void;
  /* 편집이 아닐 때 잠긴 조각을 누르면 왜 안 되는지 알린다. */
  onLocked: (e: React.MouseEvent<HTMLElement>) => void;
}) {
  const { pressing, handlers } = useLongPress(onPick, {
    disabled: editMode || 비낌 !== null || st.rows.length === 0,
  });
  const tone = toneOf(st);

  /* 언제부터 언제까지인지를 읽기만 할 때 적는 한 줄 */
  const 기간 = `${ymLabel(st.goal.start_ym)}부터${
    st.goal.end_ym ? ` ${ymLabel(st.goal.end_ym)}까지` : ""
  }`;

  return (
    <div
      className={`goal-row goal-row--${tone}${pressing ? " is-pressing" : ""}${
        비낌 ? " goal-row--wait" : ""
      }`}
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
      </div>

      {/* 한마디와 기간은 읽기만 되는 꼴로 늘 세운다 — 편집에 들어갈 때 줄이
          생기면 카드가 커지면서 아래 것들이 모두 내려앉는다. 적은 것이 없으면
          안내 글씨도 음영도 지워 빈 줄로 둔다. */}
      <input
        type="text"
        className={`memo-input goal-row__memo${memoDraft ? " has-memo" : ""}`}
        placeholder={editMode ? "(메모)" : ""}
        readOnly={!editMode}
        aria-disabled={!editMode || undefined}
        value={memoDraft}
        onChange={(e) => onMemoDraft(e.target.value)}
        onClick={!editMode ? onLocked : undefined}
      />

      {/* 언제부터 언제까지 센 도전인지. 이 둘이 그 달에 이 도전이 걸려
          있었는지를 가른다 — 비워 두면 어제 건 도전이 작년에도 있던 것처럼
          읽히고, 그만둔 도전이 영영 끼어든다. */}
      <div className="goal-row__span">
        {editMode ? (
          <>
            <div className="goal-row__ym">
              <MonthPicker
                value={짧은연월(startDraft)}
                onChange={(v) => onStartDraft(긴연월(v))}
                max={맨뒤달}
              />
            </div>
            <span className="goal-row__ym-tail">부터</span>

            <div className="goal-row__ym">
              <MonthPicker
                value={endDraft ? 짧은연월(endDraft) : ""}
                onChange={(v) => onEndDraft(v ? 긴연월(v) : "")}
                min={짧은연월(startDraft)}
                placeholder="(종료 없음)"
                clearable
                clearLabel="종료 없음"
              />
            </div>
            <span className="goal-row__ym-tail">까지</span>

            <button
              type="button"
              className="set-remove"
              aria-label={`${st.goal.path} 도전 제거`}
              onClick={onRemove}
            >
              ×
            </button>
          </>
        ) : (
          <span className="goal-row__ym-read">{기간}</span>
        )}
      </div>

      {/* 채움은 띠 전체에 깔린 그라데이션을 왼쪽부터 드러내는 것이다 — 씀씀이의
          실적 띠와 같다. 폭을 줄이면 그라데이션까지 눌려 같은 자리의 빛깔이
          도전마다 달라진다. */}
      <div className="goal-bar">
        <span
          className="goal-bar__fill"
          style={{
            clipPath: `inset(0 ${
              비낌 ? 100 : 100 - Math.min(100, Math.round(st.ratio * 100))
            }% 0 0)`,
          }}
        />
      </div>

      <div className="goal-row__foot">
        <span className="goal-row__spent">
          {비낌 ? "—" : won(st.spent)} / {manwon(st.goal.amount)}
        </span>
        <span className="goal-row__left">
          {/* 걸리지 않았던 달 · 아직 오지 않은 달 · 이미 끝난 달 · 지나가는
              중인 달, 넷이 할 말이 서로 다르다. */}
          {비낌 === "before"
            ? "아직 시작 전입니다."
            : 비낌 === "after"
              ? "끝난 도전입니다."
              : 때 === "올"
                ? "아직 오지 않은 달입니다."
                : st.over
                  ? `${won(-st.left)} 넘겼습니다.`
                  : 때 === "지난"
                    ? `${won(st.left)} 남기고 지켰습니다.`
                    : st.willOver
                      ? `이대로면 ${won(st.pace)}`
                      : `${won(st.left)} 남았습니다.`}
        </span>
      </div>
    </div>
  );
}

export default function Goals() {
  /* 한 건 고치면 셈이 달라진다 — 그때만 다시 받는다. */
  const [reloadKey, setReloadKey] = useState(0);

  /* 보고 있는 달. 지출 내역과 같은 달 막대로 옮긴다 — 지난 달의 성적도
     그대로 남아 있으므로 거슬러 보면 그때 지켰는지가 보인다. */
  const 이번달 = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const [볼달, set볼달] = useState(이번달);
  const 지금달 = 볼달 === 이번달;
  const 때: 달때 = 볼달 < 이번달 ? "지난" : 볼달 > 이번달 ? "올" : "이번";

  /* 넘겨 볼 수 있는 끝 — 적어 둔 것이 있는 달부터 이 달 두 달 뒤까지. */
  const { min: 달바닥, max: 달천장 } = useMonthSpan();

  const { goals, rows, masked, today, catPath, ready } = useGoalBoard({
    reloadKey,
    ym: 볼달,
  });

  /* 꾹 눌러 펼친 도전 */
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

  /* 편집이 아닐 때 잠긴 조각을 누르면 왜 안 되는지 알린다 — 다른 설정 화면과
     같은 갈고리다. */
  const { lockAt, showLock, tipRef } = useEditLock(editMode);
  const [addOpen, setAddOpen] = useState(false);

  /* 새로 걸 도전 */
  const [cat1, setCat1] = useState("");
  const [cat2, setCat2] = useState("");
  const [cat3, setCat3] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  /* 새로 거는 도전은 이 달부터 센다 — 지난 달에 없던 것을 있었다고 할 수 없다. */
  const [start, setStart] = useState("");
  /* 끝은 비워 두는 것이 예사다 — 그만둘 때 와서 적으면 된다. */
  const [end, setEnd] = useState("");

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
     연회비와 같은 방식이다. */
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [memoDraft, setMemoDraft] = useState<Record<number, string>>({});
  const [startDraft, setStartDraft] = useState<Record<number, string>>({});
  const [endDraft, setEndDraft] = useState<Record<number, string>>({});
  useEffect(() => {
    setDraft(Object.fromEntries(goals.map((g) => [g.goal_id, String(g.amount)])));
    setMemoDraft(Object.fromEntries(goals.map((g) => [g.goal_id, g.memo ?? ""])));
    setStartDraft(Object.fromEntries(goals.map((g) => [g.goal_id, g.start_ym])));
    setEndDraft(Object.fromEntries(goals.map((g) => [g.goal_id, g.end_ym ?? ""])));
  }, [goals]);

  /* 뒤로 가기 · Esc로 편집을 무른다. 화면을 떠나는 대신 편집만 닫는다 —
     다른 설정 화면이 모두 그렇다(Categories · Counterparts · PaymentMethods).
     고치던 칸은 담아 둔 도전으로 되돌려 손댄 내용을 버린다.
     Backspace는 받지 않는다. 금액 칸에서 지우다 한 글자가 비면 그 키가
     편집을 닫아 버린다. */
  useBackClose(
    editMode,
    () => {
      setDraft(Object.fromEntries(goals.map((g) => [g.goal_id, String(g.amount)])));
      setMemoDraft(Object.fromEntries(goals.map((g) => [g.goal_id, g.memo ?? ""])));
      setStartDraft(Object.fromEntries(goals.map((g) => [g.goal_id, g.start_ym])));
      setEndDraft(Object.fromEntries(goals.map((g) => [g.goal_id, g.end_ym ?? ""])));
      setEditMode(false);
    },
    false
  );

  /* 담던 것을 뒤로 가기로 접는다 — 설정 탭 네 화면이 모두 그렇다. */
  useBackClose(addOpen, () => setAddOpen(false));

  /* 지나가는 중인 달은 오늘까지로 속도를 어림하고, 끝난 달은 말일을 오늘로
     삼는다 — 그러면 "이대로면"이 사라지고 쓴 돈이 곧 그 달의 결과가 된다. */
  const 기준일 = 지금달 ? today : 때 === "올" ? `${볼달}-01` : 말일(볼달);
  const stands = useMemo(
    () => (ready ? standsOf(goals, rows, 기준일) : []),
    [ready, goals, rows, 기준일]
  );

  /* 시작 연월로 고를 수 있는 맨 뒤 — 앞으로 올 달부터 셀 수는 없다. */
  const 맨뒤달 = 짧은연월(이번달);

  /**
   * 줄 차례 — 그 달에 걸려 있던 것이 위, 비낀 것이 아래다.
   *
   * 걸린 것은 걸어 둔 차례 그대로다. 비낀 것은 오래 전에 끝난 것부터 놓고,
   * 끝이 없는 것(아직 시작 전)은 그 뒤에 시작이 가까운 것부터 놓는다 —
   * 아래로 갈수록 지금과 먼 이야기가 되게 한다.
   */
  const 줄차례 = useMemo(() => {
    const 건: GoalStand[] = [];
    const 비낀: GoalStand[] = [];
    stands.forEach((st) => (걸린달(st.goal, 볼달) ? 건 : 비낀).push(st));
    비낀.sort((a, b) => {
      const ae = a.goal.end_ym ?? "";
      const be = b.goal.end_ym ?? "";
      if (ae !== be) return ae && be ? ae.localeCompare(be) : ae ? -1 : 1;
      return a.goal.start_ym.localeCompare(b.goal.start_ym);
    });
    return [...건, ...비낀];
  }, [stands, 볼달]);

  /* 그 달의 성적 — 걸려 있던 도전 가운데 몇이 어떤지. */
  const 성적 = useMemo(() => {
    const 건 = stands.filter((st) => 걸린달(st.goal, 볼달));
    return {
      전체: 건.length,
      지킴: 건.filter((st) => !st.over).length,
      넘김: 건.filter((st) => st.over).length,
      낌새: 건.filter((st) => st.willOver).length,
      비낌: stands.length - 건.length,
    };
  }, [stands, 볼달]);

  /* 띠에 적는 한마디 — 보고 있는 달이 어느 쪽이냐에 따라 할 말이 다르다. */
  const 성적말 =
    때 === "지난"
      ? `도전 ${성적.전체}개 가운데 ${성적.지킴}개를 지켰습니다.`
      : 성적.넘김 > 0
        ? `도전 ${성적.전체}개 가운데 ${성적.넘김}개를 넘겼습니다.`
        : 성적.낌새 > 0
          ? `도전 ${성적.전체}개 가운데 ${성적.낌새}개가 넘길 낌새입니다.`
          : `도전 ${성적.전체}개 모두 넉넉합니다.`;

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
        start_ym: start,
        end_ym: end,
      });
      setCat1("");
      setCat2("");
      setCat3("");
      setAmount("");
      setMemo("");
      setStart(이번달);
      setEnd("");
      setAddOpen(false);
      again();
      say.ok("추가 완료-!! ;-)");
    } catch (err) {
      say.bad(apiErrorMessage(err));
    }
  };

  /* 다른 설정 화면처럼 고친 것은 [저장]을 눌러야 담긴다.
     칸을 떠나자마자 보내면 편집 모드가 있는 뜻이 없다. */
  const saveAmount = async (goalId: number, value: string) => {
    const before = goals.find((g) => g.goal_id === goalId);
    if (!before || String(before.amount) === value.trim()) return;
    try {
      await axios.post(`/goals/${goalId}/amount`, { amount: value });
      again();
    } catch (err) {
      say.bad(apiErrorMessage(err));
      setDraft((d) => ({ ...d, [goalId]: String(before.amount) }));
    }
  };

  /* 시작과 끝은 서로를 가두므로 한 번에 보낸다 — 따로 보내면 먼저 닿은
     쪽이 "끝이 시작보다 앞선다"에 걸려 두 칸을 함께 옮길 수 없다. */
  const saveSpan = async (goalId: number, from: string, to: string) => {
    const before = goals.find((g) => g.goal_id === goalId);
    if (!before) return;
    if (before.start_ym === from && (before.end_ym ?? "") === to) return;
    try {
      await axios.post(`/goals/${goalId}/start`, { start_ym: from, end_ym: to });
      again();
    } catch (err) {
      say.bad(apiErrorMessage(err));
      setStartDraft((d) => ({ ...d, [goalId]: before.start_ym }));
      setEndDraft((d) => ({ ...d, [goalId]: before.end_ym ?? "" }));
    }
  };

  const saveMemo = async (goalId: number, value: string) => {
    const before = goals.find((g) => g.goal_id === goalId);
    if (!before || (before.memo ?? "") === value.trim()) return;
    try {
      await axios.post(`/goals/${goalId}/memo`, { memo: value });
      again();
    } catch (err) {
      say.bad(apiErrorMessage(err));
      setMemoDraft((d) => ({ ...d, [goalId]: before.memo ?? "" }));
    }
  };

  /* 고친 금액을 모아 보내고 편집을 닫는다.
     칸을 떠날 때 이미 보낸 것은 값이 같으니 그냥 지나간다. */
  const saveAll = async () => {
    const amountChanged = goals.filter((g) => {
      const v = draft[g.goal_id];
      return v != null && v.trim() !== "" && Number(v) !== g.amount;
    });
    const memoChanged = goals.filter((g) => {
      const m = memoDraft[g.goal_id];
      return m != null && m.trim() !== (g.memo ?? "");
    });
    const spanChanged = goals.filter((g) => {
      const from = startDraft[g.goal_id];
      const to = endDraft[g.goal_id];
      if (from == null || to == null) return false;
      return from !== g.start_ym || to !== (g.end_ym ?? "");
    });

    /* 손댄 것이 없으면 다른 설정 화면과 같은 말로 알린다. */
    if (amountChanged.length === 0 && memoChanged.length === 0 && spanChanged.length === 0) {
      say.warn("변경된 내용이 없습니다만...?");
      setEditMode(false);
      return;
    }

    for (const g of amountChanged) await saveAmount(g.goal_id, draft[g.goal_id]);
    for (const g of memoChanged) await saveMemo(g.goal_id, memoDraft[g.goal_id]);
    for (const g of spanChanged) {
      await saveSpan(g.goal_id, startDraft[g.goal_id], endDraft[g.goal_id]);
    }
    say.ok("저장 완료-!! ;-)");
    setEditMode(false);
  };

  const remove = async (goalId: number, path: string) => {
    if (
      !(await ask({
        title: "도전 제거",
        body: `${path} 도전을 지울까요?`,
        warn: "되돌릴 수 없습니다.",
        go: "제거",
        danger: true,
      }))
    )
      return;
    try {
      await axios.delete(`/goals/${goalId}`);
      again();
      say.ok("제거 완료-!! ;-)");
    } catch (err) {
      say.bad(apiErrorMessage(err));
    }
  };

  /* 고른 중분류 아래의 것만. 감춘 분류는 새로 고를 때 빼는 기존 규칙 그대로다. */
  const cat2Options = visible(cat2List).filter((c) => String(c.cat1_id) === cat1);
  const cat3Options = visible(cat3List).filter((c) => String(c.cat2_id) === cat2);

  return (
    <div className="page-wrap">
      <div className="cat-toolbar goal-toolbar">
        <div className="cat-toolbar-btns">
          <div className="btn-row">
            {/* 달 막대는 지출 내역 · 씀씀이와 같은 꼴로 줄 왼쪽 끝에 선다.
                다음 달로는 넘기지 않는다 — 아직 쓴 것이 없어 0원만 보인다. */}
            {/* 고치거나 담는 중에는 달을 옮기지 않는다. 옮겨 봐야 그 달에
                담을 수 없는데, 고치던 칸만 그대로 남아 눌린 것처럼 보인다. */}
            <MonthNav
              ym={볼달}
              onChange={set볼달}
              min={달바닥}
              max={달천장}
              disabled={editMode || addOpen}
              className="goal-month"
            />

            {/* 고치는 것은 이 달에서만 한다. 지난 달 화면에서 금액을 고치면
                그 달만 고치는 것처럼 보이지만 도전은 한 줄뿐이라 모든 달이
                함께 바뀐다. */}
            {/* 담기와 고치기는 나란히 둔다 — 손이 가는 자리가 한 군데다. */}
            {지금달 && (
              <button
                type="button"
                className={`set-add-btn ${addOpen ? "on" : ""}`}
                disabled={editMode}
                onClick={() => setAddOpen((v) => !v)}
              >
                <span className="set-add-btn__mark" aria-hidden="true">+</span>
                새 도전 추가
              </button>
            )}

            {지금달 && (
              <button
                className="ui-btn primary"
                disabled={addOpen}
                onClick={() => (editMode ? saveAll() : setEditMode(true))}
              >
                {editMode ? "저장" : "편집"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="cat-card">
        {/* 그 달의 형편을 한 줄로 먼저 적는다 — 달을 넘기며 훑을 때 줄마다
            읽지 않아도 어떤 달이었는지가 보인다. */}
        {ready && 때 !== "올" && 성적.전체 > 0 && (
          <div className="goal-sum">
            <span className="goal-sum__say">{성적말}</span>
            {성적.비낌 > 0 && (
              <span className="goal-sum__sub">{성적.비낌}개는 이 달 밖</span>
            )}
            <span className={`goal-sum__n ${성적.지킴 === 성적.전체 ? "ok" : "no"}`}>
              {성적.지킴} / {성적.전체}
            </span>
          </div>
        )}

        {addOpen && 지금달 && (
          <div className="set-add-form set-add-form--col set-draft">
            <div className="set-draft__head">
              <span className="set-draft__name">새 도전</span>
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

              {/* 아래 두 칸은 처음부터 자리를 지킨다 — 중분류를 고를 때마다.
                  칸이 생겼다 없어졌다 하면 줄이 들썩인다. */}
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

            {/* 칸 차례는 걸어 둔 카드를 고칠 때와 같다 — 금액, 한마디,
                그리고 시작 연월. 두 자리에서 차례가 다르면 손이 헷갈린다. */}
            <div className="goal-add__row">
              <input
                type="number"
                className="amount-input"
                placeholder="(도전 금액)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <span className="goal-add__unit">원</span>
              <input
                type="text"
                className="memo-input goal-add__memo"
                placeholder="(메모)"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </div>

            {/* 끝은 비워 두는 것이 예사다 — 그만둘 때 와서 적으면 된다. */}
            <div className="goal-add__row">
              <div className="goal-add__ym">
                <MonthPicker
                  value={짧은연월(start || 이번달)}
                  onChange={(v) => setStart(긴연월(v))}
                  max={맨뒤달}
                />
              </div>
              <span className="goal-add__ym-tail">부터</span>

              <div className="goal-add__ym">
                <MonthPicker
                  value={end ? 짧은연월(end) : ""}
                  onChange={(v) => setEnd(v ? 긴연월(v) : "")}
                  min={짧은연월(start || 이번달)}
                  placeholder="(종료 없음)"
                  clearable
                  clearLabel="종료 없음"
                />
              </div>
              <span className="goal-add__ym-tail">까지</span>

              <button className="ui-btn goal-add__go" onClick={add}>추가</button>
            </div>
          </div>
        )}

        {!ready && <div className="page-empty">세어 보는 중입니다.</div>}
        {ready && stands.length === 0 && (
          <div className="page-empty">아직 설정한 도전이 없습니다.</div>
        )}

        {줄차례.map((st) => (
          <GoalRowView
            key={st.goal.goal_id}
            st={st}
            editMode={editMode}
            때={때}
            비낌={비낀까닭(st.goal, 볼달)}
            맨뒤달={맨뒤달}
            startDraft={startDraft[st.goal.goal_id] ?? st.goal.start_ym}
            endDraft={endDraft[st.goal.goal_id] ?? st.goal.end_ym ?? ""}
            onStartDraft={(v) =>
              setStartDraft((d) => ({ ...d, [st.goal.goal_id]: v }))
            }
            onEndDraft={(v) =>
              setEndDraft((d) => ({ ...d, [st.goal.goal_id]: v }))
            }
            onLocked={showLock}
            draft={draft[st.goal.goal_id] ?? ""}
            memoDraft={memoDraft[st.goal.goal_id] ?? ""}
            onDraft={(v) => setDraft((d) => ({ ...d, [st.goal.goal_id]: v }))}
            onMemoDraft={(v) => setMemoDraft((d) => ({ ...d, [st.goal.goal_id]: v }))}
            onRemove={() => remove(st.goal.goal_id, st.goal.path)}
            onPick={() => setPicked(detailOf(st, ymLabel(볼달), catPath, masked))}
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

      <EditLockTip lockAt={lockAt} tipRef={tipRef} />

      <QuickActions onSaved={again} />
    </div>
  );
}
