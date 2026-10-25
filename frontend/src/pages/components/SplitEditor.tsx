import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "../../api/client";
import { apiErrorMessage } from "../../utils/apiError";
import SingleSelect from "./SingleSelect";
import { say } from "../../utils/notify";
/** 편집 중인 분할 한 줄. 저장 전이므로 split_id는 없을 수 있다. */
export type SplitDraft = {
  amount: number | "";
  counterpart_id: number | null;
  memo: string | null;
};

type Counterpart = { counterpart_id: number; name: string };
type Category = { category_id: number; name: string; emoji?: string | null };

/**
 * "[+] 새로 등록"을 선택하면 담긴 팝업이 등록 화면으로 바뀐다.
 *
 * 전에는 그 줄 안에서 이름 칸과 단추 둘을 나눠 썼다. Who? 칸은 12칸 그리드의
 * 4칸뿐이라 360px에서 이름 칸에 남는 자리가 60px도 되지 않아, 적을 수가
 * 없었다. 단추 둘이 그 좁은 칸을 또 갈라 먹었다.
 *
 * 그렇다고 팝업 위에 팝업을 또 띄우지는 않는다. 담긴 팝업이 그 자리에서
 * 등록 화면으로 바뀐다. 새로 띄우는 것이 아니라 같은 판을 메우는 것이라
 * 아래 칸이 한 칸도 밀리지 않는다.
 *
 * 칸 짜임은 함께한 상대 화면의 [새 항목]과 같다(이름, 구분, 메모). 같은 것을
 * 담는 자리가 둘인데 모양이 다르면 어느 쪽이 맞는지 알 수 없다.
 */
const NEW_VALUE = "__new__";

const won = (n: number) => n.toLocaleString("ko-KR");

/**
 * 결제한 금액 중 남에게 돌려받은 몫을 떼어내는 편집기.
 *
 * 결제 총액(entries.amount)은 그대로 두고 뺄 금액만 여기에 쌓는다.
 * 분할은 다시 쪼갤 수 없으므로 depth는 항상 1이다.
 */
export default function SplitEditor({
  grossAmount,
  value,
  onChange,
}: {
  grossAmount: number;
  value: SplitDraft[];
  onChange: (next: SplitDraft[]) => void;
}) {
  const [list, setList] = useState<Counterpart[]>([]);
  // 등록 화면이 열려 있는 줄의 인덱스
  const [newAt, setNewAt] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newCategoryId, setNewCategoryId] = useState<number | null>(null);
  const [newMemo, setNewMemo] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  /* 덮을 자리. 팝업 안이면 그 팝업을, 아니면 이 편집기 제 몸을 덮는다.
     쓰기 화면처럼 팝업이 아닌 데서도 쓰이기 때문이다.

     그릴 때 ref를 바로 읽으면 안 된다. 그 값은 지난번에 그린 결과라 처음
     그릴 때는 비어 있고, ref가 채워져도 다시 그리지 않는다. 붙은 뒤에 한 번
     찾고 그 값으로 그린다. */
  const 뿌리ref = useRef<HTMLDivElement | null>(null);
  /* 등록 판을 걸 자리와, 그동안 치울 원래 판. */
  const [걸자리, set걸자리] = useState<HTMLElement | null>(null);
  const [치울판, set치울판] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = 뿌리ref.current;
    if (!el) return;
    const 판 = el.closest(".popup-panel, .edit-modal") as HTMLElement | null;
    /* 팝업 안이면 그 덮개에 건다. 쓰기 화면처럼 팝업이 아니면 판이 서 있던
       자리에 그대로 건다. */
    const 자리 =
      (el.closest(".popup-overlay") as HTMLElement | null) ?? 판?.parentElement ?? el;
    set걸자리(자리);
    set치울판(판);
  }, []);

  /* 등록 판이 떠 있는 동안 원래 판은 치운다. 둘을 함께 두면 팝업이 겹쳐
     보인다. 한 자리에 하나만 선다. */
  useEffect(() => {
    if (newAt === null || !치울판) return;
    치울판.classList.add("split-hidden");
    return () => 치울판.classList.remove("split-hidden");
  }, [newAt, 치울판]);
  // 나머지 힌트를 눌렀을 때 그 줄의 금액 칸으로 초점을 옮기기 위해
  const amountRefs = useRef<(HTMLInputElement | null)[]>([]);

  const loadCounterparts = () => {
    axios
      .get("/counterparts")
      .then((r) => setList(r.data))
      .catch(() => setList([]));
  };

  useEffect(loadCounterparts, []);

  /* 구분은 함께한 상대 화면과 같은 자리에서 읽어 온다. */
  useEffect(() => {
    axios
      .get("/counterparts/categories")
      .then((r) => setCategories(r.data))
      .catch(() => setCategories([]));
  }, []);

  const splitSum = value.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const net = grossAmount - splitSum;
  const over = splitSum > grossAmount;

  const patch = (i: number, field: keyof SplitDraft, v: unknown) => {
    onChange(value.map((r, idx) => (idx === i ? { ...r, [field]: v } : r)));
  };

  const addRow = () => {
    onChange([...value, { amount: "", counterpart_id: null, memo: null }]);
  };

  const removeRow = (i: number) => {
    if (newAt === i) setNewAt(null);
    onChange(value.filter((_, idx) => idx !== i));
  };

  /** 이 줄을 뺀 나머지 줄의 합을 결제 금액에서 뺀 값 = 이 줄에 넣을 수 있는 최대 */
  const restFor = (i: number) =>
    grossAmount -
    value.reduce((s, r, idx) => (idx === i ? s : s + (Number(r.amount) || 0)), 0);

  /**
   * 남은 금액을 그 줄에 채우고 곧바로 선택 상태로 만든다.
   * 다른 금액을 넣고 싶으면 그대로 타이핑하면 덮어써지므로 되돌릴 필요가 없다.
   */
  const fillRest = (i: number) => {
    const rest = restFor(i);
    if (rest <= 0) return;
    patch(i, "amount", rest);
    requestAnimationFrame(() => {
      const el = amountRefs.current[i];
      el?.focus();
      el?.select();
    });
  };

  const 등록닫기 = () => {
    setNewAt(null);
    setNewName("");
    setNewCategoryId(null);
    setNewMemo("");
  };

  /* 등록 화면이 떠 있는 동안의 뒤로 가기는 그것만 닫는다. 담긴 팝업까지
     닫히면 적던 내역이 통째로 날아간다. */
  /* Esc로 등록 화면만 닫는다.
     useBackClose를 쓰지 않는 까닭이 있다. 이 화면은 이미 뒤로 가기 한 칸을
     쓰고 있는 팝업 **안에서** 또 한 칸을 쌓는 꼴인데, 그렇게 겹치면 켜자마자
     스스로 닫혔다. 여기서는 기록 칸을 건드리지 않고 키만 받는다. 담긴 팝업의
     닫기는 그대로 살아 있어, 뒤로 가기를 누르면 팝업째 닫힌다. */
  useEffect(() => {
    if (newAt === null) return;
    const 받기 = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      /* 담긴 팝업까지 닫히면 적던 내역이 통째로 날아간다. */
      e.preventDefault();
      e.stopPropagation();
      등록닫기();
    };
    window.addEventListener("keydown", 받기, true);
    return () => window.removeEventListener("keydown", 받기, true);
  }, [newAt]);

  const createCounterpart = async (i: number | null) => {
    if (i === null) return;
    const name = newName.trim();
    if (!name) {
      say.warn("이름을 입력해 주세요.");
      return;
    }
    if (saving) return;
    if (list.some((c) => c.name.trim() === name)) {
      say.warn("이미 있는 이름입니다.");
      return;
    }
    setSaving(true);
    try {
      const res = await axios.post("/counterparts", {
        name,
        category_id: newCategoryId,
        memo: newMemo.trim() || null,
        /* 맨 뒤에 붙인다. 함께한 상대 화면에서 담을 때와 같다. */
        sort_order: list.length + 1,
      });
      loadCounterparts();
      patch(i, "counterpart_id", res.data.counterpart_id);
      등록닫기();
      say.ok("추가 완료-!! ;-)");
    } catch (err) {
      say.bad(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const options = [
    ...list.map((c) => ({ value: String(c.counterpart_id), label: c.name })),
    { value: NEW_VALUE, label: "[+] 새로 등록" },
  ];

  return (
    <div className="split-editor" ref={뿌리ref}>
      {/* 머리말. 팝업의 다른 라벨과 같은 급으로 보이게 한다. */}
      <div className="split-editor__head">
        <span className="split-editor__title">N빵(돌려받음)</span>
        <button type="button" className="ui-btn small" onClick={addRow}>
          + 추가
        </button>
      </div>

      {/* 위쪽 본문과 같은 12칸 그리드. Who?, 금액, 메모가 분류 3단과 열을 맞춘다.

          줄이 없어도 그린다. 담을 때마다 이 칸이 생겼다 없어졌다 하면 팝업
          크기가 그만큼 들썩인다. */}
      {
        <>
        {/* 이름표는 구르는 칸 밖에 둔다. 안에 두면 줄을 올려 볼 때 함께
            올라가 무슨 칸인지 알 수 없게 된다. */}
        <div className="split-labels">
          <span className="split-grid__label">Who?</span>
          <span className="split-grid__label">금액</span>
          <span className="split-grid__label">메모</span>
        </div>

        <div className="split-grid">
          {value.map((row, i) => (
            <Fragment key={i}>
              <div className="split-cell">
                <SingleSelect
                  noun="사람"
                  options={options}
                  selected={row.counterpart_id ? String(row.counterpart_id) : ""}
                  onChange={(v) => {
                    if (v === NEW_VALUE) {
                      setNewName("");
                      setNewAt(i);
                      return;
                    }
                    patch(i, "counterpart_id", v ? Number(v) : null);
                  }}
                  placeholder="(함께한 상대)"
                />
              </div>

              {/* 비어 있는 동안에는 넣을 수 있는 나머지를 힌트로 덮는다.
                  누르면 그 값이 들어가면서 선택되므로, 다른 금액이면 그냥 타이핑하면 된다.
                  따로 채우기 버튼을 두지 않아 금액 칸을 넓게 쓴다. */}
              <div className="split-cell split-cell--amount">
                <input
                  ref={(el) => {
                    amountRefs.current[i] = el;
                  }}
                  type="number"
                  className="amount-input"
                  value={row.amount ?? ""}
                  placeholder="0"
                  onChange={(e) =>
                    patch(i, "amount", e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
                {row.amount === "" && restFor(i) > 0 && (
                  <button
                    type="button"
                    className="split-hint"
                    tabIndex={-1}
                    title={`남은 ${won(restFor(i))} 넣기`}
                    onClick={() => fillRest(i)}
                  >
                    {won(restFor(i))}
                  </button>
                )}
              </div>

              <div className="split-cell">
                <input
                  type="text"
                  value={row.memo || ""}
                  placeholder="(메모)"
                  onChange={(e) => patch(i, "memo", e.target.value || null)}
                />
                <button
                  type="button"
                  className="split-icon-btn danger"
                  title="이 분할 제거"
                  aria-label="이 분할 제거"
                  onClick={() => removeRow(i)}
                >
                  ×
                </button>
              </div>
            </Fragment>
          ))}
        </div>
        </>
      }

      <div className={`split-editor__sum ${over ? "over" : ""}`}>
        <span className="split-editor__term">
          결제 <b>{won(grossAmount)}</b>
        </span>
        <span className="split-editor__op">−</span>
        <span className="split-editor__term">
          돌려받음 <b>{won(splitSum)}</b>
        </span>
        <span className="split-editor__op">=</span>
        <span className="split-editor__term split-editor__net">
          실지출 <b className={net === 0 ? "zero" : ""}>{won(net)}</b>
        </span>
      </div>

      {over && (
        <p className="split-editor__warn">쪼갠 합계가 결제 금액을 넘었습니다.</p>
      )}

      {/* 등록 화면. 담긴 팝업을 덮는다. 머리말과 바닥은 팝업의 것을 그대로
          써서, 덮인 줄 모르고 그 팝업이 바뀐 것처럼 보이게 한다. */}
      {newAt !== null &&
        걸자리 &&
        createPortal(
          <div
            className="popup-panel edit-modal split-new"
            role="dialog"
            aria-modal="true"
            aria-label="새 항목"
          >
            <header className="edit-modal__head">
              <div className="edit-modal__head-text">
                <h3 className="edit-modal__title">새 항목</h3>
              </div>
              <button
                type="button"
                className="edit-modal__close"
                onClick={등록닫기}
                aria-label="닫기"
              >
                ×
              </button>
            </header>

            <div className="edit-modal__body">
              <div className="edit-grid">
                {/* 1행. 이름과 그 묶음. 함께한 상대 화면의 [새 항목]과 같은 차례, 같은 칸 수다. */}
                <div className="edit-field edit-field--span-6">
                  <label className="edit-field__label">
                    이름
                    <span className="edit-field__req" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <div className="edit-field__control">
                    <input
                      type="text"
                      className="cat-input"
                      value={newName}
                      autoFocus
                      placeholder="(이름)"
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          createCounterpart(newAt);
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="edit-field edit-field--span-6">
                  <label className="edit-field__label">구분</label>
                  <div className="edit-field__control">
                    <SingleSelect
                      noun="구분"
                      options={[
                        { value: "", label: "(구분 없음)" },
                        ...categories.map((c) => ({
                          value: String(c.category_id),
                          label: c.name,
                          icon: c.emoji,
                        })),
                      ]}
                      selected={newCategoryId ? String(newCategoryId) : ""}
                      onChange={(v) => setNewCategoryId(v ? Number(v) : null)}
                      placeholder="(구분)"
                    />
                  </div>
                </div>

                <div className="edit-divider" aria-hidden="true" />

                {/* 2행. 한마디. 누구인지와는 성격이 달라 가른다. */}
                <div className="edit-field edit-field--span-12">
                  <label className="edit-field__label">메모</label>
                  <div className="edit-field__control">
                    <input
                      type="text"
                      className="cat-input"
                      value={newMemo}
                      placeholder="(메모)"
                      onChange={(e) => setNewMemo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          createCounterpart(newAt);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <footer className="edit-modal__foot">
              <span />
              <div className="edit-modal__foot-right">
                <button type="button" className="ui-btn" onClick={등록닫기}>
                  닫기
                </button>
                <button
                  type="button"
                  className="ui-btn primary"
                  onClick={() => createCounterpart(newAt)}
                  disabled={saving}
                >
                  추가
                </button>
              </div>
            </footer>
          </div>,
          걸자리
        )}
    </div>
  );
}
