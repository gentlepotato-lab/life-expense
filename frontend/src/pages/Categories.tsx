import { useEffect, useState } from "react";
import axios from "../api/client";
import useBackClose from "../hooks/useBackClose";
import SingleSelect from "./components/SingleSelect";
import EmojiPicker from "./components/EmojiPicker";
import CollapseToggle, { CollapseAllButtons } from "./components/CollapseToggle";
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

type SortableItemProps = {
  id: string | number;
  children: React.ReactNode;
  dragHandle?: boolean;
};

function SortableItem({ id, children, dragHandle = false }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: "flex",
    alignItems: "center",
    width: "100%"
  };

  return (
    <div ref={setNodeRef} style={style}>
      {dragHandle && (
        <span
          {...attributes}
          {...listeners}
          className="drag-handle"
        >
          ≡
        </span>
      )}
      {children}
    </div>
  );
}

export default function Categories() {
  const [editMode, setEditMode] = useState(false);
  const [cat1, setCat1] = useState<any[]>([]);
  const [cat2, setCat2] = useState<any[]>([]);
  const [cat3, setCat3] = useState<any[]>([]);

  const [addCat1Mode, setAddCat1Mode] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addCat2Mode, setAddCat2Mode] = useState(false);
  /** 감춘 항목까지 보여 줄지. 꺼져 있으면 목록에서만 빠진다(상태에는 그대로 남는다) */
  const [showInactive, setShowInactive] = useState(false);

  /** 접어 둔 묶음. 비어 있으면 전부 펼쳐진 상태다(기존과 같은 모습).
      중분류와 소분류를 한 곳에 담되 접두사로 구분한다. */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const isOpen = (key: string) => !collapsed.has(key);

  const toggleKey = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  /**
   * 화면에 뿌릴 목록.
   * 감춘 항목은 저장 대상에는 그대로 두고 보이기만 뺀다.
   * 그래야 감췄다는 사실이 저장할 때 지워지지 않는다.
   */
  const seen = <T extends { is_active?: number }>(rows: T[]) =>
    showInactive ? rows : rows.filter((r) => r.is_active !== 0);

  const cat1View = seen(cat1);
  const cat2View = seen(cat2);
  const cat3View = seen(cat3);

  /** 접을 수 있는 모든 줄 — 중분류 전체 + 세분류를 가진 소분류 */
  const allCollapsibleKeys = () => [
    ...cat1View.map((c) => `1:${c.cat1_id}`),
    ...cat2View
      .filter((c) => cat3View.some((x) => x.cat2_id === c.cat2_id))
      .map((c) => `2:${c.cat2_id}`),
  ];

  const [selectedCat1ForAdd, setSelectedCat1ForAdd] = useState<number | null>(null);
  const [selectedCat2ForAdd, setSelectedCat2ForAdd] = useState<number | null>(null);
  const [newCat1Name, setNewCat1Name] = useState("");
  const [newCat2Name, setNewCat2Name] = useState("");
  const [newCat3Name, setNewCat3Name] = useState("");

  const [beforeEditCat1, setBeforeEditCat1] = useState<any[]>([]);
  const [beforeEditCat2, setBeforeEditCat2] = useState<any[]>([]);
  const [beforeEditCat3, setBeforeEditCat3] = useState<any[]>([]);

  /* 뒤로 가기 · Backspace 로 편집을 무른다.
     편집에 들어올 때 떠 둔 원본으로 되돌리므로 손댄 내용은 버려진다.
     추가 칸이 열려 있으면 그것부터 닫는다(나중에 연 것이 먼저 닫힌다). */
  useBackClose(editMode, () => {
    setCat1(beforeEditCat1);
    setCat2(beforeEditCat2);
    setCat3(beforeEditCat3);
    setEditMode(false);
  });
  useBackClose(addOpen, () => setAddOpen(false));

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 }
    })
  );

  useEffect(() => {
    axios.get("/categories/lvl1").then((r) =>
      setCat1(r.data.map((c: any) => ({
        cat1_id: c.id,
        cat1_name: c.name,
        emoji: c.emoji ?? null,
        is_active: c.is_active ?? 1,
        editing: false
      })))
    );

    axios.get("/categories/lvl2").then((r) =>
      setCat2(r.data.map((c: any) => ({
        cat2_id: c.id,
        cat2_name: c.name,
        cat1_id: c.cat1_id,
        blur: c.blur ?? 0, // blur 값 받기
        inout: c.inout ?? null, // inout 값 받기
        is_active: c.is_active ?? 1,
        editing: false
      })))
    );

    axios.get("/categories/lvl3").then((r) =>
      setCat3(r.data.map((c: any) => ({
        cat3_id: c.id,
        cat3_name: c.name,
        cat2_id: c.cat2_id,
        is_active: c.is_active ?? 1,
        editing: false
      })))
    );
  }, []);

  // 중분류 정렬
  const handleDragEndCat1 = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = cat1.findIndex((x) => x.cat1_id === active.id);
    const newIndex = cat1.findIndex((x) => x.cat1_id === over.id);

    const newOrder = [...cat1];
    const moved = newOrder.splice(oldIndex, 1)[0];
    newOrder.splice(newIndex, 0, moved);
    setCat1(newOrder);
  };

  // 소분류 정렬
  const handleDragEndCat2 = (cat1_id: number) => (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const list = cat2.filter((c) => c.cat1_id === cat1_id);
    const oldIndex = list.findIndex((x) => x.cat2_id === active.id);
    const newIndex = list.findIndex((x) => x.cat2_id === over.id);

    const reordered = [...list];
    const moved = reordered.splice(oldIndex, 1)[0];
    reordered.splice(newIndex, 0, moved);

    // 이 중분류에 속하는 cat2만 재배치된 결과 반영
    const others = cat2.filter((c) => c.cat1_id !== cat1_id);
    setCat2([...others, ...reordered]);
  };

  const handleSave = () => {

    // 중분류 이름 중복 체크
    const cat1Names = cat1.map(c => c.cat1_name.trim());
    const duplicateCat1 = cat1Names.filter((v, i) => cat1Names.indexOf(v) !== i);
    if (duplicateCat1.length > 0) {
      alert("이미 존재하는 항목입니다.");
      return;
    }

    // 소분류 이름 중복 체크 → 중분류별 그룹 검사
    const grouped = cat1.map(c1 => ({
      cat1_id: c1.cat1_id,
      cat2_names: cat2
        .filter(c => c.cat1_id === c1.cat1_id)
        .map(c => c.cat2_name.trim())
    }));

    for (const group of grouped) {
      const dup = group.cat2_names.filter((v, i) => group.cat2_names.indexOf(v) !== i);
      if (dup.length > 0) {
        alert("이미 존재하는 항목입니다.");
        return;
      }
    }

    // 변경 체크 & 저장 로직 기존 그대로
    const changed =
      JSON.stringify(beforeEditCat1.map(c => [c.cat1_id, c.cat1_name, c.emoji ?? null, c.is_active])) !==
        JSON.stringify(cat1.map(c => [c.cat1_id, c.cat1_name, c.emoji ?? null, c.is_active])) ||
      JSON.stringify(beforeEditCat2.map(c => [c.cat2_id, c.cat2_name, c.blur, c.inout, c.is_active])) !==
        JSON.stringify(cat2.map(c => [c.cat2_id, c.cat2_name, c.blur, c.inout, c.is_active])) ||
      JSON.stringify(beforeEditCat3.map(c => [c.cat3_id, c.cat3_name, c.is_active])) !==
        JSON.stringify(cat3.map(c => [c.cat3_id, c.cat3_name, c.is_active]));

    if (!changed) {
      alert("변경된 내용이 없습니다만...?");
      setEditMode(false);
      return;
    }

    const payload = {
      cat1: cat1.map((c, idx) => ({
        cat1_id: c.cat1_id,
        cat1_name: c.cat1_name,
        emoji: c.emoji ?? "",
        is_active: c.is_active ?? 1,
        sort_order: idx + 1,
      })),
      cat2: cat1.flatMap(c1 =>
        cat2
          .filter(c => c.cat1_id === c1.cat1_id)
          .map((c, idx) => ({
            cat2_id: c.cat2_id,
            cat1_id: c1.cat1_id,
            cat2_name: c.cat2_name,
            is_active: c.is_active ?? 1,
            sort_order: idx + 1,
            inout: c.inout,
          }))
      ),
      cat3: cat2.flatMap(c2 =>
        cat3
          .filter(c => c.cat2_id === c2.cat2_id)
          .map((c, idx) => ({
            cat3_id: c.cat3_id,
            cat2_id: c2.cat2_id,
            cat3_name: c.cat3_name,
            is_active: c.is_active ?? 1,
            sort_order: idx + 1,
          }))
      )
    };

    axios.post("/categories/save", payload).then(() => {
      alert("저장 완료-!! ;-)");
      setEditMode(false);
    });
  };

  /**
   * 감추기 — 고르는 목록에서 뺀다. Blur(금액 가리기)와는 다른 것이다.
   * 지난 내역은 이 분류를 계속 가리키므로 지우지 않고 감추기만 한다.
   */
  const toggleHidden1 = (id: number) =>
    setCat1(cat1.map(x => x.cat1_id === id ? { ...x, is_active: x.is_active ? 0 : 1 } : x));
  const toggleHidden2 = (id: number) =>
    setCat2(cat2.map(x => x.cat2_id === id ? { ...x, is_active: x.is_active ? 0 : 1 } : x));
  const toggleHidden3 = (id: number) =>
    setCat3(cat3.map(x => x.cat3_id === id ? { ...x, is_active: x.is_active ? 0 : 1 } : x));

  const handleAdd = async () => {
    const cat1Name = newCat1Name.trim();
    const cat2Name = newCat2Name.trim();
    const cat3Name = newCat3Name.trim();

    // --- CASE 1: '+ 중분류 추가' ---
    if (addCat1Mode) {
      if (!cat1Name || !cat2Name) {
        alert("항목을 입력하세요.");
        return;
      }

      // ① 중분류 생성 or 존재 확인
      let cat1_id: number;
      const existCat1 = cat1.find(c => c.cat1_name === cat1Name);
      if (existCat1) {
        cat1_id = existCat1.cat1_id;
      } else {
        const res1 = await axios.post("/categories/add/lvl1", null, {
          params: { name: cat1Name }
        });
        cat1_id = res1.data.cat1_id;
      }

      // ② 소분류 생성 or 존재 확인
      let cat2_id: number;
      const existCat2 = cat2.find(
        c => c.cat1_id === cat1_id && c.cat2_name === cat2Name
      );
      if (existCat2) {
        cat2_id = existCat2.cat2_id;
      } else {
        const res2 = await axios.post("/categories/add/lvl2", null, {
          params: { cat1_id, name: cat2Name }
        });
        cat2_id = res2.data.cat2_id;
      }

      // ③ 세분류 추가
      if (cat3Name) {
        const existCat3 = cat3.find(
          c => c.cat2_id === cat2_id && c.cat3_name === cat3Name
        );
        if (!existCat3) {
          await axios.post("/categories/add/lvl3", null, {
            params: { cat2_id, name: cat3Name }
          });
        } else {
          alert("이미 존재하는 세분류입니다.");
        }
      }

      alert("추가 완료-!! ;-)");
      setAddOpen(false);
      setNewCat1Name("");
      setNewCat2Name("");
      setNewCat3Name("");
      await refreshListsAll();
      return;
    }

    // --- CASE 2: 기존 중분류 아래 추가 ---
    if (selectedCat1ForAdd && !selectedCat2ForAdd) {
      if (!cat2Name) {
        alert("소분류를 입력하세요.");
        return;
      }

      // 기존 소분류 존재 여부 확인
      let cat2_id: number;
      const existCat2 = cat2.find(
        c => c.cat1_id === selectedCat1ForAdd && c.cat2_name === cat2Name
      );

      if (existCat2) {
        cat2_id = existCat2.cat2_id;

        // 기존 소분류가 있어도 세분류가 새로 입력됐다면 허용
        if (cat3Name) {
          const existCat3 = cat3.find(
            c => c.cat2_id === cat2_id && c.cat3_name === cat3Name
          );
          if (!existCat3) {
            await axios.post("/categories/add/lvl3", null, {
              params: { cat2_id, name: cat3Name }
            });
            alert("추가 완료-!! ;-)");
      setAddOpen(false);
            setNewCat3Name("");
            await refreshListsAll();
            return;
          } else {
            alert("이미 존재하는 세분류입니다.");
            return;
          }
        }

        // 세분류도 없으면 추가할 게 없으므로 중복 경고
        alert("이미 존재하는 소분류입니다.");
        return;
      }

      // 소분류 자체가 없으면 새로 추가
      const res2 = await axios.post("/categories/add/lvl2", null, {
        params: { cat1_id: selectedCat1ForAdd, name: cat2Name }
      });
      cat2_id = res2.data.cat2_id;

      // 세분류가 있다면 이어서 생성
      if (cat3Name) {
        await axios.post("/categories/add/lvl3", null, {
          params: { cat2_id, name: cat3Name }
        });
      }

      alert("추가 완료-!! ;-)");
      setAddOpen(false);
      setNewCat2Name("");
      setNewCat3Name("");
      await refreshListsAll();
      return;
    }

    // --- CASE 3: 기존 소분류 아래 세분류 추가 ---
    if (selectedCat2ForAdd) {
      if (!cat3Name) {
        alert("세분류를 입력하세요.");
        return;
      }

      const existCat3 = cat3.find(
        c => c.cat2_id === selectedCat2ForAdd && c.cat3_name === cat3Name
      );
      if (!existCat3) {
        await axios.post("/categories/add/lvl3", null, {
          params: { cat2_id: selectedCat2ForAdd, name: cat3Name }
        });
        alert("추가 완료-!! ;-)");
      setAddOpen(false);
      } else {
        alert("이미 존재하는 세분류입니다.");
      }

      setNewCat3Name("");
      await refreshListsAll();
      return;
    }

    alert("항목을 입력하세요.");
  };

  const refreshListsAll = async () => {
    const [r1, r2, r3] = await Promise.all([
      axios.get("/categories/lvl1"),
      axios.get("/categories/lvl2"),
      axios.get("/categories/lvl3"),
    ]);

    setCat1(r1.data.map((c: any) => ({
      cat1_id: c.id,
      cat1_name: c.name,
      emoji: c.emoji ?? null,
      is_active: c.is_active ?? 1,
      editing: false,
    })));

    setCat2(r2.data.map((c: any) => ({
      cat2_id: c.id,
      cat2_name: c.name,
      cat1_id: c.cat1_id,
      is_active: c.is_active ?? 1,
      blur: c.blur ?? 0,
      inout: c.inout ?? null,
      editing: false,
    })));

    setCat3(r3.data.map((c: any) => ({
      cat3_id: c.id,
      cat3_name: c.name,
      cat2_id: c.cat2_id,
      is_active: c.is_active ?? 1,
      editing: false,
    })));
  };

  const deleteCat1 = async (cat1_id: number) => {
    if (!window.confirm("이 중분류와 그 아래를 모두 제거할까요?")) return;

    try {
      await axios.delete("/categories/delete/lvl1", { params: { cat1_id } });
      refreshListsAll();
      alert("제거 완료-!! ;-)");
    } catch (err: any) {
      if (err.response?.status === 409) {
        alert("항목이 사용 중이기 때문에 제거할 수 없습니다.\n정리 후 다시 시도하세요.");
      } else {
        alert("항목 제거 중 오류가 발생했습니다.");
      }
    }
  };

  const deleteCat2 = async (cat2_id: number) => {
    if (!window.confirm("이 소분류와 그 아래 세분류를 모두 제거할까요?")) return;

    try {
      await axios.delete("/categories/delete/lvl2", { params: { cat2_id } });
      refreshListsAll();
      alert("제거 완료-!! ;-)");
      setSelectedCat2ForAdd(null);
    } catch (err: any) {
      if (err.response?.status === 409) {
        alert("항목이 사용 중이기 때문에 제거할 수 없습니다.\n정리 후 다시 시도하세요.");
      } else {
        alert("항목 제거 중 오류가 발생했습니다.");
      }
    }
  };

  const deleteCat3 = async (cat3_id: number) => {
    if (!window.confirm("이 세분류만 제거할까요?")) return;

    try {
      await axios.delete("/categories/delete/lvl3", { params: { cat3_id } });
      refreshListsAll();
      alert("제거 완료-!! ;-)");
    } catch (err: any) {
      if (err.response?.status === 409) {
        alert("항목이 사용 중이기 때문에 제거할 수 없습니다.\n정리 후 다시 시도하세요.");
      } else {
        alert("항목 제거 중 오류가 발생했습니다.");
      }
    }
  };

  return (
    <div className="page-wrap">

      <div className="cat-toolbar">
        <div className="cat-toolbar-btns">
          <div className="btn-row">
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
              onClick={() => {
                if (!editMode) {
                  // 편집 시작 시 원본 저장
                  setBeforeEditCat1(JSON.parse(JSON.stringify(cat1)));
                  setBeforeEditCat2(JSON.parse(JSON.stringify(cat2)));
                  setBeforeEditCat3(JSON.parse(JSON.stringify(cat3)));
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
      </div>

      <div className="cat-card">
        {/* 추가는 목록 맨 위에서 — 세 Settings 화면 공통 자리.
            분류가 3뎁스라 기존 중분류/소분류를 고르면 그 아래에 붙는
            기존 동작을 그대로 옮겨 왔다. */}
        <div className="set-add-bar">
          <button
            type="button"
            className={`set-add-btn ${addOpen ? "on" : ""}`}
            onClick={() => setAddOpen((v) => !v)}
          >
            <span className="set-add-btn__mark" aria-hidden="true">+</span>
            새 항목 추가
          </button>

          <CollapseAllButtons
            onExpandAll={() => setCollapsed(new Set())}
            onCollapseAll={() => setCollapsed(new Set(allCollapsibleKeys()))}
          />
        </div>

        {addOpen && (
        <div className="set-add-form set-add-form--col set-draft">
          <div className="set-draft__head">
            <span className="set-draft__name">새 항목</span>
            <span className="set-draft__hint">
              고른 중분류·소분류 아래에 추가됩니다.
            </span>
          </div>

          <SingleSelect
            options={[
              { value: "NEW", label: "[+] 새 항목 추가" },
              { value: "", label: "(중분류)" },
              ...cat1.map(c => ({ value: String(c.cat1_id), label: c.cat1_name })),
            ]}
            selected={addCat1Mode ? "NEW" : (selectedCat1ForAdd ? String(selectedCat1ForAdd) : "")}
            onChange={(value) => {
              if (value === "NEW") {
                setAddCat1Mode(true);
                setNewCat1Name("");
              } else if (value === "") {
                setAddCat1Mode(false);
                setSelectedCat1ForAdd(null);
              } else {
                setAddCat1Mode(false);
                setSelectedCat1ForAdd(parseInt(value));
              }
              // 중분류가 바뀌면 아래 선택은 의미가 없어진다
              setAddCat2Mode(false);
              setNewCat2Name("");
            }}
            placeholder="(중분류)"
          />

          {addCat1Mode && (
            <div className="cat23-input-row">
              <input
                className="cat-input"
                placeholder="(새 중분류)"
                value={newCat1Name}
                onChange={(e) => setNewCat1Name(e.target.value)}
              />
            </div>
          )}

          {/* 소분류 — 기존 것을 고르면 그 아래에 세분류가 붙고,
              [+] 새 항목 추가를 고르면 이름을 직접 적는다.
              중분류를 새로 만드는 중이면 고를 기존 소분류가 없으므로 입력칸만 둔다. */}
          {selectedCat1ForAdd && !addCat1Mode && (
            <SingleSelect
              options={[
                { value: "NEW", label: "[+] 새 항목 추가" },
                { value: "", label: "(소분류)" },
                ...cat2
                  .filter(c => c.cat1_id === selectedCat1ForAdd)
                  .map(c => ({ value: c.cat2_name, label: c.cat2_name })),
              ]}
              selected={addCat2Mode ? "NEW" : newCat2Name}
              onChange={(value) => {
                if (value === "NEW") {
                  setAddCat2Mode(true);
                  setNewCat2Name("");
                } else {
                  setAddCat2Mode(false);
                  setNewCat2Name(value);
                }
              }}
              placeholder="(소분류)"
            />
          )}

          {(addCat1Mode || addCat2Mode) && (
            <div className="cat23-input-row">
              <input
                className="cat3-input"
                placeholder="(새 소분류)"
                value={newCat2Name}
                onChange={(e) => setNewCat2Name(e.target.value)}
              />
            </div>
          )}

          {(addCat1Mode || selectedCat1ForAdd) && (
            <div className="cat23-input-row">
              <input
                className="cat3-input"
                placeholder="(새 세분류)"
                value={newCat3Name}
                onChange={(e) => setNewCat3Name(e.target.value)}
              />
            </div>
          )}

          <div className="btn-row">
            <button className="ui-btn" onClick={handleAdd}>추가</button>
          </div>
        </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndCat1}>
          <SortableContext items={cat1View.map((c) => c.cat1_id)} strategy={verticalListSortingStrategy}>
            {cat1View.map((c1) => (
              <div key={c1.cat1_id} className="cat-group">
                <SortableItem id={c1.cat1_id} dragHandle={editMode}>
                  {/* 중분류는 이 묶음의 머리말이다.
                      Counterparts·Payment Methods 의 묶음 머리말과 같은 모양으로 둔다.
                      이름 칸을 클릭해 고치는 기존 동작은 그대로다. */}
                  <div className="set-group__head cat1-head">
                    <CollapseToggle
                      open={isOpen(`1:${c1.cat1_id}`)}
                      onToggle={() => toggleKey(`1:${c1.cat1_id}`)}
                      hidden={!cat2View.some((c) => c.cat1_id === c1.cat1_id)}
                      label={c1.cat1_name}
                    />

                    {/* 이름 · 이모지 · 건수를 한 덩어리로 묶는다.
                        이 덩어리 전체가 클릭 영역이라 이름을 고치기 위한
                        누를 곳이 좁아지지 않는다. */}
                    <div
                      className="cat1-head__text"
                      onClick={() =>
                        editMode &&
                        setCat1(cat1.map(x => x.cat1_id === c1.cat1_id ? { ...x, editing: true } : x))
                      }
                    >
                      {editMode && c1.editing ? (
                        <input
                          className="cat1-input"
                          value={c1.cat1_name}
                          onChange={(e) =>
                            setCat1(cat1.map(x => x.cat1_id === c1.cat1_id ? { ...x, cat1_name: e.target.value } : x))
                          }
                          onBlur={() =>
                            setCat1(cat1.map(x => x.cat1_id === c1.cat1_id ? { ...x, editing: false } : x))
                          }
                          autoFocus
                        />
                      ) : (
                        <span className="cat1-name">
                          {c1.cat1_name}
                          {!c1.is_active && <span className="set-hide-mark">감춤</span>}
                        </span>
                      )}

                      {/* 이모지는 이름 뒤에 — 없을 때 이름 앞이 비어 보이지 않게 */}
                      <EmojiPicker
                        value={c1.emoji ?? null}
                        disabled={!editMode}
                        title={`${c1.cat1_name} 이모지`}
                        onChange={(v) =>
                          setCat1(cat1.map(x => x.cat1_id === c1.cat1_id ? { ...x, emoji: v } : x))
                        }
                      />

                    </div>

                    {/* 건수는 오른쪽 끝에 — 세 화면 공통 */}
                    <span className="set-group__count">
                      {cat2View.filter((c) => c.cat1_id === c1.cat1_id).length}
                    </span>

                    {editMode && (
                      <button
                        type="button"
                        className={`set-hide-btn ${c1.is_active ? "" : "on"}`}
                        title={c1.is_active ? "감춘다 — 고르는 목록에서 빠진다." : "다시 보이게 한다."}
                        onClick={() => toggleHidden1(c1.cat1_id)}
                      >
                        {c1.is_active ? "감추기" : "감춤"}
                      </button>
                    )}

                    {editMode && (
                      <button
                        type="button"
                        className="set-remove"
                        title="제거"
                        aria-label={`${c1.cat1_name} 제거`}
                        onClick={() => deleteCat1(c1.cat1_id)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </SortableItem>

                {/* 접힌 중분류는 아래를 그리지 않는다 */}
                {isOpen(`1:${c1.cat1_id}`) && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEndCat2(c1.cat1_id)}
                >
                  <SortableContext
                    items={cat2View.filter((c) => c.cat1_id === c1.cat1_id).map((c) => c.cat2_id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {cat2View
                      .filter((c) => c.cat1_id === c1.cat1_id)
                      .map((c2) => (
                        <>
                          <SortableItem key={c2.cat2_id} id={c2.cat2_id} dragHandle={editMode}>
                            {/* 소분류 행 */}
                            <div className="cat2-header-row">
                              <CollapseToggle
                                open={isOpen(`2:${c2.cat2_id}`)}
                                onToggle={() => toggleKey(`2:${c2.cat2_id}`)}
                                hidden={!cat3View.some((c) => c.cat2_id === c2.cat2_id)}
                                label={c2.cat2_name}
                              />
                              {editMode && c2.editing ? (
                                <input
                                  className="cat2-input"
                                  value={c2.cat2_name}
                                  onChange={(e) =>
                                    setCat2(cat2.map(x =>
                                      x.cat2_id === c2.cat2_id ? { ...x, cat2_name: e.target.value } : x
                                    ))
                                  }
                                  onBlur={() =>
                                    setCat2(cat2.map(x =>
                                      x.cat2_id === c2.cat2_id ? { ...x, editing: false } : x
                                    ))
                                  }
                                  autoFocus
                                />
                              ) : (
                                <span
                                  className="cat2-name"
                                  onClick={() => {
                                    if (editMode) {
                                      setCat2(cat2.map(x =>
                                        x.cat2_id === c2.cat2_id ? { ...x, editing: true } : x
                                      ));
                                    } else {
                                      setSelectedCat2ForAdd(c2.cat2_id); // 🆕 세분류 추가용 선택
                                    }
                                  }}
                                >
                                  {!editMode && c2.inout !== null && (
                                    /* 색은 그대로 두고 모양만 묶음 머리말의 점과 맞춘다 */
                                    <span
                                      className="set-group__dot inout-dot"
                                      style={{
                                        background: c2.inout === 1 ? "#00C7BE" : "#FF5C57",
                                      }}
                                      aria-label={c2.inout === 1 ? "IN" : "OUT"}
                                    />
                                  )}
                                  {c2.cat2_name}
                                  {!c2.is_active && <span className="set-hide-mark">감춤</span>}
                                </span>
                              )}

                              {editMode && (
                                <div className="inout-select-wrap">
                                  <SingleSelect
                                    options={[
                                      { value: "1", label: "IN(+)" },
                                      { value: "-1", label: "OUT(-)" }
                                    ]}
                                    selected={c2.inout === null ? "" : String(c2.inout)}
                                    onChange={(value) => {
                                      const parsed = value === "" ? null : Number(value);
                                      setCat2(cat2.map(x =>
                                        x.cat2_id === c2.cat2_id ? { ...x, inout: parsed } : x
                                      ));
                                    }}
                                    placeholder="(IN/OUT)"
                                  />
                                </div>
                              )}

                              {editMode && (
                                /* Blur 는 금액을 흐리게 가리는 것. 감추기와는 다르다 */
                                <button
                                  type="button"
                                  className={`set-blur-btn ${c2.blur === 1 ? "on" : ""}`}
                                  title={
                                    c2.blur === 1
                                      ? "금액을 흐리게 가리는 중"
                                      : "금액을 흐리게 가린다."
                                  }
                                  onClick={() => {
                                    const next = c2.blur === 1 ? 0 : 1;
                                    axios.post("/categories/blur/set", null, {
                                      params: { cat1_id: c2.cat1_id, cat2_id: c2.cat2_id, enabled: next === 1 }
                                    });
                                    setCat2(cat2.map(x =>
                                      x.cat2_id === c2.cat2_id ? { ...x, blur: next } : x
                                    ));
                                  }}
                                >
                                  Blur
                                </button>
                              )}

                              {editMode && (
                                <button
                                  type="button"
                                  className={`set-hide-btn ${c2.is_active ? "" : "on"}`}
                                  title={c2.is_active ? "감춘다 — 고르는 목록에서 빠진다." : "다시 보이게 한다."}
                                  onClick={() => toggleHidden2(c2.cat2_id)}
                                >
                                  {c2.is_active ? "감추기" : "감춤"}
                                </button>
                              )}

                              {editMode && (
                                <button
                                  type="button"
                                  className="set-remove"
                                  title="제거"
                                  aria-label={`${c2.cat2_name} 제거`}
                                  onClick={() => deleteCat2(c2.cat2_id)}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          </SortableItem>

                          {/* 소분류 클릭 시 세분류 입력 칸 표시 */}
                          {selectedCat2ForAdd === c2.cat2_id && (
                            <div className="cat3-add-row" style={{ marginLeft: "20px", marginTop: "4px" }}>
                              <input
                                className="cat3-input"
                                placeholder="(새 세분류)"
                                value={newCat3Name}
                                onChange={(e) => setNewCat3Name(e.target.value)}
                              />
                              <button className="ui-btn" onClick={handleAdd}>추가</button>
                            </div>
                          )}

                          {/* 세분류는 cat2-header-row 밖 & 새 DndContext 영역 - 세분류가 있을 때만 표시 */}
                          {isOpen(`2:${c2.cat2_id}`) &&
                            cat3View.filter((c) => c.cat2_id === c2.cat2_id).length > 0 && (
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={(event) => {
                                const { active, over } = event;
                                if (!over || active.id === over.id) return;

                                const list = cat3.filter((c) => c.cat2_id === c2.cat2_id);
                                const oldIndex = list.findIndex((x) => x.cat3_id === active.id);
                                const newIndex = list.findIndex((x) => x.cat3_id === over.id);

                                const reordered = [...list];
                                const moved = reordered.splice(oldIndex, 1)[0];
                                reordered.splice(newIndex, 0, moved);

                                const others = cat3.filter((c) => c.cat2_id !== c2.cat2_id);
                                setCat3([...others, ...reordered]);
                              }}
                            >
                              <SortableContext
                                items={cat3View.filter((c) => c.cat2_id === c2.cat2_id).map((c) => c.cat3_id)}
                                strategy={verticalListSortingStrategy}
                              >
                                <div className="cat3-list">
                                  {cat3View.filter((c) => c.cat2_id === c2.cat2_id).map((c3) => (
                                    <SortableItem key={c3.cat3_id} id={c3.cat3_id} dragHandle={editMode}>
                                      <div className="cat3-row">
                                        {editMode && c3.editing ? (
                                          <input
                                            className="cat3-input"
                                            value={c3.cat3_name}
                                            onChange={(e) =>
                                              setCat3(cat3.map(x =>
                                                x.cat3_id === c3.cat3_id ? { ...x, cat3_name: e.target.value } : x
                                              ))
                                            }
                                            onBlur={() =>
                                              setCat3(cat3.map(x =>
                                                x.cat3_id === c3.cat3_id ? { ...x, editing: false } : x
                                              ))
                                            }
                                            autoFocus
                                          />
                                        ) : (
                                          <span
                                            className="cat3-name"
                                            onClick={() =>
                                              editMode &&
                                              setCat3(cat3.map(x =>
                                                x.cat3_id === c3.cat3_id ? { ...x, editing: true } : x
                                              ))
                                            }
                                          >
                                            {c3.cat3_name}
                                            {!c3.is_active && <span className="set-hide-mark">감춤</span>}
                                          </span>
                                        )}

                                        {editMode && (
                                          <button
                                            type="button"
                                            className={`set-hide-btn ${c3.is_active ? "" : "on"}`}
                                            title={c3.is_active ? "감춘다 — 고르는 목록에서 빠진다." : "다시 보이게 한다."}
                                            onClick={() => toggleHidden3(c3.cat3_id)}
                                          >
                                            {c3.is_active ? "감추기" : "감춤"}
                                          </button>
                                        )}

                                        {editMode && (
                                          <button
                                            type="button"
                                            className="set-remove"
                                            title="제거"
                                            aria-label={`${c3.cat3_name} 제거`}
                                            onClick={() => deleteCat3(c3.cat3_id)}
                                          >
                                            ×
                                          </button>
                                        )}
                                      </div>
                                    </SortableItem>
                                  ))}
                                </div>
                              </SortableContext>
                            </DndContext>
                          )}
                        </>
                      ))}
                  </SortableContext>
                </DndContext>
                )}
              </div>
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
