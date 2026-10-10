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
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import QuickActions from "./components/QuickActions";
import useEditLock from "../hooks/useEditLock";
import { EditLockTip } from "./components/EditLock";
import { say, ask, askText } from "../utils/notify";
import Collapse from "./components/Collapse";
type Counterpart = {
  counterpart_id: number;
  name: string;
  category_id: number | null;
  memo: string | null;
  sort_order: number;
  is_active: number;
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

/** 드롭다운에서 "새로 만들기"를 뜻하는 값 */
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
    배열 순서를 그대로 쓰므로 순서만 바꿔도 "변경됨"으로 잡힌다. */
const fingerprint = (list: Counterpart[]) =>
  JSON.stringify(
    list.map((c) => [
      c.counterpart_id,
      c.name,
      c.category_id,
      c.memo,
      c.is_active,
    ])
  );

/**
 * 금액 쪼개기에서 "누구에게 돌려받았는지"(Who?)를 고르기 위한 목록 관리.
 * 분할 편집 중에 즉석 등록도 되지만, 구분·메모 정리와 오타 수정은 여기서 한다.
 */
export default function Counterparts() {
  const [list, setList] = useState<Counterpart[]>([]);
  // 불러오는 중과 "없음"을 가른다. 목표 · 어디 쓰나와 같은 방식이다.
  const [ready, setReady] = useState(false);
  const [editMode, setEditMode] = useState(false);

  /* 편집이 아닐 때 잠긴 조각을 누르면 왜 안 되는지 알린다 — 다른 설정 화면과
     같은 갈고리다. */
  const { lockAt, showLock, tipRef } = useEditLock(editMode);
  const [showInactive, setShowInactive] = useState(false);
  // 편집 진입 시점의 상태 — 변경 여부 판단에만 쓴다.
  const [beforeEdit, setBeforeEdit] = useState("");
  /** 접어 둔 묶음. 비어 있으면 전부 펼쳐진 상태다(기존과 같은 모습) */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Category[]>([]);
  const [beforeCategories, setBeforeCategories] = useState<Category[]>([]);

  /* 새로 담을 항목 */
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMemo, setNewMemo] = useState("");
  const [addCategoryId, setAddCategoryId] = useState<number | null>(null);
  /* 담던 것을 뒤로 가기로 접는다 — 설정 탭 네 화면이 모두 그렇다. */
  useBackClose(addOpen, () => setAddOpen(false));


  /* 뒤로 가기 · Backspace로 편집을 무른다.
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
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    // 순서 바꾸기를 키보드로도 할 수 있게 한다.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /**
   * 화면에 뿌릴 구분별 묶음.
   * list의 상대 순서를 그대로 유지하므로, 구분을 바꾸면 그 줄이
   * 자동으로 다른 묶음으로 옮겨 간다.
   */
  const groups = [...categories, null]
    .map((cat) => ({
      cat,
      items: list.filter(
        (c) => (c.category_id ?? null) === (cat?.category_id ?? null)
      ),
    }))
    // 편집 중에는 빈 구분도 보여 준다. 그래야 이모지·색을 붙이거나 지울 수 있다.
    .filter((g) => g.items.length > 0 || (editMode && g.cat));

  /** 저장할 때 쓰는 최종 순서 — 화면에 보이는 그대로다. */
  const orderedForSave = groups.flatMap((g) => g.items);

  /** 구분(묶음) 자체의 순서를 바꾼다. */
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
    // 조회가 실패하면 알린다. 그냥 두면 처리되지 않은 거절만 남고 화면은
    // 까닭 없이 비어 보인다.
    Promise.all([refreshCategories(), refresh(showInactive)])
      .catch(() => say.bad("불러오지 못했습니다. 새로 고쳐 주세요."))
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  /**
   * 새 항목을 담는다.
   *
   * 예전에는 목록에 빈 줄을 붙여 두고 [저장]을 눌러야 담겼다. 설정 탭의
   * 다른 세 화면은 모두 [추가]로 끝나는데 여기만 한 걸음이 더 있어서,
   * 손이 같은 자리에서 다른 것을 해야 했다. 이제 넷이 같다.
   */
  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return say.warn("이름을 입력해 주세요.");
    if (list.some((c) => c.name.trim() === name)) {
      return say.warn("이미 있는 이름입니다.");
    }

    try {
      await axios.post("/counterparts", {
        name,
        category_id: addCategoryId,
        memo: newMemo.trim() || null,
        /* 맨 뒤에 붙인다 — 담자마자 제 구분 묶음의 끝에 선다. */
        sort_order: list.length + 1,
      });
    } catch (err) {
      say.bad(apiErrorMessage(err));
      return;
    }

    setNewName("");
    setAddCategoryId(null);
    setNewMemo("");
    setAddOpen(false);
    await refresh();
    say.ok("추가 완료-!! ;-)");
  };

  /** 추가 양식에서 구분을 새로 만든다 — 결제 수단과 같은 흐름이다. */
  const createCategoryForAdd = async () => {
    const name = (
      await askText({ title: "새 구분", label: "새 구분 이름을 입력해 주세요.", go: "추가" })
    )?.trim();
    if (!name) return;
    try {
      const r = await axios.post("/counterparts/categories", { name });
      const next = await refreshCategories();
      setBeforeCategories(JSON.parse(JSON.stringify(next)));
      setAddCategoryId(r.data.category_id);
      say.ok("추가 완료-!! ;-)");
    } catch (err) {
      say.bad(apiErrorMessage(err));
    }
  };

  const enterEdit = () => {
    setBeforeEdit(fingerprint(list));
    setBeforeCategories(JSON.parse(JSON.stringify(categories)));
    setEditMode(true);
  };

  /** 편집 모드에서 바꾼 이름·구분·메모를 한 번에 반영한다. */
  const handleSave = async () => {
    const rows = list;

    const categoriesChanged =
      JSON.stringify(beforeCategories.map((c) => [c.category_id, c.emoji, c.color])) !==
      JSON.stringify(categories.map((c) => [c.category_id, c.emoji, c.color]));

    if (fingerprint(rows) === beforeEdit && !categoriesChanged) {
      say.warn("변경된 내용이 없습니다만...?");
      setEditMode(false);
      return;
    }

    if (rows.some((c) => !c.name.trim())) {
      say.warn("이름을 입력해 주세요.");
      return;
    }

    const names = rows.map((c) => c.name.trim());
    const dup = names.find((n, i) => names.indexOf(n) !== i);
    if (dup) {
      say.warn("이미 있는 이름입니다.");
      return;
    }

    // 화면에 보이는 순서 그대로 sort_order를 매긴다.
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
        await axios.put(`/counterparts/${c.counterpart_id}`, body);
      }
      // 구분의 이모지·색은 분류 행에 저장한다.
      await axios.post(
        "/counterparts/categories/save",
        categories.map((c, i) => ({
          category_id: c.category_id,
          emoji: c.emoji,
          color: c.color,
          sort_order: i + 1,
        }))
      );
      say.ok("저장 완료-!! ;-)");
      setEditMode(false);
      await refreshCategories();
      await refresh();
    } catch (err) {
      say.bad(apiErrorMessage(err));
    }
  };

  const handleDelete = async (id: number) => {
    if (
      !(await ask({
        title: "상대 제거",
        body: "이 항목을 제거할까요?",
        go: "제거",
        danger: true,
      }))
    )
      return;
    try {
      const r = await axios.delete(`/counterparts/${id}`);
      if (r.data?.status === "deactivated") {
        say.warn(
          `이미 ${r.data.used_count}건에 쓰이고 있어 제거하지 않고 감췄습니다.\n` +
            `"감춘 항목 보기" 로 확인할 수 있습니다.`
        );
      } else {
        say.ok("제거 완료-!! ;-)");
      }
      // 목록이 바뀌었으니 변경 판정 기준도 새로 잡는다.
      const next = await refresh();
      setBeforeEdit(fingerprint(next));
    } catch (err) {
      say.bad(apiErrorMessage(err));
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
    const name = (
      await askText({ title: "새 구분", label: "새 구분 이름을 입력해 주세요.", go: "추가" })
    )?.trim();
    if (!name) return;
    try {
      const r = await axios.post("/counterparts/categories", { name });
      const next = await refreshCategories();
      setBeforeCategories(JSON.parse(JSON.stringify(next)));
      setCategoryOf(assignTo, r.data.category_id);
      say.ok("추가 완료-!! ;-)");
    } catch (err) {
      say.bad(apiErrorMessage(err));
    }
  };

  const deleteCategory = async (categoryId: number, name: string) => {
    if (
      !(await ask({
        title: "구분 제거",
        body: `"${name}" 구분을 제거할까요?`,
        go: "제거",
        danger: true,
      }))
    )
      return;
    try {
      const r = await axios.delete(`/counterparts/categories/${categoryId}`);
      if (r.data?.error === "IN_USE") {
        say.warn(`${r.data.used_count}건이 쓰고 있어 제거할 수 없습니다.`);
        return;
      }
      const next = await refreshCategories();
      setBeforeCategories(JSON.parse(JSON.stringify(next)));
      say.ok("제거 완료-!! ;-)");
    } catch (err) {
      say.bad(apiErrorMessage(err));
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
            }`}
          >
            {/* 아바타는 두 모드에 공통 — 편집에 들어가도 좌우 위치가 그대로다. */}
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
                    onChange={(e) => patch(c.counterpart_id, "name", e.target.value)}
                  />
                  <div className="cp-input--cat">
                    <SingleSelect
                      noun="구분"
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
        {/* 추가는 목록 아래에서 한다. 여기는 편집 여부와 목록 범위만 다룬다. */}
        <div className="cp-toolbar">
          <label className="cp-toggle">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            감춘 항목 보기
          </label>

          {/* 내역 세 화면처럼 오른쪽 끝 버튼과 같은 줄에 둔다. */}
          <CollapseAllButtons
            onExpandAll={() => setCollapsed(new Set())}
            onCollapseAll={() =>
              setCollapsed(new Set(groups.map((g) => groupLabel(g.cat))))
            }
          />

          {/* 담기와 고치기는 나란히 둔다 — 손이 가는 자리가 한 군데다. */}
          <button
            type="button"
            className={`set-add-btn ${addOpen ? "on" : ""}`}
            aria-disabled={editMode || undefined}
            onClick={(e) =>
              editMode ? showLock(e, "편집을 마친 후 추가하세요.") : setAddOpen((v) => !v)
            }
          >
            <span className="set-add-btn__mark" aria-hidden="true">+</span>
            새 항목 추가
          </button>

          <button
            className="ui-btn primary"
            aria-disabled={addOpen || undefined}
            onClick={(e) =>
              addOpen ? showLock(e, "추가를 마친 후 편집하세요.") : editMode ? handleSave() : enterEdit()
            }
          >
            {editMode ? "저장" : "편집"}
          </button>
        </div>

        <div className="cp-list">
          {/* 칸 구성은 카드를 고칠 때와 같다 — 이름, 구분, 한마디. */}
          {addOpen && (
            <div className="set-add-form set-add-form--col set-draft">
              <div className="set-draft__head">
                <span className="set-draft__name">새 항목</span>
              </div>

              <div className="set-add-form__row cp-add__row">
                <input
                  className="cat-input"
                  placeholder="(이름)"
                  value={newName}
                  autoFocus
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                  }}
                />

                {/* 만들 때 구분까지 정해 둘 수 있다. 여기서도 새 구분을 만든다. */}
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
              </div>

              <div className="set-add-form__row cp-add__row--tail">
                <input
                  className="cat-input"
                  placeholder="(메모)"
                  value={newMemo}
                  onChange={(e) => setNewMemo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                  }}
                />
                <button className="ui-btn" onClick={handleAdd}>추가</button>
              </div>
            </div>
          )}

          {!ready && <p className="page-empty">불러오는 중입니다.</p>}

          {ready && list.length === 0 && (
            <p className="page-empty">
              등록된 항목이 없습니다.
              <span className="page-empty__hint">
                위 [+] 새 항목 추가 를 누르거나, 분할을 편집할 때 바로 등록할 수 있습니다.
              </span>
            </p>
          )}

          {/* 구분 자체의 순서 바꾸기. 안쪽에는 줄 순서용 DndContext가 따로 있다. */}
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
                    onLocked={showLock}
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

                {/* 이모지는 이름 앞에 — 세 화면이 같은 순서다. */}
                {g.cat && (
                  <EmojiPicker
                    value={g.cat.emoji ?? null}
                    disabled={!editMode}
                    onLocked={showLock}
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

                {/* 비어 있는 구분만 지울 수 있다. */}
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

              {/* 접힌 묶음은 줄을 그리지 않는다. */}
              <Collapse open={!collapsed.has(groupLabel(g.cat))}>
              <>
              {/* 순서 변경은 같은 묶음 안에서만 — 구분을 바꾸면 묶음이 바뀐다. */}
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
              dragHandle={editMode}
            >
            {renderCard(c)}
            </SortableRow>
          ))}
                </SortableContext>
              </DndContext>
              </>
              </Collapse>
            </>
            )}
            </SortableGroup>
          ))}
          </SortableContext>
          </DndContext>

        </div>
      </div>

      <EditLockTip lockAt={lockAt} tipRef={tipRef} />

      <QuickActions />
    </div>
  );
}
