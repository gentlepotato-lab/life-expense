import Menu from "./components/Menu";
import { useEffect, useState } from "react";
import axios from "../api/client";
import { apiErrorMessage } from "../utils/apiError";
import SingleSelect from "./components/SingleSelect";

type Counterpart = {
  counterpart_id: number;
  name: string;
  category: string | null;
  memo: string | null;
  sort_order: number;
  is_active: number;
  /** 아직 저장 전인 행. 저장 시 PUT 이 아니라 POST 로 보낸다 */
  isNew?: boolean;
};

/** 구분 — 목록이 늘어나면 이름만으로는 누가 누군지 헷갈린다 */
const CATEGORIES = ["가족", "친구", "직장", "기타"];

const CATEGORY_OPTIONS = [
  { value: "", label: "(구분 없음)" },
  ...CATEGORIES.map((c) => ({ value: c, label: c })),
];

/** 비교용 지문 — 저장 시 "정말 바뀐 게 있는지" 판단한다 */
const fingerprint = (list: Counterpart[]) =>
  JSON.stringify(
    list.map((c) => [
      c.counterpart_id,
      c.name,
      c.category,
      c.memo,
      c.is_active,
      c.isNew ?? false,
    ])
  );

/**
 * 금액 쪼개기에서 "누구에게 돌려받았는지"(Who?) 를 고르기 위한 목록 관리.
 * 분할 편집 중에 즉석 등록도 되지만, 구분·메모 정리와 오타 수정은 여기서 한다.
 */
export default function CounterpartsSetting() {
  const [list, setList] = useState<Counterpart[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  // 편집 진입 시점의 상태 — 변경 여부 판단에만 쓴다
  const [beforeEdit, setBeforeEdit] = useState("");

  const refresh = async (inactive = showInactive) => {
    const r = await axios.get("/meta/counterparts", {
      params: { include_inactive: inactive },
    });
    setList(r.data);
    return r.data as Counterpart[];
  };

  useEffect(() => {
    refresh(showInactive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  /**
   * 목록 맨 아래에 빈 행을 하나 붙인다.
   * 실제 등록은 저장할 때 한꺼번에 하므로 여기서는 서버를 부르지 않는다.
   */
  const handleAdd = () => {
    if (!editMode) {
      // 편집 진입 기준점은 행을 붙이기 전에 잡아야 "변경됨" 으로 판정된다
      setBeforeEdit(fingerprint(list));
      setEditMode(true);
    }
    setList((prev) => [
      ...prev,
      {
        counterpart_id: -Date.now(),   // 임시 키. 저장 시 서버가 진짜 ID 를 준다
        name: "",
        category: null,
        memo: null,
        sort_order: 0,
        is_active: 1,
        isNew: true,
      },
    ]);
  };

  const enterEdit = () => {
    setBeforeEdit(fingerprint(list));
    setEditMode(true);
  };

  /** 편집 모드에서 바꾼 이름·구분·메모를 한 번에 반영한다 */
  const handleSave = async () => {
    // 이름이 빈 신규 행은 그냥 버린다. 이름이 빈 기존 행은 되돌릴 수 없으니 막는다
    const rows = list.filter((c) => !(c.isNew && !c.name.trim()));

    // 빈 행을 걷어낸 뒤에 판정해야, [+] 만 눌렀다 만 경우도 "변경 없음" 으로 잡힌다
    if (fingerprint(rows) === beforeEdit) {
      alert("변경된 내용이 없습니다만...?");
      setList(rows);
      setEditMode(false);
      return;
    }

    if (rows.some((c) => !c.name.trim())) {
      alert("이름을 입력하세요.");
      return;
    }

    const names = rows.map((c) => c.name.trim());
    const dup = names.find((n, i) => names.indexOf(n) !== i);
    if (dup) {
      alert(`이름이 겹칩니다 — "${dup}"`);
      return;
    }

    try {
      for (const c of rows) {
        const body = {
          name: c.name.trim(),
          category: c.category,
          memo: c.memo,
          is_active: c.is_active,
        };
        if (c.isNew) {
          await axios.post("/meta/counterparts", body);
        } else {
          await axios.put(`/meta/counterparts/${c.counterpart_id}`, body);
        }
      }
      alert("저장 완료-!! ;-)");
      setEditMode(false);
      await refresh();
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  };

  const handleDelete = async (id: number) => {
    // 아직 저장 전인 행은 화면에서 지우면 끝이다
    if (id < 0) {
      setList((prev) => prev.filter((x) => x.counterpart_id !== id));
      return;
    }
    if (!window.confirm("이 항목을 제거합니다?")) return;
    try {
      const r = await axios.delete(`/meta/counterparts/${id}`);
      if (r.data?.status === "deactivated") {
        alert(
          `이미 ${r.data.used_count}건에 쓰이고 있어 제거하지 않고 감췄습니다.\n` +
            `"감춘 항목 보기" 로 확인할 수 있습니다.`
        );
      } else {
        alert("제거 완료-!! ;-)");
      }
      // 목록이 바뀌었으니 변경 판정 기준도 새로 잡는다
      const next = await refresh();
      setBeforeEdit(fingerprint(next));
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  };

  /**
   * 감추기 / 보이기.
   * 이름·구분·메모와 같은 흐름을 타도록 여기서는 화면만 바꾸고,
   * 실제 반영은 저장할 때 함께 한다. 저장하지 않으면 없던 일이 된다.
   */
  const toggleHidden = (id: number) => {
    setList((prev) =>
      prev.map((x) =>
        x.counterpart_id === id ? { ...x, is_active: x.is_active ? 0 : 1 } : x
      )
    );
  };

  const patch = (id: number, field: "name" | "category" | "memo", v: string) => {
    setList((prev) =>
      prev.map((x) => (x.counterpart_id === id ? { ...x, [field]: v || null } : x))
    );
  };

  return (
    <div className="page-wrap">
      <Menu />
      <div className="page-title-box">
        <h1 className="page-title">Counterparts</h1>
      </div>

      <div className="cp-page">
        {/* 추가는 목록 아래에서 한다. 여기는 편집 여부와 목록 범위만 다룬다 */}
        <div className="cp-toolbar">
          <label className="cp-toggle">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            감춘 항목 보기
          </label>

          <button
            className="ui-btn primary"
            onClick={() => (editMode ? handleSave() : enterEdit())}
          >
            {editMode ? "저장" : "편집"}
          </button>
        </div>

        <div className="cp-list">
          {list.length === 0 && (
            <p className="cp-empty">
              등록된 항목이 없습니다.
              <span>아래 [+] 새로 등록 을 누르거나, 분할을 편집할 때 바로 등록할 수 있습니다.</span>
            </p>
          )}

          {list.map((c) => (
            <div
              className={`cp-card ${c.is_active ? "" : "inactive"} ${
                editMode ? "editing" : ""
              } ${c.isNew ? "is-new" : ""}`}
              key={c.counterpart_id}
            >
              {/* 아바타는 두 모드에 공통 — 편집에 들어가도 좌우 위치가 그대로다 */}
              <span
                className={`cp-avatar cat-${
                  c.category ? CATEGORIES.indexOf(c.category) + 1 : 0
                }`}
                aria-hidden="true"
              >
                {c.name.trim().charAt(0)}
              </span>

              {editMode ? (
                <>
                  <div className="cp-card__edit">
                    <input
                      className="cp-input cp-input--name"
                      value={c.name}
                      placeholder="이름"
                      /* 방금 붙인 빈 행이면 바로 타이핑할 수 있게 한다 */
                      autoFocus={c.isNew}
                      onChange={(e) => patch(c.counterpart_id, "name", e.target.value)}
                    />
                    <div className="cp-input--cat">
                      <SingleSelect
                        options={CATEGORY_OPTIONS}
                        selected={c.category || ""}
                        onChange={(v) => patch(c.counterpart_id, "category", v)}
                        placeholder="(구분)"
                      />
                    </div>
                    <input
                      className="cp-input cp-input--memo"
                      value={c.memo || ""}
                      placeholder="메모"
                      onChange={(e) => patch(c.counterpart_id, "memo", e.target.value)}
                    />
                  </div>

                  {/* 저장 전인 행은 감출 대상이 아니다(아직 존재하지 않으니) */}
                  {!c.isNew && (
                    <button
                      type="button"
                      className={`cp-hide-btn ${c.is_active ? "" : "on"}`}
                      title={
                        c.is_active
                          ? "감춘다 — 분할 편집의 Who? 목록에서 빠진다"
                          : "다시 보이게 한다"
                      }
                      onClick={() => toggleHidden(c.counterpart_id)}
                    >
                      {c.is_active ? "감추기" : "감춤"}
                    </button>
                  )}

                  <button
                    type="button"
                    className="cp-remove"
                    title="제거"
                    aria-label={`${c.name || "빈 행"} 제거`}
                    onClick={() => handleDelete(c.counterpart_id)}
                  >
                    ×
                  </button>
                </>
              ) : (
                <>
                  <div className="cp-card__text">
                    <span className="cp-card__name">{c.name}</span>
                    {c.memo && <span className="cp-card__memo">{c.memo}</span>}
                  </div>

                  {c.category && (
                    <span
                      className={`cp-chip cat-${CATEGORIES.indexOf(c.category) + 1}`}
                    >
                      {c.category}
                    </span>
                  )}
                  {!c.is_active && <span className="cp-chip muted">감춤</span>}
                </>
              )}
            </div>
          ))}

          {/* 목록의 마지막 줄처럼 보이는 추가 버튼 — 누르면 빈 행이 하나 붙는다 */}
          <button type="button" className="cp-add-row" onClick={handleAdd}>
            <span className="cp-add-row__mark" aria-hidden="true">
              +
            </span>
            새로 등록
          </button>
        </div>
      </div>
    </div>
  );
}
