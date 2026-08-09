import Menu from "./components/Menu";
import { useEffect, useState, useMemo, useCallback } from "react";
import api from "../api/client";
import { PlacePicker } from "./EntryForm";
import MultiSelect from "./components/MultiSelect";
import SingleSelect from "./components/SingleSelect";
import CalculatorPopup from "./components/CalculatorPopup";

export default function PendingEntries() {
  const [rows, setRows] = useState<any[]>([]);
  const [allRows, setAllRows] = useState<any[]>([]); // 필터용 원본

  const [cat1List, setCat1List] = useState<{ id: number; name: string }[]>([]);
  const [cat2List, setCat2List] = useState<{ id: number; name: string; cat1_id: number; blur?: number; inout?: number | null }[]>([]);
  const [cat3List, setCat3List] = useState<{ id: number; name: string; cat2_id: number }[]>([]);
  const [payList, setPayList] = useState<{ code: string; name: string }[]>([]);

  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState({
    dateFrom: "",
    dateTo: "",
    cat1: [] as number[],
    cat2: [] as number[],
    cat3: [] as number[],
    pay: [] as string[],
    memo: "",
  });

  const [activePlaceEdit, setActivePlaceEdit] = useState<number | null>(null);
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  useEffect(() => {
    api.get("/meta/categories/lvl1").then((r) => setCat1List(r.data));
    api.get("/meta/categories/lvl2").then((r) => setCat2List(r.data));
    api.get("/meta/categories/lvl3").then((r) => setCat3List(r.data));
    api.get("/meta/payment-methods/list").then((r) =>
      setPayList(
        r.data.map((p: any) => ({
          code: p.method_id,
          name: p.method_name,
        }))
      )
    );
  }, []);

  // 필터 열렸을 때 뒤 화면 스크롤/인터랙션 막기
  useEffect(() => {
    if (filterOpen || calculatorOpen) {
      document.documentElement.classList.add("modal-open");
    } else {
      document.documentElement.classList.remove("modal-open");
    }
  }, [filterOpen, calculatorOpen]);

  // Pending 데이터 전체 조회 → sended = FALSE
  const loadData = async () => {
    const res = await api.get("/pending-entries");
    const mapped = res.data.map((r: any) => ({
      ...r,
      editable: false,
      __dirty: false,
      reveal_amount: false,

      pay_method: r.pay_method ? r.pay_method : "",

      place_name: r.place_name ?? "",
      place_id: r.place_id ?? null,
      kakao_id: r.kakao_id ?? null,
    }));
    setRows(mapped);
    setAllRows(mapped);
  };

  useEffect(() => {
    loadData();
  }, []);

  // 필드 변경 핸들러
  const handleChange = (id: number, field: string, value: any) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.entry_id !== id) return r;
        const updated = { ...r, [field]: value, __dirty: true };
        
        // 소분류 변경 시 IN/OUT 자동 설정
        if (field === "cat2_id") {
          const selectedCat2 = cat2List.find(c => c.id === value);
          if (selectedCat2 && selectedCat2.inout !== null && selectedCat2.inout !== undefined) {
            updated.inout = selectedCat2.inout;
          }
        }
        
        return updated;
      })
    );
  };

  // 편집 토글
  const toggleEditable = (id: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.entry_id === id
          ? { ...r, editable: !r.editable, __dirty: false }
          : r
      )
    );
  };

  // IN/OUT 전환 (소분류 선택 시 자동 설정되므로 비활성화)
  // const toggleInOut = (id: number) => {
  //   setRows((prev) =>
  //     prev.map((r) =>
  //       r.entry_id === id
  //         ? {
  //             ...r,
  //             inout: r.inout === 1 ? -1 : 1,
  //             __dirty: true,
  //           }
  //         : r
  //     )
  //   );
  // };

 // 변경 건수 계산
  const dirtyCount = useMemo(() => {
    return rows.filter(r => r.__dirty).length;
  }, [rows]);

 const saveData = async () => {
   const updated = rows.filter(r => r.__dirty);
   if (!updated.length) {
     alert("변경된 내용이 없습니다만...?");
     return;
   }

   // 서버가 받아야 하는 형태로 정제
   const clean = updated.map(r => ({
     entry_id: r.entry_id,
     tx_date: r.tx_date?.substring(0, 10),
     cat1_id: r.cat1_id ?? null,
     cat2_id: r.cat2_id ?? null,
     cat3_id: r.cat3_id ?? null,
     inout: r.inout,
     amount: Number(r.amount),
     pay_method: r.pay_method ?? null,
     memo: r.memo ?? null,

     place_id: r.place_id ?? null,
     place_name: r.place_name ?? null,
     place_lat: r.place_lat ?? null,
     place_lng: r.place_lng ?? null,
     kakao_id: r.kakao_id ?? null,
     address_name: r.address_name ?? null,
     road_address_name: r.road_address_name ?? null,
     phone: r.phone ?? null,
     category_name: r.category_name ?? null,
     category_group_code: r.category_group_code ?? null,
     category_group_name: r.category_group_name ?? null,
     place_url: r.place_url ?? null,
   }));

  try {
   await api.put("/pending-entries/bulk", clean);
    alert("저장 완료-!! ;-)");
    await loadData();
    
    // 필터가 활성화되어 있으면 다시 적용
    if (isFilterActive) {
      applyFilter();
    }
  } catch (err) {
    console.error(err);
    alert("저장 중 오류가 발생했습니다.");
  }
};

  const deletePending = async (id: number) => {
    if (!window.confirm("정말 제거하시겠습니까?")) return;

    try {
      await api.delete(`/pending-entries/${id}`);
      setRows(prev => prev.filter(r => r.entry_id !== id));
      alert("제거 완료-!! ;-)");
    } catch (err) {
      console.error(err);
      alert("제거 중 오류가 발생했습니다.");
    }
  };

  // Excel Import
  const importExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await api.post("/pending-entries/import", fd, {
        baseURL: "/",
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert(`${res.data.inserted ?? 0}건이 적재되었습니다.`);
      await loadData();
      
      // 필터가 활성화되어 있으면 다시 적용
      if (isFilterActive) {
        applyFilter();
      }
    } catch (err) {
      console.error(err);
      alert("Excel 임포트 중 오류가 발생했습니다.");
    } finally {
      e.target.value = ""; // 같은 파일 다시 올릴 수 있게 리셋
    }
  };

  // Send 단일 카드: (1) pending 업데이트 → (2) send API → (3) 목록에서 제거
  const sendOne = async (row: any) => {
    // 필수 입력값 검증
    if (!row.tx_date || !row.cat1_id || !row.cat2_id || row.amount == null || row.amount === '' || !row.pay_method) {
      alert("Date, CategoryM/S, Amount, PaymentMethod는 필수입니다.");
      return;
    }

    if (!window.confirm("이 항목을 확정(Entries로 전송)하시겠습니까?")) return;

    try {
      // 1) pending_entries 내용 업데이트
      const payload = {
        tx_date: row.tx_date.substring(0, 10),
        cat1_id: row.cat1_id,
        cat2_id: row.cat2_id,
        cat3_id: row.cat3_id,
        inout: row.inout,
        amount: row.amount,
        pay_method: row.pay_method,
        memo: row.memo,

        // 장소 관련 → 선택된 경우만 값이 있을 것
        place_id: row.place_id ?? null,
        place_name: row.place_name ?? "",
        place_lat: row.place_lat ?? null,
        place_lng: row.place_lng ?? null,
        kakao_id: row.kakao_id ?? null,
        address_name: row.address_name ?? "",
        road_address_name: row.road_address_name ?? "",
        phone: row.phone ?? "",
        category_name: row.category_name ?? "",
        category_group_code: row.category_group_code ?? "",
        category_group_name: row.category_group_name ?? "",
        place_url: row.place_url ?? "",
      };

      await api.put(`/pending-entries/${row.entry_id}`, payload);

      // 2) entries로 전송 + sended=TRUE
      await api.post(`/pending-entries/send/${row.entry_id}`);

      alert("전송 완료-!! ;-)");
      setRows((prev) => prev.filter((r) => r.entry_id !== row.entry_id));
      setAllRows((prev) => prev.filter((r) => r.entry_id !== row.entry_id));
    } catch (err) {
      console.error(err);
      alert("전송 중 오류가 발생했습니다.");
    }
  };

  // 모든 항목을 Entries로 전송 (현재 필터링된 항목만)
  const sendAllEntries = async () => {
    if (rows.length === 0) {
      alert("전송할 항목이 없습니다.");
      return;
    }

    if (!window.confirm("모든 항목을 확정(Entries로 전송)하시겠습니까?")) return;

    try {
      // 현재 화면에 표시된 항목들의 entry_id만 전송
      const entryIds = rows.map(r => r.entry_id);
      const res = await api.post("/pending-entries/send-filtered", {
        entry_ids: entryIds
      });
      const sentCount = res.data.sent_count ?? 0;
      
      if (sentCount === 0) {
        alert("전송할 항목이 없습니다.");
      } else {
        alert(`${sentCount}건이 전송되었습니다.`);
      }
      
      // 데이터 다시 로드 (sended = 0인 항목만 표시됨)
      await loadData();
      
      // 필터가 활성화되어 있으면 다시 적용
      if (isFilterActive) {
        applyFilter();
      }
    } catch (err) {
      console.error(err);
      alert("전송 중 오류가 발생했습니다.");
    }
  };

  // ─────────────────────────────────────────────
  // MultiSelect용 메모/콜백 → EntriesGrid와 동일 패턴
  // ─────────────────────────────────────────────

  const cat1Options = useMemo(
    () => [
      { value: -1, label: "[전체]" },
      ...cat1List.map((c) => ({ value: c.id, label: c.name })),
    ],
    [cat1List]
  );

  const cat1_onSpecialClick = useCallback(
    (v: number) => {
      if (v !== -1) return false;
      const all = cat1List.map((c) => c.id);
      setFilter((prev) => ({
        ...prev,
        cat1: prev.cat1.length === all.length ? [] : all,
        cat2: [],
        cat3: [],
      }));
      return true;
    },
    [cat1List]
  );

  const cat1_onChange = useCallback((list: number[]) => {
    setFilter((prev) => ({
      ...prev,
      cat1: list.filter((v) => v > 0),
      cat2: [],
      cat3: [],
    }));
  }, []);

  const cat1_isChecked = useCallback(
    (v: number) => {
      if (v === -1) return filter.cat1.length === cat1List.length;
      return filter.cat1.includes(v);
    },
    [filter.cat1, cat1List]
  );

  // CategoryS
  const cat2Options = useMemo(() => {
    const result: any[] = [];
    if (filter.cat1.length) result.push({ value: -1, label: "[전체]" });

    filter.cat1.forEach((cid) => {
      const parent = cat1List.find((c) => c.id === cid);
      if (!parent) return;

      result.push({ value: -(1000 + cid), label: `(${parent.name} 전체)` });

      cat2List
        .filter((c) => c.cat1_id === cid)
        .forEach((c) => {
          result.push({ value: c.id, label: c.name });
        });
    });

    return result;
  }, [filter.cat1, cat1List, cat2List]);

  const cat2_onSpecialClick = useCallback(
    (v: number) => {
      if (v === -1) {
        const all = cat2List
          .filter((c) => filter.cat1.includes(c.cat1_id))
          .map((c) => c.id);

        setFilter((prev) => ({
          ...prev,
          cat2: prev.cat2.length === all.length ? [] : all,
        }));
        return true;
      }

      if (v <= -1000) {
        const cid = -(v + 1000);
        const ids = cat2List.filter((c) => c.cat1_id === cid).map((c) => c.id);
        const allSelected = ids.every((id) => filter.cat2.includes(id));

        setFilter((prev) => ({
          ...prev,
          cat2: allSelected
            ? prev.cat2.filter((id) => !ids.includes(id))
            : Array.from(new Set([...prev.cat2, ...ids])),
        }));

        return true;
      }

      return false;
    },
    [filter.cat1, filter.cat2, cat2List]
  );

  const cat2_onChange = useCallback((list: number[]) => {
    setFilter((prev) => ({
      ...prev,
      cat2: list.filter((v) => v > 0),
    }));
  }, []);

  const cat2_isChecked = useCallback(
    (v: number) => {
      if (v === -1) {
        const all = cat2List
          .filter((c) => filter.cat1.includes(c.cat1_id))
          .map((c) => c.id);
        return filter.cat2.length === all.length;
      }

      if (v <= -1000) {
        const cid = -(v + 1000);
        const children = cat2List.filter((c) => c.cat1_id === cid).map((c) => c.id);
        return children.every((id) => filter.cat2.includes(id));
      }

      return filter.cat2.includes(v);
    },
    [filter.cat1, filter.cat2, cat2List]
  );

  // CategoryD
  const cat3Options = useMemo(() => {
    const result: any[] = [];
    if (filter.cat2.length) result.push({ value: -1, label: "[전체]" });

    filter.cat2.forEach((cid) => {
      const parent = cat2List.find((c) => c.id === cid);
      if (!parent) return;

      result.push({ value: -(2000 + cid), label: `(${parent.name} 전체)` });

      cat3List
        .filter((c) => c.cat2_id === cid)
        .forEach((c) => {
          result.push({ value: c.id, label: c.name });
        });
    });

    return result;
  }, [filter.cat2, cat2List, cat3List]);

  const cat3_onSpecialClick = useCallback(
    (v: number) => {
      if (v === -1) {
        const all = cat3List
          .filter((c) => filter.cat2.includes(c.cat2_id))
          .map((c) => c.id);

        setFilter((prev) => ({
          ...prev,
          cat3: prev.cat3.length === all.length ? [] : all,
        }));
        return true;
      }

      if (v <= -2000) {
        const cid = -(v + 2000);
        const ids = cat3List.filter((c) => c.cat2_id === cid).map((c) => c.id);
        const allSelected = ids.every((id) => filter.cat3.includes(id));

        setFilter((prev) => ({
          ...prev,
          cat3: allSelected
            ? prev.cat3.filter((id) => !ids.includes(id))
            : Array.from(new Set([...prev.cat3, ...ids])),
        }));

        return true;
      }

      return false;
    },
    [filter.cat2, filter.cat3, cat3List]
  );

  const cat3_onChange = useCallback((list: number[]) => {
    setFilter((prev) => ({
      ...prev,
      cat3: list.filter((v) => v > 0),
    }));
  }, []);

  const cat3_isChecked = useCallback(
    (v: number) => {
      if (v === -1) {
        const all = cat3List
          .filter((c) => filter.cat2.includes(c.cat2_id))
          .map((c) => c.id);
        return filter.cat3.length === all.length;
      }

      if (v <= -2000) {
        const cid = -(v + 2000);
        const children = cat3List.filter((c) => c.cat2_id === cid).map((c) => c.id);
        return children.every((id) => filter.cat3.includes(id));
      }

      return filter.cat3.includes(v);
    },
    [filter.cat2, filter.cat3, cat3List]
  );

  // PaymentMethods
  const payOptions = useMemo(
    () => [
      { value: "__ALL__", label: "(전체 결제 수단)" },
      ...payList.map((p) => ({ value: p.code, label: p.name })),
    ],
    [payList]
  );

  const pay_onSpecialClick = useCallback(
    (v: string) => {
      if (v !== "__ALL__") return false;
      const all = payList.map((p) => p.code);
      setFilter((prev) => ({
        ...prev,
        pay: prev.pay.length === all.length ? [] : all,
      }));
      return true;
    },
    [payList]
  );

  const pay_onChange = useCallback((list: string[]) => {
    setFilter((prev) => ({
      ...prev,
      pay: list,
    }));
  }, []);

  const pay_isChecked = useCallback(
    (v: string) => {
      if (v === "__ALL__") return filter.pay.length === payList.length;
      return filter.pay.includes(v);
    },
    [filter.pay, payList]
  );

  const isFilterActive = useMemo(() => {
    return (
      filter.dateFrom ||
      filter.dateTo ||
      filter.cat1.length > 0 ||
      filter.cat2.length > 0 ||
      filter.cat3.length > 0 ||
      filter.pay.length > 0 ||
      filter.memo.trim() !== ""
    );
  }, [filter]);

  // 클라이언트 사이드 필터 적용
  const applyFilter = () => {
    let filtered = [...allRows];

    if (filter.dateFrom) {
      filtered = filtered.filter((r) => r.tx_date >= filter.dateFrom);
    }
    if (filter.dateTo) {
      filtered = filtered.filter((r) => r.tx_date <= filter.dateTo);
    }
    if (filter.cat1.length) {
      filtered = filtered.filter((r) => filter.cat1.includes(r.cat1_id));
    }
    if (filter.cat2.length) {
      filtered = filtered.filter((r) => filter.cat2.includes(r.cat2_id));
    }
    if (filter.cat3.length) {
      filtered = filtered.filter((r) => filter.cat3.includes(r.cat3_id));
    }
    if (filter.pay.length) {
      filtered = filtered.filter((r) => filter.pay.includes(r.pay_method));
    }
    if (filter.memo.trim()) {
      const q = filter.memo.trim();
      filtered = filtered.filter((r) => (r.memo ?? "").includes(q));
    }

    setRows(filtered);
    setFilterOpen(false);
  };

  // 드래그 제스처 핸들러
  const handleRevealDrag = (id: number, startX: number) => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      const currentX = "touches" in e ? e.touches[0].clientX : e.clientX;
      if (Math.abs(currentX - startX) > 30) {
        setRows(prev =>
          prev.map(r =>
            r.entry_id === id ? { ...r, reveal_amount: true } : r
          )
        );
      }
    };

    const onEnd = () => {
      setRows(prev =>
        prev.map(r =>
          r.entry_id === id ? { ...r, reveal_amount: false } : r
        )
      );
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchend", onEnd);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchend", onEnd);
  };

  const startReveal = (id: number, e: any) => {
    const startX = e.clientX ?? e.touches?.[0]?.clientX;
    handleRevealDrag(id, startX);
  };

  return (
    <div className="page-wrap">
      <Menu />
      <h1 className="page-title">Pending Entries</h1>

      {/* 상단 툴바: Excel Import + Filter + Reload */}
      <div className="toolbar-wrap">
        <div className="toolbar">
          <div className="toolbar-left">
            <label className="ui-btn long import-btn">
              Excel 불러오기
              <input type="file" accept=".xlsx" onChange={importExcel} style={{ display: "none" }} />
            </label>
          </div>

          <div className="toolbar-btns">
            <button onClick={() => setFilterOpen(true)} className="filter-btn">
              {isFilterActive ? "☑ 필터" : "☐ 필터"}
            </button>

            <button
              onClick={sendAllEntries}
              className="ui-btn"
            >
              모두 전송
            </button>

            <button 
              onClick={saveData} 
              className="ui-btn primary"
              disabled={dirtyCount === 0}
            >
              저장 {dirtyCount > 0 ? `(${dirtyCount})` : ''}
            </button>
          </div>
        </div>
      </div>

      {/* 카드 리스트 */}
      <div className="card-list">
        {rows.map((row) => {
          const cat1Name =
            cat1List.find((c) => c.id === row.cat1_id)?.name ?? "—";

          const isBlur = (() => {
            const c2meta = cat2List.find((c) => c.id === row.cat2_id);
            return c2meta?.blur === 1;
          })();

          const formattedDate = row.tx_date
            ? new Date(row.tx_date).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "numeric",
                day: "numeric",
              })
            : "--/--";

          const payName =
            payList.find((p) => String(p.code) === String(row.pay_method))
              ?.name ?? "";

          return (
            <article
              key={row.entry_id}
              className={`card ${row.editable ? "editing" : ""} ${
                row.__dirty ? "__dirty" : ""
              }`}
            >
              {/* IN/OUT 색상 바 */}
              {/* 소분류 선택 시 자동 설정되므로 클릭 이벤트 제거 */}
              {/* onClick={() => toggleInOut(row.entry_id)}
              title={
                row.inout === 1
                  ? "IN(수입) → OUT으로 전환"
                  : "OUT(지출) → IN으로 전환"
              } */}
              <div
                className={`inout-bar ${
                  row.inout === 1 ? "in-bar" : row.inout === -1 ? "out-bar" : ""
                }`}
              ></div>

              {/* 1행: 날짜 / 장소 / Send 버튼 */}
              <div className="card-row row-top">
                <div className="card-left">
                  {row.editable ? (
                    <input
                      type="date"
                      value={row.tx_date ? row.tx_date.substring(0, 10) : ""}
                      onChange={(e) =>
                        handleChange(row.entry_id, "tx_date", e.target.value)
                      }
                      className="date-input"
                    />
                  ) : (
                    <span className="date-badge">{formattedDate}</span>
                  )}
                </div>
                <div className="card-right place-right">
                  <span className="place-text">
                    📍 {row.place_name || "—"}
                  </span>
                  <button
                    className="ui-btn small"
                    onClick={() => sendOne(row)}
                  >
                    전송
                  </button>
                </div>
              </div>

              {/* 2행: 카테고리 */}
              <div className="row-category">
                {row.editable ? (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 auto', minWidth: '80px', maxWidth: '120px' }}>
                      <SingleSelect
                        options={cat1List.map(c => ({ value: String(c.id), label: c.name }))}
                        selected={row.cat1_id ? String(row.cat1_id) : ""}
                        onChange={(value) => handleChange(row.entry_id, "cat1_id", value ? Number(value) : null)}
                        placeholder="(중분류)"
                      />
                    </div>

                    <div style={{ flex: '1 1 auto', minWidth: '80px', maxWidth: '120px' }}>
                      <SingleSelect
                        options={cat2List
                          .filter((c) => c.cat1_id === row.cat1_id)
                          .map(c => ({ value: String(c.id), label: c.name }))}
                        selected={row.cat2_id ? String(row.cat2_id) : ""}
                        onChange={(value) => handleChange(row.entry_id, "cat2_id", value ? Number(value) : null)}
                        placeholder="(소분류)"
                      />
                    </div>

                    <div style={{ flex: '1 1 auto', minWidth: '80px', maxWidth: '120px' }}>
                      <SingleSelect
                        options={cat3List
                          .filter((c) => c.cat2_id === row.cat2_id)
                          .map(c => ({ value: String(c.id), label: c.name }))}
                        selected={row.cat3_id ? String(row.cat3_id) : ""}
                        onChange={(value) => handleChange(row.entry_id, "cat3_id", value ? Number(value) : null)}
                        placeholder="(세분류)"
                      />
                    </div>
                  </div>
                ) : (
                  <span className="cat-display">
                    <span className="cat-text">{cat1Name}</span>
                    <span className="cat-sep"> &gt; </span>
                    <span className="cat-text">
                      {cat2List.find((c) => c.id === row.cat2_id)?.name ??
                        "—"}
                    </span>
                    {row.cat3_id && (
                      <>
                        <span className="cat-sep"> &gt; </span>
                        <span className="cat3-text">
                          {cat3List.find((c) => c.id === row.cat3_id)?.name ??
                            "—"}
                        </span>
                      </>
                    )}
                  </span>
                )}
              </div>

              {/* 3행: 결제 수단 + 금액 */}
              <div className="row-payment">
                {row.editable ? (
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 auto', minWidth: '80px', maxWidth: '120px' }}>
                      <SingleSelect
                        options={payList.map(p => ({ value: p.code, label: p.name }))}
                        selected={row.pay_method || ""}
                        onChange={(value) => handleChange(row.entry_id, "pay_method", value)}
                        placeholder="(결제 수단)"
                      />
                    </div>
                    <input
                      type="number"
                      value={row.amount ?? ""}
                      onChange={(e) =>
                        handleChange(
                          row.entry_id,
                          "amount",
                          Number(e.target.value)
                        )
                      }
                      className="amount-input"
                      style={{ width: '100px', height: '28px' }}
                    />
                  </div>
                ) : (
                  <>
                    <span className="pay-method-text">{payName}</span>
                    <span
                      className={`amount-text ${
                        isBlur && !row.reveal_amount ? "masked" : "revealed"
                      }`}
                      onMouseDown={(e) => isBlur && startReveal(row.entry_id, e)}
                      onTouchStart={(e) => isBlur && startReveal(row.entry_id, e)}
                    >
                      {typeof row.amount === "number"
                        ? row.amount.toLocaleString("ko-KR")
                        : ""}
                    </span>
                  </>
                )}
              </div>

              {/* 3행: 메모 / Edit 토글 */}
              <div className="card-row row-bottom">
                <div className="card-left">
                  {row.editable ? (
                    <input
                      type="text"
                      value={row.memo || ""}
                      onChange={(e) =>
                        handleChange(row.entry_id, "memo", e.target.value)
                      }
                      className="memo-input"
                    />
                  ) : (
                    <span className="memo-text">{row.memo || " "}</span>
                  )}
                </div>
                <div className="card-right">
                  <label className="edit-toggle">
                    <input
                      type="checkbox"
                      checked={row.editable}
                      onChange={() => toggleEditable(row.entry_id)}
                    />
                    <span className="edit-label">편집</span>
                  </label>
                </div>
              </div>

              {/* Edit 모드 전용: 장소 편집 버튼 */}
              {row.editable && (
                <div className="card-row row-edit-actions">
                  <button className="ui-btn edit-location-btn"
                    onClick={() => setActivePlaceEdit(row.entry_id)}
                  >
                    장소/가게 편집
                  </button>

                  <button className="delete-btn"
                    onClick={() => deletePending(row.entry_id)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* 필터 팝업 */}
      {filterOpen && (
        <div className="popup-overlay" onClick={() => setFilterOpen(false)}>
          <div className="popup-panel" onClick={(e) => e.stopPropagation()}>
            <h3>검색 필터</h3>

            {/* 1행: 날짜 */}
            <div className="filter-row">
              <div className="filter-col">
                <label>시작일</label>
                <input
                  type="date"
                  value={filter.dateFrom}
                  onChange={(e) =>
                    setFilter({ ...filter, dateFrom: e.target.value })
                  }
                />
              </div>

              <div className="filter-col">
                <label>종료일</label>
                <input
                  type="date"
                  value={filter.dateTo}
                  onChange={(e) =>
                    setFilter({ ...filter, dateTo: e.target.value })
                  }
                />
              </div>
            </div>

            {/* 2행: 중분류 / 소분류 */}
            <div className="filter-row">
              <div className="filter-col">
                <label>중분류</label>
                <MultiSelect
                  options={cat1Options}
                  selected={filter.cat1}
                  onSpecialClick={cat1_onSpecialClick}
                  onChange={cat1_onChange}
                  isOptionChecked={cat1_isChecked}
                />
              </div>

              <div className="filter-col">
                <label>소분류</label>
                <MultiSelect
                  options={cat2Options}
                  selected={filter.cat2}
                  onSpecialClick={cat2_onSpecialClick}
                  onChange={cat2_onChange}
                  isOptionChecked={cat2_isChecked}
                />
              </div>
            </div>

            {/* 3행: 세분류 / 결제 수단 */}
            <div className="filter-row">
              <div className="filter-col">
                <label>세분류</label>
                <MultiSelect
                  options={cat3Options}
                  selected={filter.cat3}
                  onSpecialClick={cat3_onSpecialClick}
                  onChange={cat3_onChange}
                  isOptionChecked={cat3_isChecked}
                />
              </div>

              <div className="filter-col">
                <label>결제 수단</label>
                <MultiSelect
                  options={payOptions}
                  selected={filter.pay}
                  onSpecialClick={pay_onSpecialClick}
                  onChange={pay_onChange}
                  isOptionChecked={pay_isChecked}
                />
              </div>
            </div>

            {/* 4행: 메모 (전체 너비) */}
            <div className="filter-row">
              <div className="filter-col" style={{ flex: '1 1 100%' }}>
                <label>메모</label>
                <input
                  type="text"
                  value={filter.memo}
                  onChange={(e) =>
                    setFilter({ ...filter, memo: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="btn-row">
              <button className="ui-btn" onClick={() => setFilterOpen(false)}>
                닫기
              </button>
              <button
                className="ui-btn"
                onClick={() =>
                  setFilter({
                    dateFrom: "",
                    dateTo: "",
                    cat1: [],
                    cat2: [],
                    cat3: [],
                    pay: [],
                    memo: "",
                  })
                }
              >
                초기화
              </button>
              <button className="ui-btn primary" onClick={applyFilter}>
                적용
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 장소 선택 팝업 */}
      {activePlaceEdit !== null && (
        <PlacePicker
          onSelect={async (place) => {
            if (activePlaceEdit === null) return;

            // ① 이미 DB에 저장된 장소인 경우 → place_id 존재
            if (place.place_id) {
              handleChange(activePlaceEdit, "place_id", place.place_id);
              handleChange(activePlaceEdit, "place_name", place.place_name);
              handleChange(activePlaceEdit, "place_lat", place.lat);
              handleChange(activePlaceEdit, "place_lng", place.lng);

              handleChange(activePlaceEdit, "kakao_id", place.kakao_id);
              handleChange(activePlaceEdit, "address_name", place.address_name);
              handleChange(activePlaceEdit, "road_address_name", place.road_address_name);
              handleChange(activePlaceEdit, "phone", place.phone);
              handleChange(activePlaceEdit, "category_name", place.category_name);
              handleChange(activePlaceEdit, "category_group_code", place.category_group_code);
              handleChange(activePlaceEdit, "category_group_name", place.category_group_name);
              handleChange(activePlaceEdit, "place_url", place.place_url);

              setActivePlaceEdit(null);
              return;
            }

            // ② kakao_id만 있고 place_id는 없는 경우 → DB에 있는지 확인
            if (place.kakao_id) {
              const res = await api.get("/places/exists-by-kakao", {
                params: { kakao_id: place.kakao_id },
              });

              if (res.data?.place_id) {
                handleChange(activePlaceEdit, "place_id", res.data.place_id);
                handleChange(activePlaceEdit, "place_name", place.place_name);
                handleChange(activePlaceEdit, "kakao_id", place.kakao_id);
                setActivePlaceEdit(null);
                return;
              }
            }

            // ③ 완전 신규 kakao 장소 → 일단 Pending row에 전체 메타 세팅
            handleChange(activePlaceEdit, "place_id", null);
            handleChange(activePlaceEdit, "place_name", place.place_name);
            handleChange(activePlaceEdit, "place_lat", place.lat);
            handleChange(activePlaceEdit, "place_lng", place.lng);

            handleChange(activePlaceEdit, "kakao_id", place.kakao_id);
            handleChange(activePlaceEdit, "address_name", place.address_name);
            handleChange(activePlaceEdit, "road_address_name", place.road_address_name);
            handleChange(activePlaceEdit, "phone", place.phone);
            handleChange(activePlaceEdit, "category_name", place.category_name);
            handleChange(activePlaceEdit, "category_group_code", place.category_group_code);
            handleChange(activePlaceEdit, "category_group_name", place.category_group_name);
            handleChange(activePlaceEdit, "place_url", place.place_url);

            setActivePlaceEdit(null);
          }}
          onClose={() => setActivePlaceEdit(null)}
        />
      )}
      <button
        className="calculator-trigger-button"
        onClick={() => setCalculatorOpen(!calculatorOpen)}
        aria-label="Calculator"
      >
        계산기
      </button>
      {calculatorOpen && (
        <CalculatorPopup onClose={() => setCalculatorOpen(false)} />
      )}
    </div>
  );
}