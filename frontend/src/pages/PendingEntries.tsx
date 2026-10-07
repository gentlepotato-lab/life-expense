import { visible } from "../utils/visible";
import { useEffect, useState, useMemo, useCallback } from "react";
import api from "../api/client";
import useBackClose from "../hooks/useBackClose";
import PlacePicker from "./components/PlacePicker";
import MultiSelect from "./components/MultiSelect";
import SingleSelect from "./components/SingleSelect";
import CardEditModal, { EditField, EditDivider } from "./components/CardEditModal";
import SplitEditor from "./components/SplitEditor";
import type { SplitDraft } from "./components/SplitEditor";
import { groupByDate } from "../utils/dateGroup";
import DateGroupHeader from "./components/DateGroupHeader";
import { CollapseAllButtons } from "./components/CollapseToggle";
import Collapse from "./components/Collapse";
import QuickActions from "./components/QuickActions";
import PickBar from "./components/PickBar";
import ReceiptPopup from "./components/ReceiptPopup";
import ClipMark from "./components/ClipMark";
import GroupMakePopup from "./components/GroupMakePopup";
import type { ReceiptRow } from "../utils/receipt";
import MemoPad from "./components/MemoPad";
import PerfExcludeButton from "./components/PerfExcludeButton";
import FixedMark from "./components/FixedMark";
import GrowArea from "./components/GrowArea";
import SplitRows from "./components/SplitRows";
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

export default function PendingEntries() {
  const [rows, setRows] = useState<any[]>([]);
  const [allRows, setAllRows] = useState<any[]>([]); // 필터용 원본

  /* 선택한 항목. 화면에 지금 보이는 것만 센다 — 걸러서 사라진 건이 선택된 채로
     남아 있으면, 눈에 없는 것이 함께 날아간다. 아래 picked에서 추려 쓴다. */
  const [pickedIds, setPickedIds] = useState<Set<number>>(new Set());
  const [makeOpen, setMakeOpen] = useState(false);

  const togglePick = useCallback((id: number) => {
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const picked = useMemo(
    () => rows.filter((r) => pickedIds.has(r.entry_id)),
    [rows, pickedIds]
  );


  const [cat1List, setCat1List] = useState<{ id: number; name: string; blur?: number; is_active?: number }[]>([]);
  const [cat2List, setCat2List] = useState<{ id: number; name: string; cat1_id: number; blur?: number; inout?: number | null; is_active?: number }[]>([]);
  const [cat3List, setCat3List] = useState<{ id: number; name: string; cat2_id: number; blur?: number; is_active?: number }[]>([]);
  const [payList, setPayList] = useState<
    { code: string; name: string; is_active?: number; category?: string }[]
  >([]);

  const [receiptOpen, setReceiptOpen] = useState(false);

  const receiptRows = useMemo<ReceiptRow[]>(() => {
    const name1 = new Map(cat1List.map((c) => [c.id, c.name]));
    const name2 = new Map(cat2List.map((c) => [c.id, c.name]));
    const name3 = new Map(cat3List.map((c) => [c.id, c.name]));
    const payName = new Map(payList.map((p) => [String(p.code), p.name]));
    return picked.map((r) => ({
      key: `pending-${r.entry_id}`,
      src: "대기" as const,
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

  const [filterOpen, setFilterOpen] = useState(false);

  /* 팝업에서 고치는 중인 값(초안)과 실제로 걸려 있는 값을 나눠 둔다.
     하나로 두면 팝업에서 값을 바꾸는 순간 뒤 화면의 버튼과 기간 표시가
     먼저 바뀌어, [적용]을 누르기도 전에 적용된 것처럼 보였다. */
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [appliedFilter, setAppliedFilter] = useState(EMPTY_FILTER);

  /* 함께한 상대 목록 — 필터에서 고르기 위해 받아 둔다. */
  const [cpList, setCpList] = useState<{ counterpart_id: number; name: string }[]>([]);

  // 편집 팝업 상태 — 카드를 꾹 누르면 열린다.
  const [draft, setDraft] = useState<any | null>(null);
  const [splits, setSplits] = useState<SplitDraft[]>([]);
  const [placePickerOpen, setPlacePickerOpen] = useState(false);

  /* 뒤로 가기 · Backspace로 지금 열린 것만 닫는다.
     카드 편집 팝업은 CardEditModal이 스스로 처리한다. */
  useBackClose(filterOpen, () => closeFilter());
  useBackClose(placePickerOpen, () => setPlacePickerOpen(false));

  useEffect(() => {
    // 조회가 실패하면 빈 목록으로 둔다. 그냥 두면 처리되지 않은 거절만
    // 남고 화면은 까닭 없이 비어 보인다. 기준 자료라 한 번은 알린다.
    const 메타실패 = () => say.warn("기준 자료를 불러오지 못했습니다. 새로 고쳐 주세요.");
    api.get("/categories/lvl1").then((r) => setCat1List(r.data)).catch(메타실패);
    api.get("/categories/lvl2").then((r) => setCat2List(r.data)).catch(메타실패);
    api.get("/counterparts").then((r) => setCpList(r.data)).catch(메타실패);
    api.get("/categories/lvl3").then((r) => setCat3List(r.data)).catch(메타실패);
    api
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

  /* 카드 실적에서 뺄지 — 기호를 누르는 즉시 담는다.
     목록을 다시 읽지 않고 그 줄만 갈아 끼운다. 담기지 않으면 되돌린다. */
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
    const after = next ? 1 : 0;
    const before = row.perf_exclude ?? 0;
    /* 걸러 낸 목록과 원본 둘 다 갈아 끼운다 — 하나만 고치면 필터를
       걸었다 풀 때 표가 되돌아간다. */
    const stamp = (v: number) => {
      setRows((prev) => prev.map((r) => (r.entry_id === id ? { ...r, perf_exclude: v } : r)));
      setAllRows((prev) => prev.map((r) => (r.entry_id === id ? { ...r, perf_exclude: v } : r)));
    };
    stamp(after);
    try {
      await api.put(`/pending-entries/${id}/perf-exclude`, null, { params: { value: after } });
    } catch (err) {
      console.error(err);
      stamp(before);
      say.bad("실적 제외를 담지 못했습니다.");
    }
  };

  /* 고정인지 변동인지 — 카드 실적 제외와 같은 방식이다. 여기서 누르면 그 건에
     손으로 정한 것이 되어, 뒤에 분류 설정을 바꿔도 이 건은 그대로다. */
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
    const after = next ? 1 : 0;
    const before = row.fixed_flag ?? null;
    const stamp = (v: number | null) => {
      setRows((prev) => prev.map((r) => (r.entry_id === id ? { ...r, fixed_flag: v } : r)));
      setAllRows((prev) => prev.map((r) => (r.entry_id === id ? { ...r, fixed_flag: v } : r)));
    };
    stamp(after);
    try {
      await api.put(`/pending-entries/${id}/fixed`, null, { params: { value: String(after) } });
    } catch (err) {
      console.error(err);
      stamp(before);
      say.bad("고정/변동을 담지 못했습니다.");
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

  // 팝업에서 저장 — 해당 건만 반영한다.
  const saveDraft = async () => {
    if (!draft) return;

    // 분할 검증 — 빈 줄은 버리고, 합계가 결제 금액을 넘으면 막는다.
    const cleanSplits = splits.filter(
      (x) => x.amount !== "" && Number(x.amount) > 0
    );
    if (splits.some((x) => x.amount === "" || Number(x.amount) <= 0)) {
      say.warn("쪼갠 금액은 0보다 커야 합니다.");
      return;
    }
    const splitSum = cleanSplits.reduce((a, r) => a + Number(r.amount), 0);
    if (splitSum > Number(draft.amount)) {
      say.warn("쪼갠 합계가 결제 금액을 넘었습니다.");
      return;
    }

    // 서버가 받아야 하는 형태로 정제 — API는 배열을 받으므로 1건짜리 배열로 보낸다.
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
      say.ok("저장 완료-!! ;-)");
      await loadData();

      // 필터가 활성화되어 있으면 다시 적용
      if (isFilterActive) {
        applyFilter();
      }
    } catch (err) {
      console.error(err);
      say.bad("저장하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  const deletePending = async (id: number) => {
    if (
      !(await ask({
        title: "대기 내역 제거",
        body: "이 대기 내역을 제거할까요?",
        warn: "되돌릴 수 없습니다.",
        go: "제거",
        danger: true,
      }))
    )
      return;

    try {
      await api.delete(`/pending-entries/${id}`);
      setRows(prev => prev.filter(r => r.entry_id !== id));
      closeEditor();
      say.ok("제거 완료-!! ;-)");
    } catch (err) {
      console.error(err);
      say.bad("제거하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  /* Excel 내보내기 — 뒤에 보완하기로 하고 자리만 만들어 둔다.
     조용히 아무 일도 없으면 눌린 건지 알 수 없으므로 한마디 남긴다. */
  const exportExcel = () => {
    say.warn("Excel 내보내기는 아직 준비 중입니다.");
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
      say.ok(`${res.data.inserted ?? 0}건 적재 완료-!! ;-)`);
      await loadData();
      
      // 필터가 활성화되어 있으면 다시 적용
      if (isFilterActive) {
        applyFilter();
      }
    } catch (err) {
      console.error(err);
      say.bad("Excel을 불러오지 못했습니다. 다시 시도해 주세요.");
    } finally {
      e.target.value = ""; // 같은 파일 다시 올릴 수 있게 리셋
    }
  };

  // Send 단일 카드: (1) pending 업데이트 → (2) send API → (3) 목록에서 제거
  // 보내는 동안 잠근다. 확인을 누른 뒤 응답이 늦을 때 다시 누르면 같은 건이
  // 두 번 나간다.
  const [sending, setSending] = useState(false);

  const sendOne = async (row: any) => {
    if (sending) return;
    // 필수 입력값 검증
    if (!row.tx_date || !row.cat1_id || !row.cat2_id || row.amount == null || row.amount === '' || !row.pay_method) {
      say.warn("날짜, 분류, 금액, 결제 수단은 꼭 넣어 주세요.");
      return;
    }

    if (
      !(await ask({
        title: "지출 내역으로 보내기",
        body: "이 항목을 지출 내역으로 보낼까요?",
        go: "보내기",
      }))
    )
      return;

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

      setSending(true);
      await api.put(`/pending-entries/${row.entry_id}`, payload);

      // 2) entries로 전송 + sended=TRUE
      await api.post(`/pending-entries/send/${row.entry_id}`);

      say.ok("전송 완료-!! ;-)");
      setRows((prev) => prev.filter((r) => r.entry_id !== row.entry_id));
      setAllRows((prev) => prev.filter((r) => r.entry_id !== row.entry_id));
    } catch (err) {
      console.error(err);
      say.bad("전송하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  };

  /* 여러 건을 한꺼번에 지출 내역으로 보낸다.

     선택한 항목이 없으면 지금 걸러 둔 것을 통째로, 하나라도 선택했으면 그것만
     보낸다. 보내는 길은 하나라 뒤처리(다시 읽기 · 필터 다시 걸기)도 하나다. */
  const sendMany = async () => {
    if (sending) return;
    const 선택함 = picked.length > 0;
    const 보낼것 = 선택함 ? picked : rows;

    if (보낼것.length === 0) {
      say.warn("보낼 항목이 없습니다.");
      return;
    }

    if (
      !(await ask({
        title: 선택함 ? "선택한 항목 지출 내역으로 보내기" : "모두 지출 내역으로 보내기",
        body: 선택함
          ? `선택한 ${보낼것.length}건을 지출 내역으로 보낼까요?`
          : "모두 지출 내역으로 보낼까요?",
        go: 선택함 ? "선택 보내기" : "모두 보내기",
      }))
    )
      return;

    try {
      setSending(true);
      const entryIds = 보낼것.map((r) => r.entry_id);
      const res = await api.post("/pending-entries/send-filtered", {
        entry_ids: entryIds
      });
      const sentCount = res.data.sent_count ?? 0;

      if (sentCount === 0) {
        say.warn("보낼 항목이 없습니다.");
      } else {
        say.ok(`${sentCount}건 전송 완료-!! ;-)`);
      }

      /* 보낸 것은 목록에서 사라지므로 선택한 항목도 함께 비운다. */
      setPickedIds(new Set());

      // 데이터 다시 로드(sended = 0인 항목만 표시됨)
      await loadData();

      // 필터가 활성화되어 있으면 다시 적용
      if (isFilterActive) {
        applyFilter();
      }
    } catch (err) {
      console.error(err);
      say.bad("전송하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setSending(false);
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

  /* 버튼과 기간 표시는 '적용된 값'만 본다. 초안은 팝업 안에서만 산다. */
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
    [rows, blurSets]
  );

  // 클라이언트 사이드 필터 적용
  /* [적용]을 누르지 않고 닫으면 고치던 값은 버린다.
     다시 열었을 때 지금 걸려 있는 조건이 그대로 보여야 한다. */
  const closeFilter = () => {
    setFilter(appliedFilter);
    setFilterOpen(false);
  };

  const applyFilter = () => {
    /* 초안을 그대로 확정한다 — 여기부터 화면에 반영된다. */
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
      /* 12px만 끌어도 열리게 한다. 30px는 뻑뻑했다. */
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
            {/* 내보내기는 자리만 잡아 둔다. 실제 동작은 뒤에 붙인다. */}
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

            {/* 도구 줄은 늘 [모두 전송]이다. 고른 것만 보내는 일은 아래
                고르기 막대가 맡는다 — 같은 자리의 단추가 때에 따라 다른 일을
                하면 무엇이 갈지 누르기 전에 알 수 없다. */}
            <button onClick={sendMany} className="ui-btn primary" disabled={sending}>
              모두 전송
            </button>
          </div>
        </div>
      </div>

      {/* 카드 리스트 — 날짜별 단으로 묶어서 표시 */}
      <div className="card-list">
        {/* 비어 있으면 그렇다고 말한다. 모래시계 팝업이 쓰는 말과 한 글자도
            다르면 안 된다 — 같은 비어 있음을 두 가지로 말하게 된다. */}
        {dateGroups.length === 0 && <p className="page-empty">대기 중인 내역이 없습니다.</p>}
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
                  picked={pickedIds.has(row.entry_id)}
                  onTogglePick={togglePick}
                  blurred={isBlurred(row, blurSets)}
                  fixed={isFixed(row, fixSets)}
                  onToggleFixed={toggleFixed}
                  onTogglePerfExclude={togglePerfExclude}
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
          <>
            <button
              type="button"
              className="pick-bar__more"
              onClick={() => setMakeOpen(true)}
            >
              묶기
            </button>
            <button
              type="button"
              className="pick-bar__more"
              onClick={sendMany}
              disabled={sending}
            >
              선택 전송
            </button>
          </>
        }
      />

      {receiptOpen && (
        <ReceiptPopup rows={receiptRows} onClose={() => setReceiptOpen(false)} />
      )}

      {makeOpen && (
        <GroupMakePopup
          kind="pending"
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
          title="미확정 내역 편집"
          onClose={closeEditor}
          onSave={saveDraft}
          onDelete={() => deletePending(draft.entry_id)}
          headerFields={
            <EditField label="날짜" span={12} required>
              <DayPicker
                value={draft.tx_date ? draft.tx_date.substring(0, 10) : ""}
                onChange={(v) => setField("tx_date", v)}
              />
            </EditField>
          }
        >
          <div className="edit-grid">
            {/* 1행 — 분류 3단 */}
            <EditField label="중분류" span={4} required>
              <SingleSelect
                noun="중분류"
                options={visible(cat1List, (c) => c.id === draft.cat1_id)
                  .map(c => ({ value: String(c.id), label: c.name }))}
                selected={draft.cat1_id ? String(draft.cat1_id) : ""}
                onChange={(value) => setField("cat1_id", value ? Number(value) : null)}
                placeholder="(중분류)"
              />
            </EditField>

            <EditField label="소분류" span={4} required>
              <SingleSelect
                noun="소분류"
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
                noun="세분류"
                options={visible(cat3List, (c) => c.id === draft.cat3_id)
                  .filter((c) => c.cat2_id === draft.cat2_id)
                  .map(c => ({ value: String(c.id), label: c.name }))}
                selected={draft.cat3_id ? String(draft.cat3_id) : ""}
                onChange={(value) => setField("cat3_id", value ? Number(value) : null)}
                placeholder="(세분류)"
              />
            </EditField>

            {/* 2행 — 거래 속성. IN/OUT은 소분류가 결정하므로 분류 바로 아래에 둔다. */}
            <EditField label="IN/OUT" span={4} required>
              <span className={`inout-chip ${draft.inout === 1 ? "in" : draft.inout === -1 ? "out" : ""}`}>
                {draft.inout === 1 ? "IN(+)" : draft.inout === -1 ? "OUT(−)" : "—"}
              </span>
            </EditField>

            <EditField label="결제 수단" span={4} required>
              <SingleSelect
                noun="결제 수단"
                options={visible(payList, (p) => p.code === draft.pay_method)
                  .map(p => ({ value: p.code, label: p.name }))}
                selected={draft.pay_method || ""}
                onChange={(value) => setField("pay_method", value)}
                placeholder="(결제 수단)"
              />
            </EditField>

            <EditField label="금액" span={4} required>
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
              <GrowArea
                className="memo-input memo-area"
                value={draft.memo || ""}
                maxLength={200}
                onChange={(v) => setField("memo", v)}
              />
            </EditField>
          </div>

          {/* 금액 쪼개기 — 지출일 때만 의미가 있다. */}
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
              {/* 편집 팝업과 같은 차례로 — 되돌리는 것 · 닫기 · 하려던 것 */}
              <button className="ui-btn" onClick={closeFilter}>
                닫기
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
      <QuickActions />
    </div>
  );
}

// ------------------------------------
// 카드 한 장 — 표시 전용. 꾹 누르면 편집 팝업이 열린다.
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
  picked = false,
  onTogglePick,
  blurred,
  readOnly = false,
  onTogglePerfExclude,
  fixed,
  onToggleFixed,
}: {
  row: any;
  cat1List: { id: number; name: string }[];
  cat2List: { id: number; name: string; cat1_id: number; blur?: number; inout?: number | null }[];
  cat3List: { id: number; name: string; cat2_id: number }[];
  payList: { code: string; name: string; category?: string }[];
  onOpenEditor: (row: any) => void;
  onStartReveal: (id: number, e: any) => void;
  onSend?: (row: any) => void;
  /* 선택한 항목인지. 넘기지 않으면 선택 상자가 서지 않는다 — 기간 상세처럼
     보기만 하는 화면은 지금까지와 같은 꼴을 지킨다. */
  picked?: boolean;
  onTogglePick?: (id: number) => void;
  /* 카드 실적에서 뺄지를 켜고 끈다. 넘기지 않으면 기호가 보기 전용이 된다. */
  onTogglePerfExclude?: (row: PerfRow, next: boolean) => void;
  /* 이 건이 고정인지 — 건에 정해 둔 것이 없으면 분류를 따라 화면이 셈해서 넘긴다. */
  fixed?: boolean;
  /* 고정 · 변동을 뒤집는다. 넘기지 않으면 기호가 보기 전용이 된다. */
  onToggleFixed?: (row: FixedRow, next: boolean) => void;
  /* 중 · 소 · 세 어디에 Blur가 걸렸는지는 화면이 셈해서 넘긴다.
     넘기지 않으면 예전처럼 소분류만 본다. */
  blurred?: boolean;
  /* 보기만 하는 화면(기간 상세)에서는 편집도 전송도 하지 않는다.
     기본값은 지금까지와 같으므로 이 화면의 동작은 그대로다. */
  readOnly?: boolean;
}) {
  const openEditor = useCallback(() => onOpenEditor(row), [onOpenEditor, row]);
  const { pressing, handlers } = useLongPress(openEditor);
  const peel = usePeel(openEditor);

  const cat1Name = cat1List.find((c) => c.id === row.cat1_id)?.name ?? "—";
  const isBlur = blurred ?? (cat2List.find((c) => c.id === row.cat2_id)?.blur === 1);

  const pay = payList.find((p) => String(p.code) === String(row.pay_method));
  const payName = pay?.name ?? "";

  // 쪼갠 건은 실지출(net)을 대표 금액으로 삼는다. 분할이 없으면 net === amount다.
  const hasSplit = (row.split_count ?? 0) > 0;
  /* 쪼갠 몫을 펼쳤는지. 카드마다 따로 기억한다. */
  const [open, setOpen] = useState(false);
  const shownAmount = hasSplit ? row.net_amount : row.amount;

  /* 묶인 건은 왼쪽 위 접은 자국이 클립이 된다(index.css 166절). */
  const isClipped = row.group_id != null;

  return (
    <article
      className={`card card--entry card--pressable${readOnly ? " card--flat" : ""}${isClipped ? " is-clipped" : ""} ${pressing && !readOnly ? "pressing" : ""}`}
      {...(readOnly ? {} : handlers)}
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

      {/* 1행: 분류 + 금액 ── 날짜는 상단 날짜 단에서 표시한다. */}
      <div className="entry-ln entry-ln--head">
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

      {/* 2행: 장소 + 결제 수단 + [전송] */}
      {/* 장소와 결제 수단은 지출 · 정기와 같이 한 줄이다 — 장소가 왼쪽 끝,
          결제 수단이 오른쪽 끝. [전송]은 그 오른쪽 — 보내는 것은 이 결제 수단으로
          그었다고 굳히는 일이라 떼어 놓지 않는다. 장소는 남는 폭만 쓰고 넘치면
          말줄임된다. 메모는 카드에서 빼내 바로 아래 제 판에 담는다(MemoPad). */}
      <div className="entry-ln entry-ln--send">
        {/* 선택해서 함께 보내는 상자. 카드를 꾹 누르면 편집 팝업이 열리므로
            이 상자는 꾹 누르기에서 빼 둔다(data-no-longpress). */}
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
        {/* 카드로 그은 건에만 실적 제외 기호가 선다. */}
        {pay?.category === "카드" && (
          <PerfExcludeButton
            on={!!row.perf_exclude}
            readOnly={readOnly || !onTogglePerfExclude}
            onToggle={(next) => onTogglePerfExclude?.(row, next)}
          />
        )}
        <span className="pay-method-text">{payName}</span>
        {!readOnly && (
          <div className="card-right">
            <button className="ui-btn small" onClick={() => onSend?.(row)}>
              전송
            </button>
          </div>
        )}
      </div>

      <MemoPad memo={row.memo} />

      {/* 쪼갠 건 — 카드 바닥에 붙는 칸. 누르면 그 아래로 함께한 사람과 몫이 펼쳐진다. */}
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
            <SplitRows base="/pending-entries" ownerId={row.entry_id} />
          </Collapse>
        </div>
      )}
    </article>
  );
}
