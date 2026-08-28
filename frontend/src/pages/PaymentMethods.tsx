import { Fragment, useEffect, useState } from "react";
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
import QuickActions from "./components/QuickActions";
import CardTierModal, { type BenefitHint, type TierDraft } from "./components/CardTierModal";
import { manwon } from "../utils/amount";

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

/** 이 구분에 든 것만 실적 구간을 적을 수 있다 — 씀씀이의 카드 실적과 같은 잣대다 */
const CARD_CATEGORY = "카드";

/** 드롭다운에서 "새로 만들기" 를 뜻하는 값 */
const NEW_CATEGORY = "__new__";

const groupLabel = (c: Category | null) => c?.name ?? "구분 없음";

export default function PaymentMethods() {
  const [editMode, setEditMode] = useState(false);
  /* 펼쳐 둔 카드와 그 카드의 실적 구간 */
  const [openCards, setOpenCards] = useState<Set<number>>(new Set());
  const [tiers, setTiers] = useState<Record<number, TierDraft[]>>({});
  const [tierOf, setTierOf] = useState<
    { method: { method_id: number; method_name: string }; index: number; draft: TierDraft | null } | null
  >(null);

  /**
   * 연회비는 칸을 떠날 때 그 카드만 따로 저장한다.
   * 이름·구분과 함께 저장(편집 → 저장)에 태우면 줄을 펼쳐 놓고 고칠 수가 없다 —
   * 펼치기는 편집 모드가 아닐 때만 되기 때문이다.
   */
  const saveFee = async (methodId: number, value: string) => {
    try {
      await axios.post(`/payment-methods/${methodId}/annual-fee`, {
        annual_fee: value.trim() === "" ? null : Number(value),
      });
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  };

  const setFeeOf = (methodId: number, value: string) =>
    setList((prev) =>
      prev.map((x) => (x.method_id === methodId ? { ...x, annual_fee: value } : x))
    );

  /** 카드 한 장의 구간을 다시 읽는다 */
  const loadTiers = async (methodId: number) => {
    try {
      type RawTarget = { area: string | null; stores: string };
      type RawBenefit = {
        content: string;
        memo: string | null;
        limit: number | null;
        targets?: RawTarget[];
      };
      type RawTier = { threshold: number; benefits?: RawBenefit[] };

      const r = await axios.get(`/payment-methods/${methodId}/tiers`);
      setTiers((prev) => ({
        ...prev,
        [methodId]: (r.data as RawTier[]).map((t) => ({
          threshold: String(Math.round(t.threshold)),
          benefits: (t.benefits ?? []).map((b) => ({
            content: b.content ?? "",
            memo: b.memo ?? "",
            limit: b.limit == null ? "" : String(Math.round(b.limit)),
            targets: (b.targets ?? []).map((x) => ({
              area: x.area ?? "",
              stores: x.stores ?? "",
            })),
          })),
        })),
      }));
    } catch {
      setTiers((prev) => ({ ...prev, [methodId]: [] }));
    }
  };

  /* 펼칠 때 처음 한 번만 받아 온다 — 카드가 몇 장뿐이라 미리 다 받을 이유가 없다 */
  const toggleCard = (methodId: number) => {
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (next.has(methodId)) next.delete(methodId);
      else {
        next.add(methodId);
        if (!(methodId in tiers)) loadTiers(methodId);
      }
      return next;
    });
  };

  /** 구간 하나를 지운다. 다른 항목을 지우는 것과 같이 바로 묻고 바로 지운다 */
  const deleteTier = async (methodId: number, index: number) => {
    if (!window.confirm("이 구간을 제거할까요?")) return;
    const list = (tiers[methodId] ?? []).filter((_, i) => i !== index);
    try {
      await axios.post(
        `/payment-methods/${methodId}/tiers`,
        list.map((t) => ({ threshold: Number(t.threshold), benefits: t.benefits }))
      );
      await loadTiers(methodId);
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  };

  /**
   * 팝업이 돌려준 구간 하나를 그 카드의 목록에 끼워 넣고 통째로 저장한다.
   * 서버는 카드 한 장치를 갈아 끼우는 방식이라 늘 전부를 보낸다.
   */
  const saveTier = async (next: TierDraft) => {
    if (!tierOf) return;
    const id = tierOf.method.method_id;
    const list = [...(tiers[id] ?? [])];
    if (tierOf.index < 0) list.push(next);
    else list[tierOf.index] = next;

    try {
      await axios.post(
        `/payment-methods/${id}/tiers`,
        [...list]
          .sort((a, b) => Number(a.threshold) - Number(b.threshold))
          .map((t) => ({ threshold: Number(t.threshold), benefits: t.benefits }))
      );
      setTierOf(null);
      await loadTiers(id);
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  };
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
        annual_fee: x.annual_fee == null ? "" : String(Math.round(x.annual_fee)),
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
                  noun="구분"
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
              <Fragment key={m.method_id}>
              <SortableItem id={m.method_id} dragHandle={editMode}>
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
                            noun="구분"
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

                  {/* 카드만 실적 구간을 갖는다. 접는 삼각형은 줄 오른쪽 끝에 —
                      다른 줄의 자리를 밀지 않는다. */}
                  {g.cat?.name === CARD_CATEGORY && (
                    <CollapseToggle
                      open={openCards.has(m.method_id)}
                      onToggle={() => toggleCard(m.method_id)}
                      label={`${m.method_name} 실적 구간`}
                    />
                  )}
                </div>
              </SortableItem>

                {g.cat?.name === CARD_CATEGORY && openCards.has(m.method_id) && (
                  <div className="pm-tiers">
                    {/* 연회비는 구간이 아니라 카드 한 장의 값이라 맨 위에 둔다 */}
                    <div className="pm-tier pm-fee">
                      <span className="pm-tier__amount">연회비</span>
                      <input
                        type="number"
                        className="amount-input"
                        value={m.annual_fee ?? ""}
                        placeholder="(금액)"
                        onChange={(e) => setFeeOf(m.method_id, e.target.value)}
                        onBlur={(e) => saveFee(m.method_id, e.target.value)}
                      />
                      <span className="pm-fee__unit">원</span>
                    </div>

                    {(tiers[m.method_id] ?? []).map((t, i) => (
                      <div key={i} className="pm-tier">
                        <span className="pm-tier__amount">{manwon(t.threshold)} 이상</span>
                        <span className="pm-tier__count">{t.benefits.length}</span>
                        {editMode ? (
                          <button
                            type="button"
                            className="set-remove"
                            title="이 구간 제거"
                            aria-label={`${manwon(t.threshold)} 구간 제거`}
                            onClick={() => deleteTier(m.method_id, i)}
                          >
                            ×
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ui-btn small"
                            onClick={() => setTierOf({ method: m, index: i, draft: t })}
                          >
                            상세
                          </button>
                        )}
                      </div>
                    ))}

                    {/* 테두리 없는 글자 단추 — "모두 펼치기|접기" 와 같은 결이다 */}
                    {!editMode && (
                      <button
                        type="button"
                        className="set-bulk__btn pm-tier__add"
                        onClick={() => setTierOf({ method: m, index: -1, draft: null })}
                      >
                        [+] 실적 구간별 혜택
                      </button>
                    )}
                  </div>
                )}
              </Fragment>
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

      {tierOf && (
        <CardTierModal
          cardName={tierOf.method.method_name}
          tier={tierOf.draft}
          /* 이 카드가 이미 쓰고 있는 혜택 — 어느 구간의 것인지 이름표에 적는다.
             같은 이름이 구간마다 있고 내용도 다를 수 있어 이름만으로는 못 가른다. */
          hints={(tiers[tierOf.method.method_id] ?? []).flatMap((t, i) =>
            i === tierOf.index
              ? []
              : t.benefits
                  .filter((b) => b.content.trim())
                  .map<BenefitHint>((b) => ({
                    label: `${b.content} [${manwon(t.threshold)}]`,
                    benefit: b,
                  }))
          )}
          onClose={() => setTierOf(null)}
          onSave={saveTier}
        />
      )}

      <QuickActions />
    </div>
  );
}
