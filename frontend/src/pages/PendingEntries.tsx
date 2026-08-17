import { visible } from "../utils/visible";
import { useEffect, useState, useMemo, useCallback } from "react";
import api from "../api/client";
import useBackClose from "../hooks/useBackClose";
import PlacePicker from "./components/PlacePicker";
import MultiSelect from "./components/MultiSelect";
import SingleSelect from "./components/SingleSelect";
import CalculatorPopup from "./components/CalculatorPopup";
import CardEditModal, { EditField, EditDivider } from "./components/CardEditModal";
import SplitEditor from "./components/SplitEditor";
import type { SplitDraft } from "./components/SplitEditor";
import { groupByDate } from "../utils/dateGroup";
import DateGroupHeader from "./components/DateGroupHeader";
import { CollapseAllButtons } from "./components/CollapseToggle";
import SplitRows from "./components/SplitRows";
import useLongPress from "../hooks/useLongPress";

const EMPTY_FILTER = {
  dateFrom: "",
  dateTo: "",
  cat1: [] as number[],
  cat2: [] as number[],
  cat3: [] as number[],
  pay: [] as string[],
  memo: "",
  /* 지출을 적을 때 고를 수 있는 것은 모두 걸러 낼 수 있어야 한다 */
  inout: 0,                 // 0 = 가리지 않음, 1 = 들어옴, -1 = 나감
  amountMin: "",
  amountMax: "",
  place: "",
  cp: [] as number[],       // 함께한 상대
};

/** 걸린 조건이 하나라도 있는지 */
function hasCondition(f: typeof EMPTY_FILTER): boolean {
  return (
    f.dateFrom !== "" ||
    f.dateTo !== "" ||
    f.cat1.length > 0 ||
    f.cat2.length > 0 ||
    f.cat3.length > 0 ||
    f.pay.length > 0 ||
    f.memo.trim() !== "" ||
    f.inout !== 0 ||
    f.amountMin !== "" ||
    f.amountMax !== "" ||
    f.place.trim() !== "" ||
    f.cp.length > 0
  );
}

export default function PendingEntries() {
  const [rows, setRows] = useState<any[]>([]);
  const [allRows, setAllRows] = useState<any[]>([]); // 필터용 원본

  const [cat1List, setCat1List] = useState<{ id: number; name: string; is_active?: number }[]>([]);
  const [cat2List, setCat2List] = useState<{ id: number; name: string; cat1_id: number; blur?: number; inout?: number | null; is_active?: number }[]>([]);
  const [cat3List, setCat3List] = useState<{ id: number; name: string; cat2_id: number; is_active?: number }[]>([]);
  const [payList, setPayList] = useState<{ code: string; name: string; is_active?: number }[]>([]);

  const [filterOpen, setFilterOpen] = useState(false);

  /* 팝업에서 고치는 중인 값(초안)과 실제로 걸려 있는 값을 나눠 둔다.
     하나로 두면 팝업에서 값을 바꾸는 순간 뒤 화면의 버튼과 기간 표시가
     먼저 바뀌어, [적용]을 누르기도 전에 적용된 것처럼 보였다. */
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [appliedFilter, setAppliedFilter] = useState(EMPTY_FILTER);

  /* 함께한 상대 목록 — 필터에서 고르기 위해 받아 둔다 */
  const [cpList, setCpList] = useState<{ counterpart_id: number; name: string }[]>([]);

  // 편집 팝업 상태 — 카드를 꾹 누르면 열린다
  const [draft, setDraft] = useState<any | null>(null);
  const [splits, setSplits] = useState<SplitDraft[]>([]);
  const [placePickerOpen, setPlacePickerOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  /* 뒤로 가기 · Backspace 로 지금 열린 것만 닫는다.
     카드 편집 팝업은 CardEditModal 이 스스로 처리한다. */
  useBackClose(filterOpen, () => closeFilter());
  useBackClose(placePickerOpen, () => setPlacePickerOpen(false));

  useEffect(() => {
    api.get("/categories/lvl1").then((r) => setCat1List(r.data));
    api.get("/categories/lvl2").then((r) => setCat2List(r.data));
    api.get("/counterparts").then((r) => setCpList(r.data));
    api.get("/categories/lvl3").then((r) => setCat3List(r.data));
    api.get("/payment-methods").then((r) =>
      setPayList(
        r.data.map((p: any) => ({
          code: p.method_id,
          name: p.method_name,
          is_active: p.is_active,
        }))
      )
    );
  }, []);

  // 팝업 열렸을 때 뒤 화면 스크롤/인터랙션 막기
  useEffect(() => {
    if (filterOpen || calculatorOpen || draft || placePickerOpen) {
      document.documentElement.classList.add("modal-open");
    } else {
      document.documentElement.classList.remove("modal-open");
    }
  }, [filterOpen, calculatorOpen, draft, placePickerOpen]);

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

  // ------------------------------------
  // 편집 팝업
  // ------------------------------------

  const openEditor = useCallback((row: any) => {
    setDraft({ ...row });
    // 분할은 목록 조회에 합계만 실려 오므로, 편집할 때 상세를 따로 가져온다
    setSplits([]);
    if (row.split_count > 0) {
      api
        .get(`/pending-entries/${row.entry_id}/splits`)
        .then((r) =>
          setSplits(
            r.data.map((x: SplitDraft) => ({
              amount: x.amount,
              counterpart_id: x.counterpart_id,
              memo: x.memo,
            }))
          )
        )
        .catch(() => setSplits([]));
    }
  }, []);

  const closeEditor = useCallback(() => {
    setDraft(null);
    setSplits([]);
    setPlacePickerOpen(false);
  }, []);

  // 팝업 안 필드 변경
  const setField = (field: string, value: any) => {
    setDraft((prev: any) => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };

      // 소분류 변경 시 IN/OUT 자동 설정
      if (field === "cat2_id") {
        const selectedCat2 = cat2List.find(c => c.id === value);
        if (selectedCat2 && selectedCat2.inout !== null && selectedCat2.inout !== undefined) {
          next.inout = selectedCat2.inout;
        }
        if (prev.cat2_id !== value) next.cat3_id = null;
      }

      // 중분류가 바뀌면 하위 선택 초기화
      if (field === "cat1_id" && prev.cat1_id !== value) {
        next.cat2_id = null;
        next.cat3_id = null;
      }

      return next;
    });
  };

  // IN/OUT 전환(소분류 선택 시 자동 설정되므로 비활성화)
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

  // 팝업에서 저장 — 해당 건만 반영한다
  const saveDraft = async () => {
    if (!draft) return;

    // 분할 검증 — 빈 줄은 버리고, 합계가 결제 금액을 넘으면 막는다
    const cleanSplits = splits.filter(
      (x) => x.amount !== "" && Number(x.amount) > 0
    );
    if (splits.some((x) => x.amount === "" || Number(x.amount) <= 0)) {
      alert("분할 금액은 0보다 커야 합니다.");
      return;
    }
    const splitSum = cleanSplits.reduce((a, r) => a + Number(r.amount), 0);
    if (splitSum > Number(draft.amount)) {
      alert("분할 합계가 결제 금액을 초과합니다.");
      return;
    }

    // 서버가 받아야 하는 형태로 정제 — API 는 배열을 받으므로 1건짜리 배열로 보낸다
    const clean = [{
      entry_id: draft.entry_id,
      tx_date: draft.tx_date?.substring(0, 10),
      cat1_id: draft.cat1_id ?? null,
      cat2_id: draft.cat2_id ?? null,
      cat3_id: draft.cat3_id ?? null,
      inout: draft.inout,
      amount: Number(draft.amount),
      pay_method: draft.pay_method ?? null,
      memo: draft.memo ?? null,

      place_id: draft.place_id ?? null,
      place_name: draft.place_name ?? null,
      place_lat: draft.place_lat ?? null,
      place_lng: draft.place_lng ?? null,
      kakao_id: draft.kakao_id ?? null,
      address_name: draft.address_name ?? null,
      road_address_name: draft.road_address_name ?? null,
      phone: draft.phone ?? null,
      category_name: draft.category_name ?? null,
      category_group_code: draft.category_group_code ?? null,
      category_group_name: draft.category_group_name ?? null,
      place_url: draft.place_url ?? null,
    }];

    try {
      await api.put("/pending-entries/bulk", clean);
      // 분할은 별도 엔드포인트다. 비어 있어도 보내야 기존 분할이 지워진다.
      await api.put(`/pending-entries/${draft.entry_id}/splits`, cleanSplits);
      closeEditor();
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
      closeEditor();
      alert("제거 완료-!! ;-)");
    } catch (err) {
      console.error(err);
      alert("제거 중 오류가 발생했습니다.");
    }
  };

  /* Excel 내보내기 — 뒤에 보완하기로 하고 자리만 만들어 둔다.
     조용히 아무 일도 없으면 눌린 건지 알 수 없으므로 한마디 남긴다. */
  const exportExcel = () => {
    alert("Excel 내보내기는 아직 준비 중입니다.");
  };

  // Excel Import
  const importExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await api.post("/pending-entries/import", fd, {
        baseURL: "/api",
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

  // 모든 항목을 Entries로 전송(현재 필터링된 항목만)
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
      
      // 데이터 다시 로드(sended = 0인 항목만 표시됨)
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
  // MultiSelect용 메모/콜백 → Entries와 동일 패턴
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

  /* 버튼과 기간 표시는 '적용된 값' 만 본다. 초안은 팝업 안에서만 산다 */
  const isFilterActive = useMemo(() => hasCondition(appliedFilter), [appliedFilter]);

  const cpOptions = useMemo(
    () => [
      { value: -1, label: "(전체)" },
      ...cpList.map((c) => ({ value: c.counterpart_id, label: c.name })),
    ],
    [cpList]
  );

  const cp_onSpecialClick = useCallback(
    (v: number) => {
      if (v !== -1) return false;
      const all = cpList.map((c) => c.counterpart_id);
      setFilter((prev) => ({ ...prev, cp: prev.cp.length === all.length ? [] : all }));
      return true;
    },
    [cpList]
  );

  const cp_onChange = useCallback((list: number[]) => {
    setFilter((prev) => ({ ...prev, cp: list }));
  }, []);

  const cp_isChecked = useCallback(
    (v: number) => (v === -1 ? filter.cp.length === cpList.length : filter.cp.includes(v)),
    [filter.cp, cpList]
  );

  // 날짜별 단 — 들어온 순서를 그대로 보존한다.
  // 소분류에 blur 가 걸린 항목이 섞이면 합계도 가려야 하므로 판정 함수를 넘긴다.
  /* 접어 둔 날짜. 비어 있으면 전부 펼쳐진 상태다(지금까지와 같은 모습) */
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const toggleDay = (d: string) =>
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });

  const dateGroups = useMemo(
    () => groupByDate(rows, (r: any) => cat2List.find((c) => c.id === r.cat2_id)?.blur === 1),
    [rows, cat2List]
  );

  // 클라이언트 사이드 필터 적용
  /* [적용]을 누르지 않고 닫으면 고치던 값은 버린다.
     다시 열었을 때 지금 걸려 있는 조건이 그대로 보여야 한다. */
  const closeFilter = () => {
    setFilter(appliedFilter);
    setFilterOpen(false);
  };

  const applyFilter = () => {
    /* 초안을 그대로 확정한다 — 여기부터 화면에 반영된다 */
    setAppliedFilter(filter);

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
    if (filter.inout !== 0) {
      filtered = filtered.filter((r) => r.inout === filter.inout);
    }
    if (filter.amountMin !== "") {
      const min = Number(filter.amountMin);
      filtered = filtered.filter((r) => Number(r.amount) >= min);
    }
    if (filter.amountMax !== "") {
      const max = Number(filter.amountMax);
      filtered = filtered.filter((r) => Number(r.amount) <= max);
    }
    if (filter.place.trim()) {
      const q = filter.place.trim().toLowerCase();
      filtered = filtered.filter((r) => (r.place_name ?? "").toLowerCase().includes(q));
    }
    if (filter.cp.length) {
      filtered = filtered.filter((r) =>
        (r.counterpart_ids ?? []).some((id: number) => filter.cp.includes(id))
      );
    }

    setRows(filtered);
    setFilterOpen(false);
  };

  // 드래그 제스처 핸들러
  const handleRevealDrag = (id: number, startX: number) => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      const currentX = "touches" in e ? e.touches[0].clientX : e.clientX;
      /* 12px 만 끌어도 열리게 한다. 30px 는 뻑뻑했다 */
      if (Math.abs(currentX - startX) > 12) {
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

      {/* 상단 툴바: Excel Import + Filter + Reload */}
      <div className="toolbar-wrap">
        <div className="toolbar">
          <div className="toolbar-left excel-btns">
            <label className="ui-btn small">
              불러오기
              <input type="file" accept=".xlsx" onChange={importExcel} style={{ display: "none" }} />
            </label>
            {/* 내보내기는 자리만 잡아 둔다. 실제 동작은 뒤에 붙인다 */}
            <button type="button" className="ui-btn small" onClick={exportExcel}>
              내보내기
            </button>
          </div>

          <div className="toolbar-btns">
            <CollapseAllButtons
              onExpandAll={() => setCollapsedDays(new Set())}
              onCollapseAll={() => setCollapsedDays(new Set(dateGroups.map((g) => g.date)))}
            />
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className={`filter-pill${isFilterActive ? " on" : ""}`}
              aria-pressed={!!isFilterActive}
              title={isFilterActive ? "필터가 걸려 있다. 눌러서 고친다." : "필터"}
            >
              필터
            </button>

            <button onClick={sendAllEntries} className="ui-btn primary">
              모두 전송
            </button>
          </div>
        </div>
      </div>

      {/* 카드 리스트 — 날짜별 단으로 묶어서 표시 */}
      <div className="card-list">
        {dateGroups.map((group) => (
          <section key={group.date || "no-date"} className="date-group">
            <DateGroupHeader
              label={group.label}
              summary={group.summary}
              open={!collapsedDays.has(group.date)}
              onToggle={() => toggleDay(group.date)}
            />
            {!collapsedDays.has(group.date) &&
              group.items.map((row: any) => (
              <PendingCard
                key={row.entry_id}
                row={row}
                cat1List={cat1List}
                cat2List={cat2List}
                cat3List={cat3List}
                payList={payList}
                onOpenEditor={openEditor}
                onStartReveal={startReveal}
                onSend={sendOne}
              />
            ))}
          </section>
        ))}
      </div>


      {/* 편집 팝업 */}
      {draft && (
        <CardEditModal
          title="미확정 내역 편집"
          subtitle={draft.tx_date ? new Date(draft.tx_date).toLocaleDateString("ko-KR") : undefined}
          onClose={closeEditor}
          onSave={saveDraft}
          onDelete={() => deletePending(draft.entry_id)}
          headerFields={
            <EditField label="날짜" span={12}>
              <input
                type="date"
                value={draft.tx_date ? draft.tx_date.substring(0, 10) : ""}
                onChange={(e) => setField("tx_date", e.target.value)}
              />
            </EditField>
          }
        >
          <div className="edit-grid">
            {/* 1행 — 분류 3단 */}
            <EditField label="중분류" span={4}>
              <SingleSelect
                options={visible(cat1List, (c) => c.id === draft.cat1_id)
                  .map(c => ({ value: String(c.id), label: c.name }))}
                selected={draft.cat1_id ? String(draft.cat1_id) : ""}
                onChange={(value) => setField("cat1_id", value ? Number(value) : null)}
                placeholder="(중분류)"
              />
            </EditField>

            <EditField label="소분류" span={4}>
              <SingleSelect
                options={visible(cat2List, (c) => c.id === draft.cat2_id)
                  .filter((c) => c.cat1_id === draft.cat1_id)
                  .map(c => ({ value: String(c.id), label: c.name }))}
                selected={draft.cat2_id ? String(draft.cat2_id) : ""}
                onChange={(value) => setField("cat2_id", value ? Number(value) : null)}
                placeholder="(소분류)"
              />
            </EditField>

            <EditField label="세분류" span={4}>
              <SingleSelect
                options={visible(cat3List, (c) => c.id === draft.cat3_id)
                  .filter((c) => c.cat2_id === draft.cat2_id)
                  .map(c => ({ value: String(c.id), label: c.name }))}
                selected={draft.cat3_id ? String(draft.cat3_id) : ""}
                onChange={(value) => setField("cat3_id", value ? Number(value) : null)}
                placeholder="(세분류)"
              />
            </EditField>

            {/* 2행 — 거래 속성. IN/OUT 은 소분류가 결정하므로 분류 바로 아래에 둔다 */}
            <EditField label="IN/OUT" span={4}>
              <span className={`inout-chip ${draft.inout === 1 ? "in" : draft.inout === -1 ? "out" : ""}`}>
                {draft.inout === 1 ? "IN(+)" : draft.inout === -1 ? "OUT(−)" : "—"}
              </span>
            </EditField>

            <EditField label="결제 수단" span={4}>
              <SingleSelect
                options={visible(payList, (p) => p.code === draft.pay_method)
                  .map(p => ({ value: p.code, label: p.name }))}
                selected={draft.pay_method || ""}
                onChange={(value) => setField("pay_method", value)}
                placeholder="(결제 수단)"
              />
            </EditField>

            <EditField label="금액" span={4}>
              <input
                type="number"
                value={draft.amount ?? ""}
                onChange={(e) => setField("amount", e.target.value === "" ? "" : Number(e.target.value))}
                className="amount-input"
              />
            </EditField>

            {/* 3행 — 장소 */}
            <EditField label="장소/가게" span={12}>
              <div className="edit-place">
                <span className="edit-place__name">📍 {draft.place_name || "—"}</span>
                <button
                  type="button"
                  className="ui-btn small edit-location-btn"
                  onClick={() => setPlacePickerOpen(true)}
                >
                  변경
                </button>
              </div>
            </EditField>

            {/* 4행 — 메모 */}
            <EditField label="메모" span={12}>
              <input
                type="text"
                value={draft.memo || ""}
                onChange={(e) => setField("memo", e.target.value)}
                className="memo-input"
              />
            </EditField>
          </div>

          {/* 금액 쪼개기 — 지출일 때만 의미가 있다 */}
          {draft.inout === -1 && (
            <>
              <EditDivider />
              <SplitEditor
                grossAmount={Number(draft.amount) || 0}
                value={splits}
                onChange={setSplits}
              />
            </>
          )}
        </CardEditModal>
      )}

      {/* 필터 팝업 */}
      {filterOpen && (
        <div className="popup-overlay" onClick={closeFilter}>
          <div className="popup-panel popup-panel--framed" onClick={(e) => e.stopPropagation()}>
            {/* 머리·본문·바닥을 편집 팝업과 같은 짜임으로 */}
            <header className="popup-head">
              <h3 className="popup-head__title">필터</h3>
            </header>

            {/* 편집 팝업과 같은 12칸 격자. 성격이 다른 묶음 사이는 구분선으로 가른다 */}
            <div className="popup-body edit-grid">
              <EditField label="시작일" span={6}>
                <input
                  type="date"
                  value={filter.dateFrom}
                  onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })}
                />
              </EditField>

              <EditField label="종료일" span={6}>
                <input
                  type="date"
                  value={filter.dateTo}
                  onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })}
                />
              </EditField>

              <EditDivider />

              <EditField label="중분류" span={4}>
                <MultiSelect
                  options={cat1Options}
                  selected={filter.cat1}
                  onSpecialClick={cat1_onSpecialClick}
                  onChange={cat1_onChange}
                  isOptionChecked={cat1_isChecked}
                  placeholder="(전체)"
                />
              </EditField>

              <EditField label="소분류" span={4}>
                <MultiSelect
                  options={cat2Options}
                  selected={filter.cat2}
                  onSpecialClick={cat2_onSpecialClick}
                  onChange={cat2_onChange}
                  isOptionChecked={cat2_isChecked}
                  placeholder="(전체)"
                />
              </EditField>

              <EditField label="세분류" span={4}>
                <MultiSelect
                  options={cat3Options}
                  selected={filter.cat3}
                  onSpecialClick={cat3_onSpecialClick}
                  onChange={cat3_onChange}
                  isOptionChecked={cat3_isChecked}
                  placeholder="(전체)"
                />
              </EditField>

              <EditDivider />

              <EditField label="IN/OUT" span={6}>
                <SingleSelect
                  options={[
                    { value: "0", label: "(전체)" },
                    { value: "-1", label: "OUT(−)" },
                    { value: "1", label: "IN(+)" },
                  ]}
                  selected={String(filter.inout)}
                  onChange={(v) => setFilter({ ...filter, inout: Number(v) })}
                  placeholder="(전체)"
                />
              </EditField>

              <EditField label="결제 수단" span={6}>
                <MultiSelect
                  options={payOptions}
                  selected={filter.pay}
                  onSpecialClick={pay_onSpecialClick}
                  onChange={pay_onChange}
                  isOptionChecked={pay_isChecked}
                  placeholder="(전체)"
                />
              </EditField>

              <EditField label="금액" span={12}>
                <div className="filter-range">
                  <input
                    type="number"
                    className="amount-input"
                    value={filter.amountMin}
                    placeholder="(최소)"
                    onChange={(e) => setFilter({ ...filter, amountMin: e.target.value })}
                  />
                  <span className="filter-range__tilde">~</span>
                  <input
                    type="number"
                    className="amount-input"
                    value={filter.amountMax}
                    placeholder="(최대)"
                    onChange={(e) => setFilter({ ...filter, amountMax: e.target.value })}
                  />
                </div>
              </EditField>

              <EditDivider />

              <EditField label="장소" span={6}>
                <input
                  type="text"
                  value={filter.place}
                  placeholder="(장소)"
                  onChange={(e) => setFilter({ ...filter, place: e.target.value })}
                />
              </EditField>

              <EditField label="함께한 상대" span={6}>
                <MultiSelect
                  options={cpOptions}
                  selected={filter.cp}
                  onSpecialClick={cp_onSpecialClick}
                  onChange={cp_onChange}
                  isOptionChecked={cp_isChecked}
                  placeholder="(전체)"
                />
              </EditField>

              <EditField label="메모" span={12}>
                <input
                  type="text"
                  value={filter.memo}
                  placeholder="(메모)"
                  onChange={(e) => setFilter({ ...filter, memo: e.target.value })}
                />
              </EditField>
            </div>

            <div className="btn-row popup-foot">
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
                    inout: 0,
                    amountMin: "",
                    amountMax: "",
                    place: "",
                    cp: [],
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
      {placePickerOpen && draft && (
        <PlacePicker
          onSelect={async (place) => {
            // ① 이미 DB에 저장된 장소인 경우 → place_id 존재
            if (place.place_id) {
              setDraft((prev: any) => prev && ({
                ...prev,
                place_id: place.place_id,
                place_name: place.place_name,
                place_lat: place.lat,
                place_lng: place.lng,
                kakao_id: place.kakao_id,
                address_name: place.address_name,
                road_address_name: place.road_address_name,
                phone: place.phone,
                category_name: place.category_name,
                category_group_code: place.category_group_code,
                category_group_name: place.category_group_name,
                place_url: place.place_url,
              }));
              setPlacePickerOpen(false);
              return;
            }

            // ② kakao_id만 있고 place_id는 없는 경우 → DB에 있는지 확인
            if (place.kakao_id) {
              const res = await api.get("/places/exists-by-kakao", {
                params: { kakao_id: place.kakao_id },
              });

              if (res.data?.place_id) {
                setDraft((prev: any) => prev && ({
                  ...prev,
                  place_id: res.data.place_id,
                  place_name: place.place_name,
                  kakao_id: place.kakao_id,
                }));
                setPlacePickerOpen(false);
                return;
              }
            }

            // ③ 완전 신규 kakao 장소 → 일단 draft에 전체 메타 세팅
            setDraft((prev: any) => prev && ({
              ...prev,
              place_id: null,
              place_name: place.place_name,
              place_lat: place.lat,
              place_lng: place.lng,
              kakao_id: place.kakao_id,
              address_name: place.address_name,
              road_address_name: place.road_address_name,
              phone: place.phone,
              category_name: place.category_name,
              category_group_code: place.category_group_code,
              category_group_name: place.category_group_name,
              place_url: place.place_url,
            }));

            setPlacePickerOpen(false);
          }}
          onClose={() => setPlacePickerOpen(false)}
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

// ------------------------------------
// 카드 한 장 — 표시 전용. 꾹 누르면 편집 팝업이 열린다
// ------------------------------------
export function PendingCard({
  row,
  cat1List,
  cat2List,
  cat3List,
  payList,
  onOpenEditor,
  onStartReveal,
  onSend,
  readOnly = false,
}: {
  row: any;
  cat1List: { id: number; name: string }[];
  cat2List: { id: number; name: string; cat1_id: number; blur?: number; inout?: number | null }[];
  cat3List: { id: number; name: string; cat2_id: number }[];
  payList: { code: string; name: string }[];
  onOpenEditor: (row: any) => void;
  onStartReveal: (id: number, e: any) => void;
  onSend?: (row: any) => void;
  /* 보기만 하는 화면(기간 상세)에서는 편집도 전송도 하지 않는다.
     기본값은 지금까지와 같으므로 이 화면의 동작은 그대로다. */
  readOnly?: boolean;
}) {
  const openEditor = useCallback(() => onOpenEditor(row), [onOpenEditor, row]);
  const { pressing, handlers } = useLongPress(openEditor);

  const cat1Name = cat1List.find((c) => c.id === row.cat1_id)?.name ?? "—";
  const isBlur = cat2List.find((c) => c.id === row.cat2_id)?.blur === 1;

  const payName =
    payList.find((p) => String(p.code) === String(row.pay_method))?.name ?? "";

  // 쪼갠 건은 실지출(net)을 대표 금액으로 삼는다. 분할이 없으면 net === amount 다.
  const hasSplit = (row.split_count ?? 0) > 0;
  /* 쪼갠 몫을 펼쳤는지. 카드마다 따로 기억한다 */
  const [open, setOpen] = useState(false);
  const shownAmount = hasSplit ? row.net_amount : row.amount;

  return (
    <article
      className={`card card--pressable${readOnly ? " card--flat" : ""} ${pressing && !readOnly ? "pressing" : ""}`}
      {...(readOnly ? {} : handlers)}
      title={readOnly ? undefined : "꾹 눌러서 편집"}
    >
      {/* IN/OUT 색상 바 */}
      <div
        className={`inout-bar ${
          row.inout === 1 ? "in-bar" : row.inout === -1 ? "out-bar" : ""
        }`}
      ></div>

      {/* 1행: 장소 / Send 버튼 ── 날짜는 상단 날짜 단에서 표시한다 */}
      <div className="card-row row-top">
        <div className="card-left">
          <span className="place-text">📍 {row.place_name || "—"}</span>
        </div>
        {!readOnly && (
          <div className="card-right">
            <button className="ui-btn small" onClick={() => onSend?.(row)}>
              전송
            </button>
          </div>
        )}
      </div>

      {/* 2행: 카테고리 */}
      <div className="row-category">
        <span className="cat-display">
          <span className="cat-text">{cat1Name}</span>
          <span className="cat-sep"> &gt; </span>
          <span className="cat-text">
            {cat2List.find((c) => c.id === row.cat2_id)?.name ?? "—"}
          </span>
          {row.cat3_id && (
            <>
              <span className="cat-sep"> &gt; </span>
              <span className="cat3-text">
                {cat3List.find((c) => c.id === row.cat3_id)?.name ?? "—"}
              </span>
            </>
          )}
        </span>
      </div>

      {/* 3행: 결제 수단 + 금액 */}
      <div className="row-payment">
        <span className="pay-method-text">{payName}</span>

        {/* 쪼갠 건은 큰 금액을 실지출로 보여 주고, 원래 결제액은 그 위에 작게 남긴다.
            그 줄을 누르면 아래에 함께한 사람과 몫이 펼쳐진다 */}
        <span className="amount-stack">
          {hasSplit && (
            <span
              className={`amount-split ${isBlur && !row.reveal_amount ? "masked" : "revealed"} is-toggle${open ? " open" : ""}`}
              role="button"
              tabIndex={0}
              data-no-longpress
              title={open ? "몫 접기" : "함께한 사람 보기"}
              onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            >
              {row.amount.toLocaleString("ko-KR")}
              <span className="amount-split__op"> − </span>
              {row.split_amount.toLocaleString("ko-KR")}
              <span className="amount-split__caret" aria-hidden="true">›</span>
            </span>
          )}
          <span
            className={`amount-text ${isBlur && !row.reveal_amount ? "masked" : "revealed"}`}
            data-no-longpress
            onMouseDown={(e) => isBlur && onStartReveal(row.entry_id, e)}
            onTouchStart={(e) => isBlur && onStartReveal(row.entry_id, e)}
          >
            {typeof shownAmount === "number"
              ? shownAmount.toLocaleString("ko-KR")
              : ""}
          </span>
        </span>
      </div>

      {/* 4행: 메모 */}
      {/* 메모가 없으면 줄도 만들지 않는다 — 빈 줄이 카드를 20px 씩 늘렸다 */}
      {row.memo && (
        <div className="card-row row-bottom">
          <div className="card-left">
            <span className="memo-text">{row.memo}</span>
          </div>
        </div>
      )}

      {/* 펼쳤을 때만 — 함께한 사람과 몫 */}
      {hasSplit && open && (
        <SplitRows base="/pending-entries" ownerId={row.entry_id} />
      )}
    </article>
  );
}
