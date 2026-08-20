import { useEffect, useState } from "react";
import axios from "../api/client";
import useBackClose from "../hooks/useBackClose";
import SingleSelect from "./components/SingleSelect";
import { apiErrorMessage } from "../utils/apiError";
import EmojiPicker from "./components/EmojiPicker";
import CollapseToggle, { CollapseAllButtons } from "./components/CollapseToggle";
import SortableGroup from "./components/SortableGroup";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableItem({ id, children, dragHandle = false }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: "flex",
    alignItems: "center",
    width: "100%"
  };

  return (
    <div ref={setNodeRef} style={style}>
      {dragHandle && (
        <span {...attributes} {...listeners} className="drag-handle">
          ≡
        </span>
      )}
      {children}
    </div>
  );
}

/**
 * 구분(분류).
 * 코드에 박아 두지 않고 payment_method_categories 표에서 읽어 온다.
 * 이모지도 그 행에 들어 있어, 나중에 구분별로 집계할 때 그대로 조인된다.
 */
type Category = {
  category_id: number;
  name: string;
  emoji: string | null;
  sort_order: number;
};

/** 드롭다운에서 "새로 만들기" 를 뜻하는 값 */
const NEW_CATEGORY = "__new__";

const groupLabel = (c: Category | null) => c?.name ?? "구분 없음";

export default function PaymentMethods() {
  const [editMode, setEditMode] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addCategoryId, setAddCategoryId] = useState<number | null>(null);
  /** 감춘 항목까지 보여 줄지. 꺼져 있으면 목록에서만 빠진다(상태에는 그대로 남는다) */
  const [showInactive, setShowInactive] = useState(false);
  /** 접어 둔 묶음. 비어 있으면 전부 펼쳐진 상태다(기존과 같은 모습) */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const [categories, setCategories] = useState<Category[]>([]);

  const [beforeEdit, setBeforeEdit] = useState<any[]>([]);
  const [beforeCategories, setBeforeCategories] = useState<Category[]>([]);

  /* 뒤로 가기 · Backspace 로 편집을 무른다 — 편집 전 상태로 되돌린다 */
  useBackClose(editMode, () => {
    setList(beforeEdit);
    setCategories(beforeCategories);
    setEditMode(false);
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 }
    })
  );

  // 초기 데이터 로드
  useEffect(() => {
    refresh();
    refreshCategories();
  }, []);

  const refreshCategories = async () => {
    const r = await axios.get("/payment-methods/categories");
    setCategories(r.data);
    return r.data as Category[];
  };

  const refresh = async () => {
    const r = await axios.get("/payment-methods");
    setList(
      r.data.map((x: any) => ({
        method_id: x.method_id,
        method_name: x.method_name,
        category_id: x.category_id ?? null,
        is_active: x.is_active ?? 1,
        sort_order: x.sort_order,
        editing: false
      }))
    );
  };

  /**
   * 화면에 뿌릴 구분별 묶음.
   * list 의 상대 순서를 그대로 유지하므로, 구분을 바꾸면 그 줄이
   * 자동으로 다른 묶음으로 옮겨 간다.
   */
  /** 감춘 항목은 저장 대상에는 그대로 두고 보이기만 뺀다 */
  const listView = showInactive ? list : list.filter((x) => x.is_active !== 0);

  const groups = [...categories, null]
    .map((cat) => ({
      cat,
      items: listView.filter((x) => (x.category_id ?? null) === (cat?.category_id ?? null)),
    }))
    // 편집 중에는 빈 구분도 보여 준다. 그래야 이모지를 붙이거나 지울 수 있다.
    .filter((g) => g.items.length > 0 || (editMode && g.cat));

  /**
   * 저장할 때 쓰는 최종 순서.
   *
   * 화면에 안 보이는(감춘) 항목도 같은 규칙으로 줄을 세운다.
   * 보이는 것만 모아 뒤에 감춘 것을 덧붙이면, 감추는 순간 그 항목이
   * 맨 뒤로 밀려 다시 보이게 했을 때 자리가 바뀌어 버린다.
   */
  const orderedForSave = [...categories, null].flatMap((cat) =>
    list.filter((x) => (x.category_id ?? null) === (cat?.category_id ?? null))
  );

  /** 구분(묶음) 자체의 순서를 바꾼다 */
  const handleGroupDragEnd = (event: {
    active: { id: unknown };
    over: { id: unknown } | null;
  }) => {
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

  // 드래그 정렬 — 같은 묶음 안에서만 자리를 바꾼다
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = list.findIndex((x) => x.method_id === active.id);
    const newIndex = list.findIndex((x) => x.method_id === over.id);

    const reordered = [...list];
    const moved = reordered.splice(oldIndex, 1)[0];
    reordered.splice(newIndex, 0, moved);
    setList(reordered);
  };

  /** 감추기 — 고르는 목록에서 뺀다. 지난 내역은 그대로 이 수단을 가리킨다 */
  const toggleHidden = (methodId: number) =>
    setList((prev) =>
      prev.map((x) =>
        x.method_id === methodId ? { ...x, is_active: x.is_active ? 0 : 1 } : x
      )
    );

  const setCategoryOf = (methodId: number, categoryId: number | null) =>
    setList((prev) =>
      prev.map((x) => (x.method_id === methodId ? { ...x, category_id: categoryId } : x))
    );

  /** 추가 폼에서 구분을 새로 만든다. 만든 즉시 그 폼의 선택값이 된다 */
  const createCategoryForAdd = async () => {
    const name = window.prompt("새 구분 이름을 입력하세요.")?.trim();
    if (!name) return;
    try {
      const r = await axios.post("/payment-methods/categories", { name });
      const next = await refreshCategories();
      setBeforeCategories(JSON.parse(JSON.stringify(next)));
      setAddCategoryId(r.data.category_id);
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  };

  /** 구분을 새로 만들고 그 자리에서 해당 결제 수단에 배정한다 */
  const createCategory = async (assignTo: number) => {
    const name = window.prompt("새 구분 이름을 입력하세요.")?.trim();
    if (!name) return;
    try {
      const r = await axios.post("/payment-methods/categories", { name });
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
      const r = await axios.delete(`/payment-methods/categories/${categoryId}`);
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

  // 신규 추가
  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return alert("항목을 입력하세요.");
    const exist = list.find((x) => x.method_name === name);
    if (exist) return alert("이미 존재하는 항목입니다.");

    await axios.post("/payment-methods/add", null, {
      params: { name, category_id: addCategoryId ?? undefined }
    });

    setNewName("");
    setAddCategoryId(null);
    setAddOpen(false);
    await refresh();
    alert("추가 완료-!! ;-)");
  };

  // 저장
  const handleSave = async () => {
    const changed =
      JSON.stringify(beforeCategories.map((c) => [c.category_id, c.emoji])) !==
      JSON.stringify(categories.map((c) => [c.category_id, c.emoji])) ||
      beforeCategories.map((c) => c.category_id).join() !==
        categories.map((c) => c.category_id).join() ||
      JSON.stringify(beforeEdit.map((x) => [x.method_id, x.method_name, x.category_id, x.is_active])) !==
      JSON.stringify(orderedForSave.map((x) => [x.method_id, x.method_name, x.category_id, x.is_active])) ||
      JSON.stringify(beforeEdit.map((x) => x.sort_order)) !==
      JSON.stringify(orderedForSave.map((x) => x.sort_order));

    if (!changed) {
      alert("변경된 내용이 없습니다만...?");
      setEditMode(false);
      return;
    }

    // 화면에 보이는 순서(묶음 → 묶음 안 순서) 그대로 sort_order 를 매긴다
    const payload = orderedForSave.map((x, i) => ({
      method_id: x.method_id,
      method_name: x.method_name,
      category_id: x.category_id ?? null,
      is_active: x.is_active ?? 1,
      sort_order: i + 1
    }));

    await axios.post("/payment-methods/save", payload);
    // 이모지는 분류 행에 저장한다
    await axios.post(
      "/payment-methods/categories/save",
      categories.map((c, i) => ({
        category_id: c.category_id,
        emoji: c.emoji,
        sort_order: i + 1,
      }))
    );
    alert("저장 완료-!! ;-)");
    setEditMode(false);
    await refresh();
    await refreshCategories();
  };

  // 삭제
  const handleDelete = async (id: number) => {
    if (!window.confirm("이 항목을 제거할까요?")) return;

    const r = await axios.delete("/payment-methods/delete", {
      params: { method_id: id }
    });

    if (r.data?.error === "IN_USE") {
      alert("항목이 사용 중이기 때문에 제거할 수 없습니다.\n정리 후 다시 시도하세요.");
      return;
    }

    await refresh();
    alert("제거 완료-!! ;-)");
  };

  return (
    <div className="page-wrap">

      <div className="cat-toolbar">
        <div className="pm-toolbar-row">
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
            onClick={() => {
              if (!editMode) {
                setBeforeEdit(JSON.parse(JSON.stringify(list)));
                setBeforeCategories(JSON.parse(JSON.stringify(categories)));
                setEditMode(true);
              } else {
                handleSave();
              }
            }}
          >
            {editMode ? "저장" : "편집"}
          </button>
        </div>
      </div>

      <div className="cat-card">
        {/* 추가는 목록 맨 위에서 — 세 Settings 화면 공통 자리 */}
        <div className="set-add-bar">
          <button
            type="button"
            className={`set-add-btn ${addOpen ? "on" : ""}`}
            onClick={() => setAddOpen((v) => !v)}
          >
            <span className="set-add-btn__mark" aria-hidden="true">+</span>
            새 항목 추가
          </button>
        </div>

        {addOpen && (
          <div className="set-add-form set-add-form--col set-draft">
            <div className="set-draft__head">
              <span className="set-draft__name">새 항목</span>
              <span className="set-draft__hint">구분은 비워 두어도 됩니다.</span>
            </div>

            <div className="set-add-form__row">
              <input
                className="cat-input"
                placeholder="(결제 수단)"
                value={newName}
                autoFocus
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
              />

              {/* 만들 때 구분까지 정해 둘 수 있다. 여기서도 새 구분을 만들 수 있다. */}
              <div className="set-add-form__cat">
                <SingleSelect
                  options={[
                    { value: NEW_CATEGORY, label: "[+] 새 항목 추가" },
                    { value: "", label: "(구분 없음)" },
                    ...categories.map((c) => ({
                      value: String(c.category_id),
                      label: c.emoji ? `${c.name} ${c.emoji}` : c.name,
                    })),
                  ]}
                  selected={addCategoryId ? String(addCategoryId) : ""}
                  onChange={(v) => {
                    if (v === NEW_CATEGORY) {
                      createCategoryForAdd();
                      return;
                    }
                    setAddCategoryId(v ? Number(v) : null);
                  }}
                  placeholder="(구분)"
                />
              </div>

              <button className="ui-btn" onClick={handleAdd}>
                추가
              </button>
            </div>
          </div>
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
          className="set-group"
        >
        {(groupHandle) => (
        <>
          <div className="set-group__head">
            {groupHandle}
            <CollapseToggle
              open={!collapsed.has(groupLabel(g.cat))}
              onToggle={() => toggleGroup(groupLabel(g.cat))}
              label={groupLabel(g.cat)}
            />
            {/* 이모지는 이름 앞에 — 세 화면이 같은 순서다.
                구분이 있는 묶음만 이모지를 붙일 수 있다. */}
            {g.cat && (
              <EmojiPicker
                value={g.cat.emoji ?? null}
                disabled={!editMode}
                title={`${g.cat.name} 이모지`}
                onChange={(v) =>
                  setCategories((prev) =>
                    prev.map((c) =>
                      c.category_id === g.cat!.category_id ? { ...c, emoji: v } : c
                    )
                  )
                }
              />
            )}
            <span className="set-group__name">{groupLabel(g.cat)}</span>
            <span className="set-group__count">{g.items.length}</span>

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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={g.items.map((x) => x.method_id)}
            strategy={verticalListSortingStrategy}
          >
            {g.items.map((m) => (
              <SortableItem key={m.method_id} id={m.method_id} dragHandle={editMode}>
                <div className="pm-item">

                  {editMode && m.editing ? (
                    <input
                      className="cat1-input"
                      value={m.method_name}
                      onChange={(e) =>
                        setList(
                          list.map((x) =>
                            x.method_id === m.method_id
                              ? { ...x, method_name: e.target.value }
                              : x
                          )
                        )
                      }
                      onBlur={() =>
                        setList(
                          list.map((x) =>
                            x.method_id === m.method_id
                              ? { ...x, editing: false }
                              : x
                          )
                        )
                      }
                      autoFocus
                    />
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%"
                      }}
                    >
                      <span
                        className="cat1-name"
                        onClick={() =>
                          editMode &&
                          setList(
                            list.map((x) =>
                              x.method_id === m.method_id
                                ? { ...x, editing: true }
                                : x
                            )
                          )
                        }
                        style={{ flex: 1 }}
                      >
                        {m.method_name}
                        {!m.is_active && <span className="set-hide-mark">감춤</span>}
                      </span>

                      {editMode && (
                        <div className="pm-cat-select">
                          <SingleSelect
                            options={[
                              { value: NEW_CATEGORY, label: "[+] 새 항목 추가" },
                              { value: "", label: "(구분 없음)" },
                              ...categories.map((c) => ({
                                value: String(c.category_id),
                                label: c.emoji ? `${c.name} ${c.emoji}` : c.name,
                              })),
                            ]}
                            selected={m.category_id ? String(m.category_id) : ""}
                            onChange={(v) => {
                              if (v === NEW_CATEGORY) {
                                createCategory(m.method_id);
                                return;
                              }
                              setCategoryOf(m.method_id, v ? Number(v) : null);
                            }}
                            placeholder="(구분)"
                          />
                        </div>
                      )}

                      {editMode && (
                        <button
                          type="button"
                          className={`set-hide-btn ${m.is_active ? "" : "on"}`}
                          title={m.is_active ? "감춘다 — 고르는 목록에서 빠진다." : "다시 보이게 한다."}
                          onClick={() => toggleHidden(m.method_id)}
                        >
                          {m.is_active ? "감추기" : "감춤"}
                        </button>
                      )}

                      {editMode && (
                        <button
                          type="button"
                          className="set-remove"
                          title="제거"
                          aria-label={`${m.method_name} 제거`}
                          onClick={() => handleDelete(m.method_id)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )}

                </div>
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
        )}
        </>
        )}
        </SortableGroup>
        ))}
        </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
