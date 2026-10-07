import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "../api/client";
import useBackClose from "../hooks/useBackClose";

import PlacePicker from "./components/PlacePicker";
import MultiSelect from "./components/MultiSelect";
import SingleSelect from "./components/SingleSelect";
import CardEditModal, { EditField, EditDivider } from "./components/CardEditModal";
import EntryEditFields from "./components/EntryEditFields";
import type { SplitDraft } from "./components/SplitEditor";
import { groupByDate } from "../utils/dateGroup";
import DateGroupHeader from "./components/DateGroupHeader";
import { CollapseAllButtons } from "./components/CollapseToggle";
import Collapse from "./components/Collapse";
import SplitRows from "./components/SplitRows";
import QuickActions from "./components/QuickActions";
import PickBar from "./components/PickBar";
import ReceiptPopup from "./components/ReceiptPopup";
import type { ReceiptRow } from "../utils/receipt";
import MemoPad from "./components/MemoPad";
import ClipMark from "./components/ClipMark";
import GroupMakePopup from "./components/GroupMakePopup";
import PerfExcludeButton from "./components/PerfExcludeButton";
import FixedMark from "./components/FixedMark";
import useLongPress from "../hooks/useLongPress";
import usePeel from "../hooks/usePeel";
import { blurSetsFrom, isBlurred, fixedSetsFrom, isFixed } from "../utils/calendarFilter";
import DayPicker from "./components/DayPicker";
import { say, ask } from "../utils/notify";
/* 실적 제외를 켜고 끌 때 손대는 줄 — 그 일에 쓰는 두 칸만 본다.
   카드가 받는 줄은 통째로 넓은 갈래지만, 여기서는 좁혀 쓴다. */
type PerfRow = { entry_id: number; perf_exclude?: number | null };

/** 고정 · 변동을 뒤집을 때 필요한 것만 */
type FixedRow = { entry_id: number; fixed_flag?: number | null };

const EMPTY_FILTER = {
  dateFrom: "",
  dateTo: "",
  cat1: [] as number[],
  cat2: [] as number[],
  cat3: [] as number[],
  pay: [] as string[],
  memo: "",
  /* 지출을 적을 때 고를 수 있는 것은 모두 걸러 낼 수 있어야 한다. */
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

export default function Entries() {
  const [rows, setRows] = useState<any[]>([]);
  const [yearMonth, setYearMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [cat1List, setCat1List] = useState<{ id: number; name: string; blur?: number; is_active?: number }[]>([]);
  const [cat2List, setCat2List] = useState<{ id: number; name: string; cat1_id: number; blur?: number; inout: number | null; is_active?: number }[]>([]);
  const [cat3List, setCat3List] = useState<{ id: number; name: string; cat2_id: number; blur?: number; is_active?: number }[]>([]);

  const [payList, setPayList] = useState<
    { code: string; name: string; is_active?: number; category?: string }[]
  >([]);

  // 편집 팝업 상태 — 카드를 꾹 누르면 열린다.
  const [draft, setDraft] = useState<any | null>(null);
  const [splits, setSplits] = useState<SplitDraft[]>([]);
  const [placePickerOpen, setPlacePickerOpen] = useState(false);

  const [filterOpen, setFilterOpen] = useState(false);

  /* 뒤로 가기 · Backspace로 지금 열린 것만 닫는다.
     카드 편집 팝업은 CardEditModal이 스스로 처리한다. */
  useBackClose(filterOpen, () => closeFilter());
  useBackClose(placePickerOpen, () => setPlacePickerOpen(false));
  /* 팝업에서 고치는 중인 값(초안)과 실제로 걸려 있는 값을 나눠 둔다.
     하나로 두면 팝업에서 값을 바꾸는 순간 뒤 화면의 버튼과 기간 표시가
     먼저 바뀌어, [적용]을 누르기도 전에 적용된 것처럼 보였다. */
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [appliedFilter, setAppliedFilter] = useState(EMPTY_FILTER);

  /* 함께한 상대 목록 — 필터에서 고르기 위해 받아 둔다. */
  const [cpList, setCpList] = useState<{ counterpart_id: number; name: string }[]>([]);
  const [filterRangeLabel, setFilterRangeLabel] = useState("");

  // 메타데이터 불러오기
  useEffect(() => {
    // 조회가 실패하면 빈 목록으로 둔다. 그냥 두면 처리되지 않은 거절만
    // 남고 화면은 까닭 없이 비어 보인다. 기준 자료라 한 번은 알린다.
    const 메타실패 = () => say.warn("기준 자료를 불러오지 못했습니다. 새로 고쳐 주세요.");
    axios.get("/categories/lvl1").then((r) => setCat1List(r.data)).catch(메타실패);
    axios.get("/categories/lvl2").then((r) => setCat2List(r.data)).catch(메타실패);
    axios.get("/counterparts").then((r) => setCpList(r.data)).catch(메타실패);
    axios.get("/categories/lvl3").then((r) => setCat3List(r.data)).catch(메타실패);
    axios
      .get("/payment-methods")
      .then((r) =>
        setPayList(
          r.data.map((p: any) => ({
            code: p.method_id,
            name: p.method_name,
            is_active: p.is_active,
            /* 카드인 줄에만 실적 제외 기호가 선다. */
            category: p.category,
          }))
        )
      )
      .catch(메타실패);
  }, []);

  // 팝업 열렸을 때 뒤 화면 스크롤/인터랙션 막기
  useEffect(() => {
    if (filterOpen || draft || placePickerOpen) {
      document.documentElement.classList.add("modal-open");
    } else {
      document.documentElement.classList.remove("modal-open");
    }
  }, [filterOpen, draft, placePickerOpen]);

  /* 화면에 들어오면, 그리고 달을 옮길 때마다 바로 불러온다.
     예전에는 [조회]를 눌러야 카드가 나왔다. 필터가 걸려 있으면 그쪽이 우선이다. */
  useEffect(() => {
    if (isFilterActive) return;
    axios
      .get("/entries/month", { params: { ym: yearMonth } })
      .then((r) => setRows(r.data.map((x: any) => ({ ...x, reveal_amount: false }))))
      .catch(() => setRows([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearMonth]);

  /** 앞뒤 달로 옮긴다. 값이 바뀌면 아래 useEffect가 바로 불러온다. */
  const shiftMonth = (step: number) => {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + step, 1);
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  /** "2026-08" → "2026년 8월" */
  const monthLabel = useMemo(() => {
    const [y, m] = yearMonth.split("-").map(Number);
    return `${y}년 ${m}월`;
  }, [yearMonth]);

  // 월별 데이터 조회
  const loadData = async () => {
    const res = await axios.get("/entries/month", { params: { ym: yearMonth } });
    setRows(res.data.map((r: any) => ({ ...r, reveal_amount: false })));
  };

  // 조회 상태 유지하며 새로고침
  const reload = async () => {
    if (isFilterActive) {
      await applyFilter();
    } else {
      await loadData();
    }
  };

  // ------------------------------------
  // 편집 팝업
  // ------------------------------------

  const openEditor = useCallback((row: any) => {
    setDraft({ ...row });
    // 분할은 목록 조회에 합계만 실려 오므로, 편집할 때 상세를 따로 가져온다.
    setSplits([]);
    if (row.split_count > 0) {
      axios
        .get(`/entries/${row.entry_id}/splits`)
        .then((r) =>
          setSplits(
            r.data.map((s: SplitDraft) => ({
              amount: s.amount,
              counterpart_id: s.counterpart_id,
              memo: s.memo,
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
        // 소분류가 바뀌면 하위 세분류는 초기화
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

  // 팝업에서 저장 — 해당 건만 반영한다.
  const saveDraft = async () => {
    if (!draft) return;

    // 필수 입력값 검증
    if (!draft.tx_date || !draft.cat1_id || !draft.cat2_id || draft.amount == null || draft.amount === '' || !draft.pay_method) {
      say.warn("날짜, IN/OUT, 분류, 금액, 결제 수단은 꼭 넣어 주세요.");
      return;
    }

    // 분할 검증 — 빈 줄은 버리고, 합계가 결제 금액을 넘으면 막는다.
    const cleanSplits = splits.filter(
      (s) => s.amount !== "" && Number(s.amount) > 0
    );
    if (cleanSplits.length !== splits.length && splits.some((s) => s.amount === "" || Number(s.amount) <= 0)) {
      say.warn("쪼갠 금액은 0보다 커야 합니다.");
      return;
    }
    const splitSum = cleanSplits.reduce((s, r) => s + Number(r.amount), 0);
    if (splitSum > Number(draft.amount)) {
      say.warn("쪼갠 합계가 결제 금액을 넘었습니다.");
      return;
    }

    // 정제(clean) payload 생성 — API는 배열을 받으므로 1건짜리 배열로 보낸다.
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

      // 장소 세트
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
      await axios.put("/entries/bulk", clean);
      // 분할은 별도 엔드포인트다. 비어 있어도 보내야 기존 분할이 지워진다.
      await axios.put(`/entries/${draft.entry_id}/splits`, cleanSplits);
      closeEditor();
      say.ok("저장 완료-!! ;-)");
      await reload();
    } catch (err) {
      console.error(err);
      say.bad("저장하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  // 제거 함수
  const deleteEntry = async (id: number) => {
    if (
      !(await ask({
        title: "내역 제거",
        body: "이 내역을 제거할까요?",
        warn: "되돌릴 수 없습니다.",
        go: "제거",
        danger: true,
      }))
    )
      return;
    try {
      await axios.delete(`/entries/${id}`);
      setRows(prev => prev.filter(r => r.entry_id !== id));
      closeEditor();
      say.ok("제거 완료-!! ;-)");
    } catch (err) {
      console.error(err);
      say.bad("제거하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  /* 카드 실적에서 뺄지 — 기호를 누르는 즉시 담는다.
     목록을 다시 읽지 않고 그 줄만 갈아 끼운다. 한 칸만 바뀌는 일에
     한 달치를 다시 받아 오면 훑던 자리가 흔들린다. 담기지 않으면
     되돌려 손이 헛놀지 않게 한다. */
  const togglePerfExclude = async (row: PerfRow, next: boolean) => {
    /* 고정 · 변동 기호와 나란히 선 작은 기호라 손가락이 스치기 쉽다.
       그쪽과 같이 한 번 묻는다. */
    if (
      !(await ask({
        title: next ? "실적에서 제외" : "실적에 포함",
        body: next ? "실적에서 제외할까요?" : "실적에 포함할까요?",
        go: next ? "제외" : "포함",
      }))
    )
      return;
    const id = row.entry_id;
    const before = row.perf_exclude ?? 0;
    const after = next ? 1 : 0;
    const stamp = (v: number) =>
      setRows((prev) => prev.map((r) => (r.entry_id === id ? { ...r, perf_exclude: v } : r)));
    stamp(after);
    try {
      await axios.put(`/entries/${id}/perf-exclude`, null, { params: { value: after } });
    } catch (err) {
      console.error(err);
      stamp(before);
      say.bad("실적 제외를 담지 못했습니다.");
    }
  };

  /* 고정인지 변동인지 — 카드 실적 제외와 같은 방식이다. 기호를 누르는 즉시
     담고, 그 줄만 갈아 끼운다. 담기지 않으면 되돌린다.

     여기서 누르면 그 건에 손으로 정한 것이 되어, 뒤에 분류 설정을 바꿔도
     이 건은 그대로다. */
  const toggleFixed = async (row: FixedRow, next: boolean) => {
    /* 기호가 작고 결제 수단 바로 옆이라 손가락이 스치기 쉽다. 잘못 눌러도
       곧바로 바뀌면 바뀐 줄도 모르고 지나간다. 지우기 · 확정과 같이 한 번 묻는다. */
    if (
      !(await ask({
        title: "고정/변동 바꾸기",
        body: `${next ? "변동 → 고정" : "고정 → 변동"} 내역으로 바꿀까요?`,
        go: "변경",
      }))
    )
      return;
    const id = row.entry_id;
    const before = row.fixed_flag ?? null;
    const after = next ? 1 : 0;
    const stamp = (v: number | null) =>
      setRows((prev) => prev.map((r) => (r.entry_id === id ? { ...r, fixed_flag: v } : r)));
    stamp(after);
    try {
      await axios.put(`/entries/${id}/fixed`, null, { params: { value: String(after) } });
    } catch (err) {
      console.error(err);
      stamp(before);
      say.bad("고정/변동을 담지 못했습니다.");
    }
  };

  // 드래그 제스처 핸들러(금액 마스킹 해제)
  const handleRevealDrag = (id: number, startX: number) => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      const currentX = ('touches' in e)
        ? e.touches[0].clientX
        : e.clientX;

      /* 12px만 끌어도 열리게 한다. 30px는 뻑뻑했다. */
      if (Math.abs(currentX - startX) > 12) {
        // 드래그 중 → 금액 표시
        setRows(prev =>
          prev.map(r =>
            r.entry_id === id ? { ...r, reveal_amount: true } : r
          )
        );
      }
    };

    const onEnd = () => {
      // 손/마우스 떼면 → 다시 숨김
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

  /* [적용]을 누르지 않고 닫으면 고치던 값은 버린다.
     다시 열었을 때 지금 걸려 있는 조건이 그대로 보여야 한다. */
  const closeFilter = () => {
    setFilter(appliedFilter);
    setFilterOpen(false);
  };

  const applyFilter = async () => {
    /* 조건을 모두 비운 채로 적용했다면 필터를 끄겠다는 뜻이다.
       그대로 서버에 물으면 조건 없는 조회가 되어 전 기간이 쏟아진다.
       보고 있던 달로 돌아간다. */
    /* 초안을 그대로 확정한다 — 여기부터 화면에 반영된다. */
    setAppliedFilter(filter);

    if (!hasCondition(filter)) {
      setFilterRangeLabel("");
      setFilterOpen(false);
      const back = await axios.get("/entries/month", { params: { ym: yearMonth } });
      setRows(back.data.map((r: any) => ({ ...r, reveal_amount: false })));
      return;
    }

    const res = await axios.get("/entries/filter", {
      params: {
        date_from: filter.dateFrom || null,
        date_to: filter.dateTo || null,
        cat1: filter.cat1.length ? JSON.stringify(filter.cat1) : null,
        cat2: filter.cat2.length ? JSON.stringify(filter.cat2) : null,
        cat3: filter.cat3.length ? JSON.stringify(filter.cat3) : null,
        pay: filter.pay.length ? JSON.stringify(filter.pay) : null,
        memo: filter.memo || null,
        inout: filter.inout || null,
        amount_min: filter.amountMin === "" ? null : Number(filter.amountMin),
        amount_max: filter.amountMax === "" ? null : Number(filter.amountMax),
        place: filter.place || null,
        counterpart: filter.cp.length ? JSON.stringify(filter.cp) : null,
      }
    });

    setRows(res.data.map((r: any)=>({...r, reveal_amount:false})));
    setFilterOpen(false);

    // 필터 적용 시 날짜 레이블 생성
    if (filter.dateFrom && filter.dateTo) {
      setFilterRangeLabel(
        `${new Date(filter.dateFrom).toLocaleDateString("ko-KR")} ~ ${new Date(filter.dateTo).toLocaleDateString("ko-KR")}`
      );
    } else if (filter.dateFrom) {
      setFilterRangeLabel(`${new Date(filter.dateFrom).toLocaleDateString("ko-KR")} ~ `);
    } else if (filter.dateTo) {
      setFilterRangeLabel(` ~ ${new Date(filter.dateTo).toLocaleDateString("ko-KR")}`);
    } else {
      setFilterRangeLabel("");
    }
  };

  // ------------------------------------
  // MultiSelect 안정화용 useMemo / useCallback 추가
  // ------------------------------------

  const cat1Options = useMemo(
    () => [
      { value: -1, label: "[전체]" },
      ...cat1List.map(c => ({ value: c.id, label: c.name }))
    ],
    [cat1List]
  );

  const cat1_onSpecialClick = useCallback(
    (v: number) => {
      if (v !== -1) return false;

      const all = cat1List.map(c => c.id);

      setFilter(prev => ({
        ...prev,
        cat1: prev.cat1.length === all.length ? [] : all,
        cat2: [],
        cat3: [],
      }));

      return true;
    },
    [cat1List]
  );

  const cat1_onChange = useCallback(
    (list: number[]) => {
      setFilter(prev => ({
        ...prev,
        cat1: list.filter(v => v > 0),
        cat2: [],
        cat3: [],
      }));
    },
    []
  );

  const cat1_isChecked = useCallback(
    (v: number) => {
      if (v === -1) return filter.cat1.length === cat1List.length;
      return filter.cat1.includes(v);
    },
    [filter.cat1, cat1List]
  );

  // ------------------------------------
  // CategoryS
  // ------------------------------------

  const cat2Options = useMemo(() => {
    // 전체 선택 상단 배치
    const result: any[] = [];
    if (filter.cat1.length)
      result.push({ value: -1, label: "[전체]" });

    // 중분류마다 자체 전체 + 해당 소분류들 그룹으로 구성
    filter.cat1.forEach(cid => {
      const parent = cat1List.find(c => c.id === cid);
      if (!parent) return;

      // ex. (식비 전체)
      result.push({ value: -(1000 + cid), label: `(${parent.name} 전체)` });

      // ex. 식비의 실제 소분류
      cat2List
        .filter(c => c.cat1_id === cid)
        .forEach(c => {
          result.push({ value: c.id, label: c.name });
        });
    });

    return result;
  }, [filter.cat1, cat1List, cat2List]);

  const cat2_onSpecialClick = useCallback(
    (v: number) => {
      if (v === -1) {
        const all = cat2List
          .filter(c => filter.cat1.includes(c.cat1_id))
          .map(c => c.id);

        setFilter(prev => ({
          ...prev,
          cat2: prev.cat2.length === all.length ? [] : all,
        }));
        return true;
      }

      if (v <= -1000) {
        const cid = -(v + 1000);
        const ids = cat2List.filter(c => c.cat1_id === cid).map(c => c.id);
        const allSelected = ids.every(id => filter.cat2.includes(id));

        setFilter(prev => ({
          ...prev,
          cat2: allSelected
            ? prev.cat2.filter(id => !ids.includes(id))
            : Array.from(new Set([...prev.cat2, ...ids])),
        }));

        return true;
      }

      return false;
    },
    [filter.cat1, filter.cat2, cat2List]
  );

  const cat2_onChange = useCallback(
    (list: number[]) => {
      setFilter(prev => ({
        ...prev,
        cat2: list.filter(v => v > 0)
      }));
    },
    []
  );

  const cat2_isChecked = useCallback(
    (v: number) => {
      if (v === -1) {
        const all = cat2List
          .filter(c => filter.cat1.includes(c.cat1_id))
          .map(c => c.id);
        return filter.cat2.length === all.length;
      }

      if (v <= -1000) {
        const cid = -(v + 1000);
        const children = cat2List.filter(c => c.cat1_id === cid).map(c => c.id);
        return children.every(id => filter.cat2.includes(id));
      }

      return filter.cat2.includes(v);
    },
    [filter.cat1, filter.cat2, cat2List]
  );

  // ------------------------------------
  // CategoryD
  // ------------------------------------

  const cat3Options = useMemo(() => {
    const result: any[] = [];

    // 최상단의(세분류 전체)
    if (filter.cat2.length)
      result.push({ value: -1, label: "[전체]" });

    // 소분류(cat2)별로 그룹 구성
    filter.cat2.forEach(cid => {
      const parent = cat2List.find(c => c.id === cid);
      if (!parent) return;

      // ex. (식비-소분류 전체)
      result.push({ value: -(2000 + cid), label: `(${parent.name} 전체)` });

      // ex. 실제 세분류 목록
      cat3List
        .filter(c => c.cat2_id === cid)
        .forEach(c => {
          result.push({ value: c.id, label: c.name });
        });
    });

    return result;
  }, [filter.cat2, cat2List, cat3List]);

  const cat3_onSpecialClick = useCallback(
    (v: number) => {
      if (v === -1) {
        const all = cat3List
          .filter(c => filter.cat2.includes(c.cat2_id))
          .map(c => c.id);

        setFilter(prev => ({
          ...prev,
          cat3: prev.cat3.length === all.length ? [] : all,
        }));
        return true;
      }

      if (v <= -2000) {
        const cid = -(v + 2000);
        const ids = cat3List.filter(c => c.cat2_id === cid).map(c => c.id);
        const allSelected = ids.every(id => filter.cat3.includes(id));

        setFilter(prev => ({
          ...prev,
          cat3: allSelected
            ? prev.cat3.filter(id => !ids.includes(id))
            : Array.from(new Set([...prev.cat3, ...ids])),
        }));

        return true;
      }

      return false;
    },
    [filter.cat2, filter.cat3, cat3List]
  );

  const cat3_onChange = useCallback(
    (list: number[]) => {
      setFilter(prev => ({
        ...prev,
        cat3: list.filter(v => v > 0)
      }));
    },
    []
  );

  const cat3_isChecked = useCallback(
    (v: number) => {
      if (v === -1) {
        const all = cat3List
          .filter(c => filter.cat2.includes(c.cat2_id))
          .map(c => c.id);
        return filter.cat3.length === all.length;
      }

      if (v <= -2000) {
        const cid = -(v + 2000);
        const children = cat3List.filter(c => c.cat2_id === cid).map(c => c.id);
        return children.every(id => filter.cat3.includes(id));
      }

      return filter.cat3.includes(v);
    },
    [filter.cat2, filter.cat3, cat3List]
  );

  // ------------------------------------
  // PaymentMethod 안정화
  // ------------------------------------

  const payOptions = useMemo(
    () => [
      { value: "__ALL__", label: "(전체 결제 수단)" },
      ...payList.map(p => ({ value: p.code, label: p.name }))
    ],
    [payList]
  );

  const pay_onSpecialClick = useCallback(
    (v: string) => {
      if (v !== "__ALL__") return false;

      const all = payList.map(p => p.code);

      setFilter(prev => ({
        ...prev,
        pay: prev.pay.length === all.length ? [] : all,
      }));

      return true;
    },
    [payList]
  );

  const pay_onChange = useCallback(
    (list: string[]) => {
      setFilter(prev => ({
        ...prev,
        pay: list
      }));
    },
    []
  );

  const pay_isChecked = useCallback(
    (v: string) => {
      if (v === "__ALL__") return filter.pay.length === payList.length;
      return filter.pay.includes(v);
    },
    [filter.pay, payList]
  );

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

  // 날짜별 단 — 서버 정렬(tx_date DESC)을 그대로 보존한다.
  // 소분류에 blur가 걸린 항목이 섞이면 합계도 가려야 하므로 판정 함수를 넘긴다.
  /* 접어 둔 날짜. 비어 있으면 전부 펼쳐진 상태다(지금까지와 같은 모습) */
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const toggleDay = (d: string) =>
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });

  /* Blur는 중 · 소 · 세 어디에 걸려도 함께 덮인다. */
  const blurSets = useMemo(
    () => blurSetsFrom(cat1List, cat2List, cat3List),
    [cat1List, cat2List, cat3List]
  );

  /* 고정 · 변동은 소 · 세에만 둔다. 건에 손으로 정해 둔 것이 있으면 그것이 먼저다. */
  const fixSets = useMemo(() => fixedSetsFrom(cat2List, cat3List), [cat2List, cat3List]);

  const dateGroups = useMemo(
    /* 날짜 단 합계는 집계라 테이프를 붙이지 않는다. 덮는 것은 카드뿐이다. */
    () => groupByDate(rows),
    [rows]
  );

  /* ── 영수증으로 뽑을 것 고르기 ──────────────────────────────
     고른 것은 지금 화면에 보이는 줄에서만 센다. 달을 옮기거나 걸러서
     사라진 건이 고른 채 남아 있으면, 눈에 없는 것이 영수증에 찍힌다. */
  const [pickedIds, setPickedIds] = useState<Set<number>>(new Set());
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [makeOpen, setMakeOpen] = useState(false);

  const togglePick = useCallback((id: number) => {
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* 달을 옮기면 푼다. 다른 달의 건이 섞인 영수증은 기간이 말이 안 된다. */
  useEffect(() => {
    setPickedIds(new Set());
  }, [yearMonth]);

  const picked = useMemo(
    () => rows.filter((r) => pickedIds.has(r.entry_id)),
    [rows, pickedIds]
  );

  /* 영수증 한 줄로 옮긴다. 보이는 그대로를 담는다 — 쪼갠 건은 실지출이다. */
  const receiptRows = useMemo<ReceiptRow[]>(() => {
    const name1 = new Map(cat1List.map((c) => [c.id, c.name]));
    const name2 = new Map(cat2List.map((c) => [c.id, c.name]));
    const name3 = new Map(cat3List.map((c) => [c.id, c.name]));
    const payName = new Map(payList.map((p) => [String(p.code), p.name]));
    return picked.map((r) => ({
      key: `entry-${r.entry_id}`,
      src: "지출" as const,
      date: String(r.tx_date ?? "").slice(0, 10),
      cat: [name1.get(Number(r.cat1_id)), name2.get(Number(r.cat2_id)), name3.get(Number(r.cat3_id))]
        .filter(Boolean)
        .join(" › "),
      amount: Number((r.split_count ?? 0) > 0 ? r.net_amount : r.amount) || 0,
      inout: (r.inout as number) ?? null,
      place: String(r.place_name ?? "").trim(),
      pay: payName.get(String(r.pay_method ?? "")) ?? "",
    }));
  }, [picked, cat1List, cat2List, cat3List, payList]);

  /* 버튼과 기간 표시는 '적용된 값'만 본다. 초안은 팝업 안에서만 산다. */
  const isFilterActive = useMemo(() => hasCondition(appliedFilter), [appliedFilter]);

  return (
    <div className="page-wrap">

      {/* 월 넘기기 — 화살표로 앞뒤 달을 오간다. 고르면 바로 불러오므로 조회 버튼이 없다. */}
      <div className="toolbar-wrap">
        <div className="toolbar">
          {/* 필터가 걸리면 달 단위가 아니므로 월 넘기기를 감춘다.
              날짜 범위를 정하지 않았으면 기간이 전체라는 뜻이다. */}
          {isFilterActive ? (
            <div className="filter-range-label">{filterRangeLabel || "전체 기간"}</div>
          ) : (
            <div className="month-nav">
              <button
                type="button"
                className="month-nav__arrow"
                aria-label="지난달"
                onClick={() => shiftMonth(-1)}
              >
                ‹
              </button>
              <span className="month-nav__label">{monthLabel}</span>
              <button
                type="button"
                className="month-nav__arrow"
                aria-label="다음 달"
                onClick={() => shiftMonth(1)}
              >
                ›
              </button>
            </div>
          )}

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
            <Collapse open={!collapsedDays.has(group.date)}>
              {
                group.items.map((row: any) => (
                <EntryCard
                  key={row.entry_id}
                  row={row}
                  cat1List={cat1List}
                  cat2List={cat2List}
                  payList={payList}
                  onOpenEditor={openEditor}
                  onStartReveal={startReveal}
                  picked={pickedIds.has(row.entry_id)}
                  onTogglePick={togglePick}
                  blurred={isBlurred(row, blurSets)}
                  fixed={isFixed(row, fixSets)}
                  onTogglePerfExclude={togglePerfExclude}
                  onToggleFixed={toggleFixed}
                />
              ))}
            </Collapse>
          </section>
        ))}
      </div>

      <PickBar
        count={picked.length}
        all={rows.length}
        onAll={() => setPickedIds(new Set(rows.map((r) => r.entry_id)))}
        onClear={() => setPickedIds(new Set())}
        onReceipt={() => setReceiptOpen(true)}
        more={
          <button
            type="button"
            className="pick-bar__more"
            onClick={() => setMakeOpen(true)}
          >
            묶기
          </button>
        }
      />

      {receiptOpen && (
        <ReceiptPopup rows={receiptRows} onClose={() => setReceiptOpen(false)} />
      )}

      {makeOpen && (
        <GroupMakePopup
          kind="entry"
          items={picked}
          meta={{ cat1List, cat2List, payList }}
          onDone={() => {
            setMakeOpen(false);
            setPickedIds(new Set());
            loadData();
          }}
          onClose={() => setMakeOpen(false)}
        />
      )}

      {/* 편집 팝업 */}
      {draft && (
        <CardEditModal
          title="내역 편집"
          onClose={closeEditor}
          onSave={saveDraft}
          onDelete={() => deleteEntry(draft.entry_id)}
          headerFields={
            <EditField label="날짜" span={12} required>
              <DayPicker
                value={draft.tx_date ? draft.tx_date.substring(0, 10) : ""}
                onChange={(v) => setField("tx_date", v)}
              />
            </EditField>
          }
        >
          <EntryEditFields
            draft={draft}
            setField={setField}
            cat1List={cat1List}
            cat2List={cat2List}
            cat3List={cat3List}
            payList={payList}
            splits={splits}
            setSplits={setSplits}
            onPickPlace={() => setPlacePickerOpen(true)}
          />
        </CardEditModal>
      )}

      {/* 팝업은 map() 밖에서 렌더링 */}
      {filterOpen && (
        <div className="popup-overlay" onClick={closeFilter}>
          <div
            className="popup-panel popup-panel--framed"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="필터"
          >

            {/* 머리·본문·바닥을 편집 팝업과 같은 짜임으로 */}
            <header className="popup-head">
              <h3 className="popup-head__title">필터</h3>
            </header>

            {/* 편집 팝업과 같은 12칸 격자. 성격이 다른 묶음 사이는 구분선으로 가른다. */}
            <div className="popup-body edit-grid">
              {/* 거르는 자리는 지난 어느 때로도 갈 수 있어야 한다 —
                  머리의 연월을 누르면 한 해가 펼쳐진다. */}
              <EditField label="시작일" span={6}>
                <DayPicker
                  monthJump
                  clearable
                  value={filter.dateFrom}
                  onChange={(v) => setFilter({ ...filter, dateFrom: v })}
                />
              </EditField>

              <EditField label="종료일" span={6}>
                <DayPicker
                  monthJump
                  clearable
                  value={filter.dateTo}
                  onChange={(v) => setFilter({ ...filter, dateTo: v })}
                />
              </EditField>

              <EditDivider />

              <EditField label="중분류" span={4}>
                <MultiSelect
                  noun="중분류"
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
                  noun="소분류"
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
                  noun="세분류"
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
                  noun="결제 수단"
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
                  noun="사람"
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

            <div className="btn-row popup-foot popup-foot--tight">
              <button className="ui-btn" onClick={() =>
                setFilter({
                  dateFrom: "",
                  dateTo: "",
                  cat1: [] as number[],
                  cat2: [] as number[],
                  cat3: [] as number[],
                  pay: [] as string[],
                  memo: "",
                  inout: 0,
                  amountMin: "",
                  amountMax: "",
                  place: "",
                  cp: [] as number[],
                })
              }>초기화</button>
              {/* 편집 팝업과 같은 차례로 — 되돌리는 것 · 닫기 · 하려던 것 */}
              <button className="ui-btn" onClick={closeFilter}>닫기</button>
              <button className="ui-btn primary" onClick={applyFilter}>적용</button>
            </div>

          </div>
        </div>
      )}

      {placePickerOpen && draft && (
        <PlacePicker
          onSelect={async (place) => {
            //
            // ① DB에 이미 저장된 장소(place_id 존재)
            //
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

            //
            // ② kakao_id는 있지만 place_id는 없음 → DB에 존재하는지 검사
            //
            if (place.kakao_id) {
              const res = await axios.get("/places/exists-by-kakao", {
                params: { kakao_id: place.kakao_id }
              });

              if (res.data?.place_id) {
                // DB에 이미 있는 장소 → DB 장소로 연결
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

            //
            // ③ 완전 신규 kakao 장소 → 모든 필드 저장
            //
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
      <QuickActions onSaved={reload} />
    </div>
  );
}

// ------------------------------------
// 카드 한 장 — 표시 전용. 꾹 누르면 편집 팝업이 열린다.
// ------------------------------------
export function EntryCard({
  row,
  cat1List,
  cat2List,
  payList,
  onOpenEditor,
  onStartReveal,
  picked = false,
  onTogglePick,
  blurred,
  readOnly = false,
  onTogglePerfExclude,
  fixed,
  onToggleFixed,
  clipped,
  onTap,
}: {
  row: any;
  cat1List: { id: number; name: string }[];
  cat2List: { id: number; name: string; cat1_id: number; blur?: number; inout: number | null }[];
  payList: { code: string; name: string; category?: string }[];
  onOpenEditor: (row: any) => void;
  onStartReveal: (id: number, e: any) => void;
  /* 골라 둔 건인지. 넘기지 않으면 고르기 상자가 서지 않는다 — 기간 상세처럼
     보기만 하는 화면은 지금까지와 같은 꼴을 지킨다. */
  picked?: boolean;
  onTogglePick?: (id: number) => void;
  /* 중 · 소 · 세 어디에 Blur가 걸렸는지는 화면이 셈해서 넘긴다.
     넘기지 않으면 예전처럼 소분류만 본다. */
  blurred?: boolean;
  /* 보기만 하는 화면(기간 상세)에서는 꾹 눌러 편집하지 않는다.
     기본값은 지금까지와 같으므로 이 화면의 동작은 그대로다. */
  readOnly?: boolean;
  /* 카드 실적에서 뺄지를 켜고 끈다. 넘기지 않으면 기호가 보기 전용이 된다. */
  onTogglePerfExclude?: (row: PerfRow, next: boolean) => void;
  /* 이 건이 고정인지 — 건에 정해 둔 것이 없으면 분류를 따라 화면이 셈해서 넘긴다. */
  fixed?: boolean;
  /* 고정 · 변동을 뒤집는다. 넘기지 않으면 기호가 보기 전용이 된다. */
  onToggleFixed?: (row: FixedRow, next: boolean) => void;
  /* 묶인 건으로 그릴지. 넘기지 않으면 건에 적힌 묶음과 돈쓴이의
     `내역에 묶음 보이기`를 함께 본다. 묶음 내역은 늘 켜서 넘긴다. */
  clipped?: boolean;
  /* 그냥 눌렀을 때. 넘기지 않으면 아무 일도 없다 — 지금까지와 같다.
     묶음 내역이 쓴다. 거기서는 펼친 묶음을 카드로도 접을 수 있어야 한다. */
  onTap?: () => void;
}) {
  const openEditor = useCallback(() => onOpenEditor(row), [onOpenEditor, row]);
  const { pressing, handlers } = useLongPress(openEditor);
  const peel = usePeel(openEditor);

  /* 묶인 건은 왼쪽 위 책갈피가 클립이 된다(index.css 166절).
     켜고 끄는 설정을 두었다가 걷었다 — 묶어 놓고 묶인 줄 알리지 않을 까닭이
     없고, 끄면 묶음을 풀 자리도 함께 멀어졌다. */
  const isClipped = clipped ?? row.group_id != null;

  const cat1Name = cat1List.find((c) => c.id === row.cat1_id)?.name ?? "—";
  const isBlur = blurred ?? (cat2List.find(c => c.id === row.cat2_id)?.blur === 1);
  const pay = payList.find((p) => p.code === row.pay_method);

  // 쪼갠 건은 실지출(net)을 대표 금액으로 삼는다. 분할이 없으면 net === amount다.
  const hasSplit = (row.split_count ?? 0) > 0;
  /* 쪼갠 몫을 펼쳤는지. 카드마다 따로 기억한다. */
  const [open, setOpen] = useState(false);
  const shownAmount = hasSplit ? row.net_amount : row.amount;

  return (
    <article
      className={`card card--entry card--pressable${readOnly ? " card--flat" : ""}${isClipped ? " is-clipped" : ""} ${pressing && !readOnly ? "pressing" : ""}`}
      {...(readOnly ? {} : handlers)}
      onClick={onTap}
      title={readOnly ? undefined : "꾹 눌러서 편집"}
    >
      {/* IN/OUT 표시 — 종이 왼쪽 위 귀퉁이를 접은 자국.
          묶인 건에서는 그 자리가 클립이 된다. 요소는 그대로 두어야 금액
          빛깔 규칙(.card:has(.in-bar))이 살아 있다. */}
      <div
        className={`inout-bar ${
          row.inout === 1 ? "in-bar" : row.inout === -1 ? "out-bar" : ""
        }`}
        title={isClipped && row.group_name ? `묶음 ${row.group_name}` : undefined}
      >
        {isClipped && <ClipMark />}
      </div>
      {/* 접은 자국을 잡는 자리와, 끌 때 비는 자리 · 접혀 넘어오는 조각.
          보기만 하는 화면(기간 상세)에서도 뗄 수 있다 — 거기서는 끝까지 떼어도
          열 팝업이 없으니 제자리로 펴져 붙기만 한다. */}
      <span className="peel-patch" aria-hidden="true" />
      <span className="peel-flap" aria-hidden="true">
        <span className="peel-flap__face" />
      </span>
      <span className="peel-grip" data-no-longpress aria-hidden="true" {...peel} />
      {/* 뜯는 동안만 뜨는 한 줄. 늘 그려 두고 보이고 숨기는 일은 CSS가 맡는다 —
          끄는 중에 React가 다시 그리면 뜯는 겹이 쥐고 있던 class가 지워진다. */}
      {!readOnly && (
        <span className="peel-tip" aria-hidden="true">
          뜯으면 편집 팝업이 뜹니다.
        </span>
      )}

      {/* ───── 1행: 분류 + 금액 ───── 날짜는 상단 날짜 단에서 표시한다. */}
      <div className="entry-ln entry-ln--head">
        <span className="cat-display">
          <span className="cat-text">{cat1Name}</span>
          <span className="cat-sep"> &gt; </span>

          <span className="cat-text">
            {cat2List.find((c) => c.id === row.cat2_id)?.name ?? "—"}
          </span>

          {row.cat3_name && (
            <>
              <span className="cat-sep"> &gt; </span>
              <span className="cat3-text">{row.cat3_name}</span>
            </>
          )}
        </span>

        <span
          className={`amount-text ${shownAmount === 0 ? "zero " : ""}${
            isBlur && !row.reveal_amount ? "masked" : "revealed"
          }`}
          data-no-longpress
          onMouseDown={(e) => isBlur && onStartReveal(row.entry_id, e)}
          onTouchStart={(e) => isBlur && onStartReveal(row.entry_id, e)}
        >
          {typeof shownAmount === "number"
            ? shownAmount.toLocaleString("ko-KR")
            : ""}
        </span>
      </div>

      {/* ───── 2행: 장소 + 결제 수단 ───── */}
      {/* 메모를 카드 밖 제 판(MemoPad)으로 옮기면서 결제 수단이 혼자 한 줄을
          차지했다. 장소와 같은 줄로 올려 정기와 같은 두 칸 짜임이 된다 —
          장소는 왼쪽 끝, 결제 수단은 오른쪽 끝. 둘 다 없으면 줄도 만들지 않는다. */}
      <div className="entry-ln">
          {/* 고르기 상자. 대기 내역과 같은 자리다 — 장소와 결제 수단이 선 줄의
              왼쪽 끝. 분류 줄에 넣으면 분류 글이 통째로 밀려 쪽마다 자리가
              달라진다. 카드를 꾹 누르면 편집 팝업이 열리므로 빼 둔다. */}
          {onTogglePick && (
            <button
              type="button"
              className={`pe-pick${picked ? " pe-pick--on" : ""}`}
              data-no-longpress
              aria-pressed={picked}
              title={picked ? "선택 해제" : "선택"}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePick(row.entry_id);
              }}
            >
              ✓
            </button>
          )}
          {row.place_name && <span className="place-text">📍 {row.place_name}</span>}
          {/* 달마다 같은 자리에 오는 돈인지. 건마다 뒤집을 수 있다. */}
          <FixedMark
            on={fixed ?? false}
            readOnly={readOnly || !onToggleFixed}
            onToggle={(next) => onToggleFixed?.(row, next)}
          />
          {/* 카드로 그은 건에만 실적 제외 기호가 선다. 현금 · 계좌이체에는
              실적이라는 것이 없다. */}
          {pay?.category === "카드" && (
            <PerfExcludeButton
              on={!!row.perf_exclude}
              readOnly={readOnly || !onTogglePerfExclude}
              onToggle={(next) => onTogglePerfExclude?.(row, next)}
            />
          )}
        <span className="pay-method-text">{pay?.name ?? ""}</span>
      </div>

      <MemoPad memo={row.memo} />

      {/* 쪼갠 건 — 카드 바닥에 붙는 칸. 누르면 그 아래로 함께한 사람과 몫이 펼쳐진다.
          카드 안 금액 옆에 끼워 두었더니 자리가 붕 떠 보였다. */}
      {hasSplit && (
        <div className={`split-tab${open ? " open" : ""}`}>
          <span
            className={`amount-split ${isBlur && !row.reveal_amount ? "masked" : "revealed"} is-toggle${open ? " open" : ""}`}
            role="button"
            tabIndex={0}
            data-no-longpress
            title={open ? "몫 접기" : "함께한 사람 보기"}
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          >
            {/* 뺄셈 한 덩어리 — "모두 펼치기|접기"와 같은 음영을 깔고 손잡이만 밖에 둔다. */}
            <span className="amount-split__calc">
              {row.amount.toLocaleString("ko-KR")}
              <span className="amount-split__op"> − </span>
              {row.split_amount.toLocaleString("ko-KR")}
            </span>
            <span className="amount-split__caret" aria-hidden="true">›</span>
          </span>
          <Collapse open={open}>
            <SplitRows base="/entries" ownerId={row.entry_id} />
          </Collapse>
        </div>
      )}
    </article>
  );
}
