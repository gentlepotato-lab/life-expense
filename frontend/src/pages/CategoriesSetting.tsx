import Menu from "./components/Menu";
import { useEffect, useState } from "react";
import axios from "../api/client";
import SingleSelect from "./components/SingleSelect";
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

export default function CategoriesSetting() {
  const [editMode, setEditMode] = useState(false);
  const [cat1, setCat1] = useState<any[]>([]);
  const [cat2, setCat2] = useState<any[]>([]);
  const [cat3, setCat3] = useState<any[]>([]);

  const [addCat1Mode, setAddCat1Mode] = useState(false);

  const [selectedCat1ForAdd, setSelectedCat1ForAdd] = useState<number | null>(null);
  const [selectedCat2ForAdd, setSelectedCat2ForAdd] = useState<number | null>(null);
  const [newCat1Name, setNewCat1Name] = useState("");
  const [newCat2Name, setNewCat2Name] = useState("");
  const [newCat3Name, setNewCat3Name] = useState("");

  const [beforeEditCat1, setBeforeEditCat1] = useState<any[]>([]);
  const [beforeEditCat2, setBeforeEditCat2] = useState<any[]>([]);
  const [beforeEditCat3, setBeforeEditCat3] = useState<any[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 }
    })
  );

  useEffect(() => {
    axios.get("/meta/categories/lvl1").then((r) =>
      setCat1(r.data.map((c: any) => ({
        cat1_id: c.id,
        cat1_name: c.name,
        editing: false
      })))
    );

    axios.get("/meta/categories/lvl2").then((r) =>
      setCat2(r.data.map((c: any) => ({
        cat2_id: c.id,
        cat2_name: c.name,
        cat1_id: c.cat1_id,
        blur: c.blur ?? 0, // blur 값 받기
        inout: c.inout ?? null, // inout 값 받기
        editing: false
      })))
    );

    axios.get("/meta/categories/lvl3").then((r) =>
      setCat3(r.data.map((c: any) => ({
        cat3_id: c.id,
        cat3_name: c.name,
        cat2_id: c.cat2_id,
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
      alert("이미 존재하는 항목입니다~");
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
        alert("이미 존재하는 항목입니다~");
        return;
      }
    }

    // 변경 체크 & 저장 로직 기존 그대로
    const changed =
      JSON.stringify(beforeEditCat1.map(c => [c.cat1_id, c.cat1_name])) !==
        JSON.stringify(cat1.map(c => [c.cat1_id, c.cat1_name])) ||
      JSON.stringify(beforeEditCat2.map(c => [c.cat2_id, c.cat2_name, c.blur, c.inout])) !==
        JSON.stringify(cat2.map(c => [c.cat2_id, c.cat2_name, c.blur, c.inout])) ||
      JSON.stringify(beforeEditCat3.map(c => [c.cat3_id, c.cat3_name])) !==
        JSON.stringify(cat3.map(c => [c.cat3_id, c.cat3_name]));

    if (!changed) {
      alert("변경된 내용이 없습니다만...?");
      setEditMode(false);
      return;
    }

    const payload = {
      cat1: cat1.map((c, idx) => ({
        cat1_id: c.cat1_id,
        cat1_name: c.cat1_name,
        sort_order: idx + 1,
      })),
      cat2: cat1.flatMap(c1 =>
        cat2
          .filter(c => c.cat1_id === c1.cat1_id)
          .map((c, idx) => ({
            cat2_id: c.cat2_id,
            cat1_id: c1.cat1_id,
            cat2_name: c.cat2_name,
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
            sort_order: idx + 1,
          }))
      )
    };

    axios.post("/meta/categories/save", payload).then(() => {
      alert("저장 완료-!! ;-)");
      setEditMode(false);
    });
  };

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
        const res1 = await axios.post("/meta/categories/add/cat1", null, {
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
        const res2 = await axios.post("/meta/categories/add/cat2", null, {
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
          await axios.post("/meta/categories/add/cat3", null, {
            params: { cat2_id, name: cat3Name }
          });
        } else {
          alert("이미 존재하는 세분류입니다~");
        }
      }

      alert("추가 완료-!! ;-)");
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
            await axios.post("/meta/categories/add/cat3", null, {
              params: { cat2_id, name: cat3Name }
            });
            alert("추가 완료-!! ;-)");
            setNewCat3Name("");
            await refreshListsAll();
            return;
          } else {
            alert("이미 존재하는 세분류입니다~");
            return;
          }
        }

        // 세분류도 없으면 추가할 게 없으므로 중복 경고
        alert("이미 존재하는 소분류입니다~");
        return;
      }

      // 소분류 자체가 없으면 새로 추가
      const res2 = await axios.post("/meta/categories/add/cat2", null, {
        params: { cat1_id: selectedCat1ForAdd, name: cat2Name }
      });
      cat2_id = res2.data.cat2_id;

      // 세분류가 있다면 이어서 생성
      if (cat3Name) {
        await axios.post("/meta/categories/add/cat3", null, {
          params: { cat2_id, name: cat3Name }
        });
      }

      alert("추가 완료-!! ;-)");
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
        await axios.post("/meta/categories/add/cat3", null, {
          params: { cat2_id: selectedCat2ForAdd, name: cat3Name }
        });
        alert("추가 완료-!! ;-)");
      } else {
        alert("이미 존재하는 세분류입니다~");
      }

      setNewCat3Name("");
      await refreshListsAll();
      return;
    }

    alert("항목을 입력하세요.");
  };

  const refreshListsAll = async () => {
    const [r1, r2, r3] = await Promise.all([
      axios.get("/meta/categories/lvl1"),
      axios.get("/meta/categories/lvl2"),
      axios.get("/meta/categories/lvl3"),
    ]);

    setCat1(r1.data.map((c: any) => ({
      cat1_id: c.id,
      cat1_name: c.name,
      editing: false,
    })));

    setCat2(r2.data.map((c: any) => ({
      cat2_id: c.id,
      cat2_name: c.name,
      cat1_id: c.cat1_id,
      blur: c.blur ?? 0,
      inout: c.inout ?? null,
      editing: false,
    })));

    setCat3(r3.data.map((c: any) => ({
      cat3_id: c.id,
      cat3_name: c.name,
      cat2_id: c.cat2_id,
      editing: false,
    })));
  };

  const deleteCat1 = async (cat1_id: number) => {
    if (!window.confirm("이 중분류와 하위 소분류 전체를 제거합니다?")) return;

    try {
      await axios.delete("/meta/categories/delete/cat1", { params: { cat1_id } });
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
    if (!window.confirm("이 소분류와 하위 소분류 전체를 제거합니다?")) return;

    try {
      await axios.delete("/meta/categories/delete/cat2", { params: { cat2_id } });
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
    if (!window.confirm("이 세분류만 제거합니다?")) return;

    try {
      await axios.delete("/meta/categories/delete/cat3", { params: { cat3_id } });
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
      <Menu />
      <h1 className="page-title">Categories</h1>

      <div className="cat-toolbar">
        <div className="cat-toolbar-btns">

          {/* 중분류 추가 UI */}
          <SingleSelect
            options={[
              { value: "", label: "(중분류)" },
              ...cat1.map(c => ({ value: String(c.cat1_id), label: c.cat1_name })),
              { value: "NEW", label: "[+] 항목 추가" }
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
            }}
            placeholder="(중분류)"
          />

          {addCat1Mode && (
            <div className="cat23-input-row">
              <input
                className="cat-input"
                placeholder="중분류 항목 입력"
                value={newCat1Name}
                onChange={(e) => setNewCat1Name(e.target.value)}
              />
            </div>
          )}

          {/* 소분류 추가 UI + 세분류 추가 UI → 가로 균등 분할 */}
          {(addCat1Mode || selectedCat1ForAdd) && (
            <div className="cat23-input-row">
              <input
                className="cat3-input"
                placeholder="소분류 항목 입력"
                value={newCat2Name}
                onChange={(e) => setNewCat2Name(e.target.value)}
              />
              <input
                className="cat3-input"
                placeholder="세분류 항목 입력 (선택)"
                value={newCat3Name}
                onChange={(e) => setNewCat3Name(e.target.value)}
              />
            </div>
          )}

          {/* 버튼 영역을 하나의 행으로 묶기 */}
          <div className="btn-row">
            <button className="ui-btn" onClick={handleAdd}>추가</button>
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndCat1}>
          <SortableContext items={cat1.map((c) => c.cat1_id)} strategy={verticalListSortingStrategy}>
            {cat1.map((c1) => (
              <div key={c1.cat1_id} className="cat-group">
                <SortableItem id={c1.cat1_id} dragHandle={editMode}>
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
                    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                      <span
                        className="cat1-name"
                        onClick={() =>
                          editMode &&
                          setCat1(cat1.map(x => x.cat1_id === c1.cat1_id ? { ...x, editing: true } : x))
                        }
                        style={{ flex: 1 }}
                      >
                        {c1.cat1_name}
                      </span>

                      {editMode && (
                        <button
                          type="button"
                          className="set-remove"
                          style={{ marginLeft: "auto" }}
                          title="제거"
                          aria-label={`${c1.cat1_name} 제거`}
                          onClick={() => deleteCat1(c1.cat1_id)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )}
                </SortableItem>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEndCat2(c1.cat1_id)}
                >
                  <SortableContext
                    items={cat2.filter((c) => c.cat1_id === c1.cat1_id).map((c) => c.cat2_id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {cat2
                      .filter((c) => c.cat1_id === c1.cat1_id)
                      .map((c2) => (
                        <>
                          <SortableItem key={c2.cat2_id} id={c2.cat2_id} dragHandle={editMode}>
                            {/* 소분류 행 */}
                            <div className="cat2-header-row">
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
                                    <span
                                      style={{
                                        color: c2.inout === 1 ? "#00C7BE" : "#FF5C57",
                                        marginRight: "4px"
                                      }}
                                    >
                                      ●
                                    </span>
                                  )}
                                  {c2.cat2_name}
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
                                    placeholder="IN/OUT"
                                  />
                                </div>
                              )}

                              {editMode && (
                                <label className="blur-toggle">
                                  <input
                                    type="checkbox"
                                    checked={c2.blur === 1}
                                    onChange={(e) => {
                                      axios.post("/meta/categories/blur/set", null, {
                                        params: { cat1_id: c2.cat1_id, cat2_id: c2.cat2_id, enabled: e.target.checked }
                                      });
                                      setCat2(cat2.map(x =>
                                        x.cat2_id === c2.cat2_id ? { ...x, blur: e.target.checked ? 1 : 0 } : x
                                      ));
                                    }}
                                  />
                                  Blur
                                </label>
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
                                placeholder="세분류 항목 입력"
                                value={newCat3Name}
                                onChange={(e) => setNewCat3Name(e.target.value)}
                              />
                              <button className="ui-btn" onClick={handleAdd}>추가</button>
                            </div>
                          )}

                          {/* 세분류는 cat2-header-row 밖 & 새 DndContext 영역 - 세분류가 있을 때만 표시 */}
                          {cat3.filter((c) => c.cat2_id === c2.cat2_id).length > 0 && (
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
                                items={cat3.filter((c) => c.cat2_id === c2.cat2_id).map((c) => c.cat3_id)}
                                strategy={verticalListSortingStrategy}
                              >
                                <div className="cat3-list">
                                  {cat3.filter((c) => c.cat2_id === c2.cat2_id).map((c3) => (
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
                                          </span>
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
              </div>
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}