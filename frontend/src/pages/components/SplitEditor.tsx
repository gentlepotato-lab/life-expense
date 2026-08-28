import { Fragment, useEffect, useRef, useState } from "react";
import axios from "../../api/client";
import { apiErrorMessage } from "../../utils/apiError";
import SingleSelect from "./SingleSelect";

/** 편집 중인 분할 한 줄. 저장 전이므로 split_id 는 없을 수 있다. */
export type SplitDraft = {
  amount: number | "";
  counterpart_id: number | null;
  memo: string | null;
};

type Counterpart = { counterpart_id: number; name: string };

/** "[+] 새로 등록" 을 고르면 그 줄이 이름 입력 모드로 바뀐다 */
const NEW_VALUE = "__new__";

const won = (n: number) => n.toLocaleString("ko-KR");

/**
 * 결제한 금액 중 남에게 돌려받은 몫을 떼어내는 편집기.
 *
 * 결제 총액(entries.amount)은 그대로 두고 뺄 금액만 여기에 쌓는다.
 * 분할은 다시 쪼갤 수 없으므로 depth 는 항상 1 이다.
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
  // 이름 입력 모드로 열려 있는 줄의 인덱스
  const [newAt, setNewAt] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  // 나머지 힌트를 눌렀을 때 그 줄의 금액 칸으로 초점을 옮기기 위해
  const amountRefs = useRef<(HTMLInputElement | null)[]>([]);

  const loadCounterparts = () => {
    axios
      .get("/counterparts")
      .then((r) => setList(r.data))
      .catch(() => setList([]));
  };

  useEffect(loadCounterparts, []);

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

  const createCounterpart = async (i: number) => {
    const name = newName.trim();
    if (!name) return;
    try {
      const res = await axios.post("/counterparts", { name });
      loadCounterparts();
      patch(i, "counterpart_id", res.data.counterpart_id);
      setNewAt(null);
      setNewName("");
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  };

  const options = [
    ...list.map((c) => ({ value: String(c.counterpart_id), label: c.name })),
    { value: NEW_VALUE, label: "[+] 새로 등록" },
  ];

  return (
    <div className="split-editor">
      {/* 머리말 — 팝업의 다른 라벨과 같은 급으로 보이게 한다 */}
      <div className="split-editor__head">
        <span className="split-editor__title">N빵(돌려받음)</span>
        <button type="button" className="ui-btn small" onClick={addRow}>
          + 추가
        </button>
      </div>

      {/* 위쪽 본문과 같은 12칸 그리드 — Who?·금액·메모가 분류 3단과 열을 맞춘다 */}
      {value.length > 0 && (
        <div className="split-grid">
          <span className="split-grid__label">Who?</span>
          <span className="split-grid__label">금액</span>
          <span className="split-grid__label">메모</span>

          {value.map((row, i) => (
            <Fragment key={i}>
              <div className="split-cell">
                {newAt === i ? (
                  <div className="split-cell__new">
                    <input
                      type="text"
                      value={newName}
                      autoFocus
                      placeholder="(이름)"
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          createCounterpart(i);
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setNewAt(null);
                          setNewName("");
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="split-icon-btn primary"
                      title="등록"
                      onClick={() => createCounterpart(i)}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      className="split-icon-btn"
                      title="취소"
                      onClick={() => {
                        setNewAt(null);
                        setNewName("");
                      }}
                    >
                      ×
                    </button>
                  </div>
                ) : (
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
                    placeholder="(Who?)"
                  />
                )}
              </div>

              {/* 비어 있는 동안에는 넣을 수 있는 나머지를 힌트로 덮어 둔다.
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
      )}

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
          실지출 <b>{won(net)}</b>
        </span>
      </div>

      {over && (
        <p className="split-editor__warn">분할 합계가 결제 금액을 초과했습니다.</p>
      )}
    </div>
  );
}
