import Menu from "./components/Menu";
import { useEffect, useState } from "react";
import axios from "../api/client";

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

export default function PaymentMethodsSetting() {
  const [editMode, setEditMode] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [newName, setNewName] = useState("");

  const [beforeEdit, setBeforeEdit] = useState<any[]>([]);

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
  }, []);

  const refresh = async () => {
    const r = await axios.get("/meta/payment-methods/list");
    setList(
      r.data.map((x: any) => ({
        method_id: x.method_id,
        method_name: x.method_name,
        sort_order: x.sort_order,
        editing: false
      }))
    );
  };

  // 드래그 정렬
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

  // 신규 추가
  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return alert("항목을 입력하세요.");
    const exist = list.find((x) => x.method_name === name);
    if (exist) return alert("이미 존재하는 항목입니다~");

    await axios.post("/meta/payment-methods/add", null, {
      params: { name }
    });

    setNewName("");
    await refresh();
    alert("추가 완료-!! ;-)");
  };

  // 저장
  const handleSave = async () => {
    const changed =
      JSON.stringify(beforeEdit.map((x) => [x.method_id, x.method_name])) !==
      JSON.stringify(list.map((x) => [x.method_id, x.method_name])) ||
      JSON.stringify(beforeEdit.map((x) => x.sort_order)) !==
      JSON.stringify(list.map((x) => x.sort_order));

    if (!changed) {
      alert("변경된 내용이 없습니다만...?");
      setEditMode(false);
      return;
    }

    const payload = list.map((x, i) => ({
      method_id: x.method_id,
      method_name: x.method_name,
      sort_order: i + 1
    }));

    await axios.post("/meta/payment-methods/save", payload);
    alert("저장 완료-!! ;-)");
    setEditMode(false);
  };

  // 삭제
  const handleDelete = async (id: number) => {
    if (!window.confirm("이 항목을 제거합니다?")) return;

    const r = await axios.delete("/meta/payment-methods/delete", {
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
      <Menu />
      <div className="page-title-box">
        <h1 className="page-title">Payment Methods</h1>
      </div>

      <div className="cat-toolbar">
        <div className="pm-toolbar-row">
          <input
            className="cat-input"
            placeholder="(결제 수단)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />

          <button className="ui-btn" onClick={handleAdd}>
            추가
          </button>

          <button
            className="ui-btn primary"
            onClick={() => {
              if (!editMode) {
                setBeforeEdit(JSON.parse(JSON.stringify(list)));
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={list.map((x) => x.method_id)}
            strategy={verticalListSortingStrategy}
          >
            {list.map((m) => (
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
                      </span>

                      {editMode && (
                        <button
                          type="button"
                          className="set-remove"
                          style={{ marginLeft: "auto" }}
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
      </div>
    </div>
  );
}