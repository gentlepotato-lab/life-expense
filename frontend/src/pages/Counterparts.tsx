import { useEffect, useState } from "react";
import axios from "../api/client";
import useBackClose from "../hooks/useBackClose";
import { apiErrorMessage } from "../utils/apiError";
import SingleSelect from "./components/SingleSelect";
import CollapseToggle, { CollapseAllButtons } from "./components/CollapseToggle";
import SortableGroup from "./components/SortableGroup";
import EmojiPicker from "./components/EmojiPicker";
import ColorPicker from "./components/ColorPicker";
import { colorOf } from "../utils/colorPalette";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import QuickActions from "./components/QuickActions";

type Counterpart = {
  counterpart_id: number;
  name: string;
  category_id: number | null;
  memo: string | null;
  sort_order: number;
  is_active: number;
  /** 아직 저장 전인 행. 저장 시 PUT 이 아니라 POST 로 보낸다 */
  isNew?: boolean;
};

/**
 * 구분(분류).
 * 코드에 박아 두지 않고 counterpart_categories 표에서 읽어 온다.
 * 사용자가 늘릴 수 있고, 이모지와 색도 그 행에 함께 담긴다.
 */
type Category = {
  category_id: number;
  name: string;
  emoji: string | null;
  color: string | null;
  sort_order: number;
};

/** 드롭다운에서 "새로 만들기" 를 뜻하는 값 */
const NEW_CATEGORY = "__new__";

const groupLabel = (c: Category | null) => c?.name ?? "구분 없음";

/**
 * 끌어서 옮길 수 있는 한 줄.
 * 손잡이는 편집 모드에서만 나오며, 자리를 항상 차지해 두 모드의
 * 가로 위치가 어긋나지 않게 한다.
 */
function SortableRow({
  id,
  dragHandle,
  children,
}: {
  id: number;
  dragHandle: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`cp-sortable ${isDragging ? "dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {/* 손잡이 자리는 두 모드에서 늘 차지한다. 그러지 않으면 편집에
          들어가는 순간 카드가 통째로 오른쪽으로 밀린다. */}
      {dragHandle ? (
        <span className="cp-drag" {...attributes} {...listeners} aria-label="순서 변경">
          ≡
        </span>
      ) : (
        <span className="cp-drag cp-drag--empty" aria-hidden="true" />
      )}
      {children}
    </div>
  );
}

/** 비교용 지문 — 저장 시 "정말 바뀐 게 있는지" 판단한다.
    배열 순서를 그대로 쓰므로 순서만 바꿔도 "변경됨" 으로 잡힌다. */
const fingerprint = (list: Counterpart[]) =>
  JSON.stringify(
    list.map((c) => [
      c.counterpart_id,
      c.name,
      c.category_id,
      c.memo,
      c.is_active,
      c.isNew ?? false,
    ])
  );

/**
 * 금액 쪼개기에서 "누구에게 돌려받았는지"(Who?) 를 고르기 위한 목록 관리.
 * 분할 편집 중에 즉석 등록도 되지만, 구분·메모 정리와 오타 수정은 여기서 한다.
 */
export default function Counterparts() {
  const [list, setList] = useState<Counterpart[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  // 편집 진입 시점의 상태 — 변경 여부 판단에만 쓴다
  const [beforeEdit, setBeforeEdit] = useState("");
  /** 접어 둔 묶음. 비어 있으면 전부 펼쳐진 상태다(기존과 같은 모습) */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Category[]>([]);
  const [beforeCategories, setBeforeCategories] = useState<Category[]>([]);

  /* 뒤로 가기 · Backspace 로 편집을 무른다.
     여기는 편집 전 목록을 지문으로만 들고 있어 되돌릴 수 없으므로
     서버에서 다시 읽어 손댄 내용을 버린다. */
  useBackClose(editMode, () => {
    setEditMode(false);
    refresh();
    refreshCategories();
  });

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } })
  );

  /**
   * 화면에 뿌릴 구분별 묶음.
   * list 의 상대 순서를 그대로 유지하므로, 구분을 바꾸면 그 줄이
   * 자동으로 다른 묶음으로 옮겨 간다.
   */
  /**
   * 아직 저장하지 않은 행.
   * 묶음에 섞어 두면 구분을 고를 때마다 줄이 이리저리 옮겨 다녀 정신이 없다.
   * 저장하기 전까지는 맨 위에 붙잡아 두고, 저장한 뒤에 제자리를 찾아가게 한다.
   */
  const drafts = list.filter((c) => c.isNew);
  const saved = list.filter((c) => !c.isNew);

  const groups = [...categories, null]
    .map((cat) => ({
      cat,
      items: saved.filter(
        (c) => (c.category_id ?? null) === (cat?.category_id ?? null)
      ),
    }))
    // 편집 중에는 빈 구분도 보여 준다. 그래야 이모지·색을 붙이거나 지울 수 있다.
    .filter((g) => g.items.length > 0 || (editMode && g.cat));

  /** 저장할 때 쓰는 최종 순서 — 화면에 보이는 그대로다 */
  /**
   * 저장할 때 쓰는 최종 순서 — 화면에 보이는 그대로다.
   * 대기 중인 행은 묶음에 들어 있지 않으므로 여기서 뒤에 붙여 준다.
   * 빠뜨리면 새로 만든 항목이 저장되지 않는다.
   */
  const orderedForSave = [...groups.flatMap((g) => g.items), ...drafts];

  /** 구분(묶음) 자체의 순서를 바꾼다 */
  const handleGroupDragEnd = (event: { active: { id: unknown }; over: { id: unknown } | null }) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCategories((prev) => {
      const from = prev.findIndex((c) => c.category_id === active.id);
      const to = prev.findIndex((c) => c.category_id === over.id);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  /**
   * 같은 묶음 안에서만 자리를 바꾼다.
   * list 안의 위치를 직접 옮기므로 묶음 밖 순서는 흐트러지지 않는다.
   */
  const handleDragEnd = (event: { active: { id: unknown }; over: { id: unknown } | null }) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setList((prev) => {
      const from = prev.findIndex((x) => x.counterpart_id === active.id);
      const to = prev.findIndex((x) => x.counterpart_id === over.id);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const refreshCategories = async () => {
    const r = await axios.get("/counterparts/categories");
    setCategories(r.data);
    return r.data as Category[];
  };

  const refresh = async (inactive = showInactive) => {
    const r = await axios.get("/counterparts", {
      params: { include_inactive: inactive },
    });
    setList(r.data);
    return r.data as Counterpart[];
  };

  useEffect(() => {
    refreshCategories();
    refresh(showInactive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  /**
   * 목록 맨 아래에 빈 행을 하나 붙인다.
   * 실제 등록은 저장할 때 한꺼번에 하므로 여기서는 서버를 부르지 않는다.
   */
  const handleAdd = () => {
    // 한 번에 한 장만. 여러 장을 벌여 두면 무엇을 채우다 말았는지 놓치기 쉽다.
    if (list.some((c) => c.isNew)) {
      const el = document.querySelector<HTMLInputElement>(
        ".cp-draft input.cp-input--name"
      );
      el?.focus();
      el?.select();
      return;
    }

    if (!editMode) {
      // 편집 진입 기준점은 행을 붙이기 전에 잡아야 "변경됨" 으로 판정된다
      setBeforeEdit(fingerprint(list));
      setBeforeCategories(JSON.parse(JSON.stringify(categories)));
      setEditMode(true);
    }
    setList((prev) => [
      ...prev,
      {
        counterpart_id: -Date.now(),   // 임시 키. 저장 시 서버가 진짜 ID 를 준다
        name: "",
        category_id: null,
        memo: null,
        sort_order: 0,
        is_active: 1,
        isNew: true,
      },
    ]);
  };

  const enterEdit = () => {
    setBeforeEdit(fingerprint(list));
    setBeforeCategories(JSON.parse(JSON.stringify(categories)));
    setEditMode(true);
  };

  /** 편집 모드에서 바꾼 이름·구분·메모를 한 번에 반영한다 */
  const handleSave = async () => {
    // 이름이 빈 신규 행은 그냥 버린다. 이름이 빈 기존 행은 되돌릴 수 없으니 막는다
    const rows = list.filter((c) => !(c.isNew && !c.name.trim()));

    // 빈 행을 걷어낸 뒤에 판정해야, [+] 만 눌렀다 만 경우도 "변경 없음" 으로 잡힌다
    const categoriesChanged =
      JSON.stringify(beforeCategories.map((c) => [c.category_id, c.emoji, c.color])) !==
      JSON.stringify(categories.map((c) => [c.category_id, c.emoji, c.color]));

    if (fingerprint(rows) === beforeEdit && !categoriesChanged) {
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

    // 화면에 보이는 순서 그대로 sort_order 를 매긴다
    const ordered = orderedForSave.filter((c) => rows.includes(c));

    try {
      for (let i = 0; i < ordered.length; i++) {
        const c = ordered[i];
        const body = {
          name: c.name.trim(),
          category_id: c.category_id,
          memo: c.memo,
          is_active: c.is_active,
          sort_order: i + 1,
        };
        if (c.isNew) {
          await axios.post("/counterparts", body);
        } else {
          await axios.put(`/counterparts/${c.counterpart_id}`, body);
        }
      }
      // 구분의 이모지·색은 분류 행에 저장한다
      await axios.post(
        "/counterparts/categories/save",
        categories.map((c, i) => ({
          category_id: c.category_id,
          emoji: c.emoji,
          color: c.color,
          sort_order: i + 1,
        }))
      );
      alert("저장 완료-!! ;-)");
      setEditMode(false);
      await refreshCategories();
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
    if (!window.confirm("이 항목을 제거할까요?")) return;
    try {
      const r = await axios.delete(`/counterparts/${id}`);
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

  const setCategoryOf = (id: number, categoryId: number | null) =>
    setList((prev) =>
      prev.map((x) => (x.counterpart_id === id ? { ...x, category_id: categoryId } : x))
    );

  /**
   * 구분을 새로 만든다. 색은 서버가 아직 안 쓰인 것으로 자동 배정하므로
   * 여기서는 이름만 물어본다.
   */
  const createCategory = async (assignTo: number) => {
    const name = window.prompt("새 구분 이름을 입력하세요.")?.trim();
    if (!name) return;
    try {
      const r = await axios.post("/counterparts/categories", { name });
      const next = await refreshCategories();
      setBeforeCategories(JSON.parse(JSON.stringify(next)));
      setCategoryOf(assignTo, r.data.category_id);
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  };

  const deleteCategory = async (categoryId: number, name: string) => {
    if (!window.confirm(`구분 "${name}" 을 제거합니다?`)) return;
    try {
      const r = await axios.delete(`/counterparts/categories/${categoryId}`);
      if (r.data?.error === "IN_USE") {
        alert(`${r.data.used_count}건이 쓰고 있어 제거할 수 없습니다.`);
        return;
      }
      const next = await refreshCategories();
      setBeforeCategories(JSON.parse(JSON.stringify(next)));
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  };

  const patch = (id: number, field: "name" | "memo", v: string) => {
    setList((prev) =>
      prev.map((x) => (x.counterpart_id === id ? { ...x, [field]: v || null } : x))
    );
  };

  /**
   * 카드 한 장.
   * 묶음 안과 "저장 전" 대기 영역에서 같은 모양을 써야 해서 함수로 뺐다.
   */
  const renderCard = (c: Counterpart) => (
          <div
            className={`cp-card ${c.is_active ? "" : "inactive"} ${
              editMode ? "editing" : ""
            } ${c.isNew ? "is-new" : ""}`}
          >
            {/* 아바타는 두 모드에 공통 — 편집에 들어가도 좌우 위치가 그대로다 */}
            <span
              className="cp-avatar"
              style={{
                background: colorOf(
                  categories.find((x) => x.category_id === c.category_id)?.color
                ),
              }}
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
                    placeholder="(이름)"
                    /* 방금 붙인 빈 행이면 바로 타이핑할 수 있게 한다 */
                    autoFocus={c.isNew}
                    onChange={(e) => patch(c.counterpart_id, "name", e.target.value)}
                  />
                  <div className="cp-input--cat">
                    <SingleSelect
                      options={[
                        { value: NEW_CATEGORY, label: "[+] 새 항목 추가" },
                        { value: "", label: "(구분 없음)" },
                        ...categories.map((x) => ({
                          value: String(x.category_id),
                          label: x.emoji ? `${x.name} ${x.emoji}` : x.name,
                        })),
                      ]}
                      selected={c.category_id ? String(c.category_id) : ""}
                      onChange={(v) => {
                        if (v === NEW_CATEGORY) {
                          createCategory(c.counterpart_id);
                          return;
                        }
                        setCategoryOf(c.counterpart_id, v ? Number(v) : null);
                      }}
                      placeholder="(구분)"
                    />
                  </div>
                  <input
                    className="cp-input cp-input--memo"
                    value={c.memo || ""}
                    placeholder="(메모)"
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
                        ? "감춘다 — 분할 편집의 Who? 목록에서 빠진다."
                        : "다시 보이게 한다."
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

                {!c.is_active && <span className="cp-chip muted">감춤</span>}
              </>
            )}
          </div>
  );

  return (
    <div className="page-wrap">

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

          {/* 내역 세 화면처럼 오른쪽 끝 버튼과 같은 줄에 둔다 */}
          <CollapseAllButtons
            onExpandAll={() => setCollapsed(new Set())}
            onCollapseAll={() =>
              setCollapsed(new Set(groups.map((g) => groupLabel(g.cat))))
            }
          />

          <button
            className="ui-btn primary"
            onClick={() => (editMode ? handleSave() : enterEdit())}
          >
            {editMode ? "저장" : "편집"}
          </button>
        </div>

        <div className="cp-list">
          {/* 추가는 목록 맨 위에서 — 세 Settings 화면 공통 자리 */}
          <div className="set-add-bar">
            <button type="button" className="set-add-btn" onClick={handleAdd}>
              <span className="set-add-btn__mark" aria-hidden="true">+</span>
              새 항목 추가
            </button>
          </div>

          {/* 저장 전 항목 — 구분을 바꿔도 여기서 움직이지 않는다 */}
          {drafts.length > 0 && (
            <section className="cp-draft">
              <div className="cp-draft__head">
                <span className="cp-draft__name">저장 전</span>
                <span className="cp-draft__count">{drafts.length}</span>
                <span className="cp-draft__hint">저장하면 고른 구분으로 옮겨집니다.</span>
              </div>
              {drafts.map((c) => (
                <div key={c.counterpart_id}>{renderCard(c)}</div>
              ))}
            </section>
          )}

          {saved.length === 0 && drafts.length === 0 && (
            <p className="cp-empty">
              등록된 항목이 없다.
              <span>위 [+] 새 항목 추가 를 누르거나, 분할을 편집할 때 바로 등록하면 된다.</span>
            </p>
          )}

          {/* 구분 자체의 순서 바꾸기. 안쪽에는 줄 순서용 DndContext 가 따로 있다 */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleGroupDragEnd}
          >
          <SortableContext
            items={categories.map((c) => c.category_id)}
            strategy={verticalListSortingStrategy}
          >
          {groups.map((g) => (
            <SortableGroup
              key={groupLabel(g.cat)}
              id={g.cat?.category_id ?? -1}
              enabled={editMode && !!g.cat}
              className="cp-group"
            >
            {(groupHandle) => (
            <>
              <div className="cp-group__head">
                {groupHandle}
                <CollapseToggle
                  open={!collapsed.has(groupLabel(g.cat))}
                  onToggle={() => toggleGroup(groupLabel(g.cat))}
                  label={groupLabel(g.cat)}
                />
                {/* 색은 아바타에도 쓰이므로 점으로 미리 보여 준다.
                    편집 모드에서는 눌러서 바꿀 수 있다. */}
                {g.cat ? (
                  <ColorPicker
                    value={g.cat.color}
                    disabled={!editMode}
                    title={`${g.cat.name} 색`}
                    onChange={(v) =>
                      setCategories((prev) =>
                        prev.map((x) =>
                          x.category_id === g.cat!.category_id ? { ...x, color: v } : x
                        )
                      )
                    }
                  />
                ) : (
                  <span className="cp-group__dot" />
                )}

                {/* 이모지는 이름 앞에 — 세 화면이 같은 순서다 */}
                {g.cat && (
                  <EmojiPicker
                    value={g.cat.emoji ?? null}
                    disabled={!editMode}
                    title={`${g.cat.name} 이모지`}
                    onChange={(v) =>
                      setCategories((prev) =>
                        prev.map((x) =>
                          x.category_id === g.cat!.category_id ? { ...x, emoji: v } : x
                        )
                      )
                    }
                  />
                )}

                <span className="cp-group__name">{groupLabel(g.cat)}</span>

                <span className="cp-group__count">{g.items.length}</span>

                {/* 비어 있는 구분만 지울 수 있다 */}
                {editMode && g.cat && g.items.length === 0 && (
                  <button
                    type="button"
                    className="set-remove"
                    title="이 구분 제거"
                    aria-label={`${g.cat.name} 구분 제거`}
                    onClick={() => deleteCategory(g.cat!.category_id, g.cat!.name)}
                  >
                    ×
                  </button>
                )}
              </div>

              {/* 접힌 묶음은 줄을 그리지 않는다 */}
              {!collapsed.has(groupLabel(g.cat)) && (
              <>
              {/* 순서 변경은 같은 묶음 안에서만 — 구분을 바꾸면 묶음이 바뀐다 */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={g.items.map((c) => c.counterpart_id)}
                  strategy={verticalListSortingStrategy}
                >
          {g.items.map((c) => (
            <SortableRow
              key={c.counterpart_id}
              id={c.counterpart_id}
              dragHandle={editMode && !c.isNew}
            >
            {renderCard(c)}
            </SortableRow>
          ))}
                </SortableContext>
              </DndContext>
              </>
              )}
            </>
            )}
            </SortableGroup>
          ))}
          </SortableContext>
          </DndContext>

        </div>
      </div>

      <QuickActions />
    </div>
  );
}
