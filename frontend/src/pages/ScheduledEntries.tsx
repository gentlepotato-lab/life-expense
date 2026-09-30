import { visible } from "../utils/visible";
import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "../api/client";
import useBackClose from "../hooks/useBackClose";
import SingleSelect from "./components/SingleSelect";
import CardEditModal, { EditField, EditDivider } from "./components/CardEditModal";
import SplitEditor from "./components/SplitEditor";
import type { SplitDraft } from "./components/SplitEditor";
import PlacePicker from "./components/PlacePicker";
import useLongPress from "../hooks/useLongPress";
import usePeel from "../hooks/usePeel";
import useRevealDrag from "../hooks/useRevealDrag";
import DateGroupHeader from "./components/DateGroupHeader";
import SplitRows from "./components/SplitRows";
import { blurSetsFrom, isBlurred, fixedSetsFrom, isFixed } from "../utils/calendarFilter";
import { CollapseAllButtons } from "./components/CollapseToggle";
import QuickActions from "./components/QuickActions";
import MemoPad from "./components/MemoPad";
import PerfExcludeButton from "./components/PerfExcludeButton";
import FixedMark from "./components/FixedMark";
import { BulbOnIcon, BulbOffIcon } from "./components/SkipIcons";
import MonthPicker from "./components/MonthPicker";
import GrowArea from "./components/GrowArea";
import { groupByDate } from "../utils/dateGroup";
import { apiErrorMessage } from "../utils/apiError";
import {
  INTERVAL_OPTIONS,
  HOLIDAY_OPTIONS,
  intervalLabel,
  ymLong,
  ymNow,
} from "../utils/schedule";

/* 실적 제외를 켜고 끌 때 손대는 줄 — 그 일에 쓰는 두 칸만 본다.
   카드가 받는 줄은 통째로 넓은 갈래지만, 여기서는 좁혀 쓴다. */
type PerfRow = { schedule_id: number; perf_exclude?: number | null };

/** 고정 · 변동을 뒤집을 때 필요한 것만 */
type FixedRow = { schedule_id: number; fixed_flag?: number | null };


export type CategoryL2Meta = { id: number; name: string; cat1_id?: number; blur?: number; inout?: number | null; is_active?: number };
export type CategoryL3Meta = { id: number; name: string; cat2_id?: number; blur?: number; is_active?: number };

/**
 * 다음 예정일시는 서버가 next_run_at에 들고 있다(scheduled_entries.next_run_at).
 * 예전에는 화면에서도 같은 셈을 따로 했는데, 두 셈이 어긋나면 "보이는 날짜"와
 * "실제로 대기 내역으로 옮겨지는 시점"이 달라진다. 그래서 화면 계산은 걷어 내고
 * 서버 값 하나만 쓴다.
 *
 * 값은 "2026-09-04 11:30:00" 꼴이고 시간대가 붙어 있지 않다. 서버도 이 PC도
 * 같은 시간대(Asia/Seoul)라 그대로 읽으면 된다. 다만 new Date(문자열)은
 * 브라우저마다 해석이 달라서, 숫자를 직접 떼어 만든다.
 */
/**
 * `말일`을 가리키는 day_of_month 값. 서버의 LAST_DAY와 같은 값이다.
 *
 * 달마다 끝 날이 달라 하나의 숫자로는 적을 수 없어, 1~31 바깥의 값을 하나
 * 정해 두고 서버가 셈할 때 그 달의 끝 날로 바꿔 쓴다.
 */
const LAST_DAY = 32;

/**
 * 시각을 12시간제로 적는다 — `14:15` → `2:15 p.m.`
 *
 * 정기는 "아침에 빠져나가는가 밤에 빠져나가는가"가 눈에 들어와야 하는데,
 * 24시간제 숫자는 한 번 셈을 해야 알 수 있다. 담는 값과 고치는 칸은
 * 24시간제 그대로 두고 적을 때만 바꾼다.
 */
function hour12(v: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(v);
  if (!m) return v;
  const h = Number(m[1]);
  const noon = h >= 12;
  /* 0시는 12 a.m., 12시는 12 p.m. — 0으로 적는 시계는 없다. */
  const shown = h % 12 === 0 ? 12 : h % 12;
  return `${shown}:${m[2]} ${noon ? "p.m." : "a.m."}`;
}

/** 며칠인지 적는 말. 말일은 숫자 대신 그 말로 적는다. */
function dayLabel(day: number | string | null | undefined): string {
  if (day === null || day === undefined || day === "") return "-일";
  return Number(day) === LAST_DAY ? "말일" : `${day}일`;
}

/**
 * 카드와 팝업 머리말에 적는 "언제 오는가" 한 마디.
 *
 * 매월이면 지금까지처럼 "매월 15일"이다. 해에 한 번 오는 것은 몇 월인지가
 * 곧 그 스케줄의 얼굴이라 달까지 적는다 — "매년 6월 25일". 그 사이(격월 ·
 * 분기 · 반년)는 달이 번갈아 바뀌므로 한 달을 집어 적을 수 없다.
 */
function whenLabel(
  interval: number | string | null | undefined,
  anchorYm: string | null | undefined,
  day: number | string | null | undefined
): string {
  const n = Number(interval ?? 1);
  if (n === 12 && anchorYm) {
    return `매년 ${Number(anchorYm.slice(4))}월 ${dayLabel(day)}`;
  }
  return `${intervalLabel(n)} ${dayLabel(day)}`;
}

/**
 * 건너뛰기를 켤 때 건너뛸 달.
 *
 * "이번 한 번"은 다가오는 회차를 뜻하므로 next_run_at이 든 달이다. 다 끝나
 * 비어 있는 스케줄이면 건너뛸 회차도 없으니 이 달로 떨어뜨린다 — 그 경우
 * 켜도 셈에 걸리는 것이 없어 해가 없다.
 */
function skipTarget(s: { next_run_at?: string | null }): string {
  const d = parseLocal(s.next_run_at);
  const at = d ?? new Date();
  return `${at.getFullYear()}${String(at.getMonth() + 1).padStart(2, "0")}`;
}

function parseLocal(v: string | null | undefined): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(v);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}

/** 새 정기 지출 폼의 빈 자리. 열 때와 닫을 때 같은 것을 써야 한다. */
function emptyForm() {
  return {
    day_of_month: "",
    time: "",
    holiday_handling: "on",
    interval_months: "1",
    anchor_ym: "",
    end_ym: "",
    cat1_id: "",
    cat2_id: "",
    cat3_id: "",
    inout: "-1",
    amount: "",
    pay_method: "",
    memo: "",
    place_id: "",
  };
}

export default function ScheduledEntries() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);  // 폼 표시 여부
  /* 감춘 항목까지 볼지. 분류 · 결제 수단과 같은 자리 · 같은 말이다.
     화면에만 두고 담아 두지 않는다 — 그 화면들과 같은 짜임이다. */
  const [showHidden, setShowHidden] = useState(false);
  const [form, setForm] = useState(() => emptyForm());

  const [cat1List, setCat1List] = useState<{ id: number; name: string; blur?: number; is_active?: number }[]>([]);
  const [cat2List, setCat2List] = useState<{ id: number; name: string; inout: number | null; is_active?: number }[]>([]);
  const [cat3List, setCat3List] = useState<{ id: number; name: string; is_active?: number }[]>([]);
  const [cat2All, setCat2All] = useState<CategoryL2Meta[]>([]);
  const [cat3All, setCat3All] = useState<CategoryL3Meta[]>([]);
  const [payList, setPayList] = useState<
    { code: string; name: string; is_active?: number; category?: string }[]
  >([]);
  const [cat2Map, setCat2Map] = useState<Record<number, CategoryL2Meta>>({});
  const [cat3Map, setCat3Map] = useState<Record<number, CategoryL3Meta>>({});

  // 편집 팝업 상태 — 카드를 꾹 누르면 열린다.
  const [draft, setDraft] = useState<any | null>(null);
  const [splits, setSplits] = useState<SplitDraft[]>([]);
  /* 아직 없는 스케줄의 몫. 만들고 나서 schedule_id를 받아야 붙일 수 있어
     그때까지 화면이 들고 있는다. */
  const [formSplits, setFormSplits] = useState<SplitDraft[]>([]);

  // 장소 선택 — 편집 팝업(draft)과 신규 등록 폼(form) 중 어디에 반영할지
  const [placePickerFor, setPlacePickerFor] = useState<"draft" | "form" | null>(null);

  /* 뒤로 가기 · Backspace로 지금 열린 것만 닫는다. */
  useBackClose(showForm, () => setShowForm(false));

  /* 폼을 닫고 적던 값을 비운다. 바깥을 눌러 닫을 때와 [닫기]가 같게 움직인다. */
  const closeForm = useCallback(() => {
    setShowForm(false);
    // 폼 닫을 때 초기화
    setForm(emptyForm());
    setFormSplits([]);
    setCat2List([]);
  }, []);
  useBackClose(placePickerFor !== null, () => setPlacePickerFor(null));
  // 아직 DB에 없는 카카오 장소는 저장 직전에 등록해야 하므로 원본을 들고 있는다.
  const [draftPlace, setDraftPlace] = useState<any | null>(null);
  const [formPlace, setFormPlace] = useState<any | null>(null);
  const [formPlaceName, setFormPlaceName] = useState("");

  // 팝업 열림/닫힘 시 배경 스크롤 제어
  useEffect(() => {
    if (showForm || draft || placePickerFor) {
      document.documentElement.classList.add("modal-open");
      // showForm일 때만 pointerEvents 설정(쓰기·계산기 팝업은 QuickActions가 따로 맡는다)
      if (showForm) {
        document.body.style.pointerEvents = "none";
      }
    } else {
      document.documentElement.classList.remove("modal-open");
      document.body.style.pointerEvents = "auto";
    }

    return () => {
      document.documentElement.classList.remove("modal-open");
      document.body.style.pointerEvents = "auto";
    };
  }, [showForm, draft, placePickerFor]);

  /**
   * 저장 직전에 place_id를 확정한다.
   * 새로 고른 카카오 장소는 아직 DB에 없으므로 먼저 등록하고 발급된 id를 쓴다.
   * (백엔드가 kakao_id로 중복을 걸러 준다)
   */
  const ensurePlaceId = async (picked: any, currentId: any) => {
    if (!picked) return currentId ? Number(currentId) : null;
    if (picked.place_id) return Number(picked.place_id);

    const res = await axios.post("/places", {
      place_name: picked.place_name,
      lat: picked.lat,
      lng: picked.lng,
      address_name: picked.address_name,
      kakao_id: picked.kakao_id,
      road_address_name: picked.road_address_name,
      phone: picked.phone,
      category_name: picked.category_name,
      category_group_code: picked.category_group_code,
      category_group_name: picked.category_group_name,
      place_url: picked.place_url,
    });
    return res.data.place_id;
  };

  /* 휴일 표를 내려받던 자리. 화면이 예정일시를 스스로 셈할 때만 필요했다.
     지금은 서버가 계산해 next_run_at에 담아 주므로 받아 둘 이유가 없다. */

  // 메타데이터 로드
  useEffect(() => {
    axios.get("/categories/lvl1")
      .then((res) => {
        setCat1List(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        console.error("카테고리 로드 실패...\n", err);
        setCat1List([]);
      });
    
    axios.get("/payment-methods")
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setPayList(
          data.map((p: any) => ({
            code: String(p.method_id),
            name: p.method_name,
            is_active: p.is_active,
            /* 카드인 줄에만 실적 제외 기호가 선다. */
            category: p.category,
          }))
        );
      })
      .catch((err) => {
        console.error("결제 수단 로드 실패...\n", err);
        setPayList([]);
      });

    axios
      .get("/categories/lvl2")
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setCat2All(data);
        const map = data.reduce((acc, item) => {
          if (typeof item?.id === "number") {
            acc[item.id] = {
              id: item.id,
              name: item.name,
              cat1_id: item.cat1_id,
              /* 소분류의 Blur 설정. 담지 않아서 정기 내역만 금액이 그대로 보였다. */
              blur: item.blur ?? 0,
              inout: item.inout ?? null,
            };
          }
          return acc;
        }, {} as Record<number, CategoryL2Meta>);
        setCat2Map(map);
      })
      .catch((err) => {
        console.error("전체 소분류 로드 실패...\n", err);
        setCat2Map({});
      });

    axios
      .get("/categories/lvl3")
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setCat3All(data);
        const map = data.reduce((acc, item) => {
          if (typeof item?.id === "number") {
            acc[item.id] = {
              id: item.id,
              name: item.name,
              cat2_id: item.cat2_id,
            };
          }
          return acc;
        }, {} as Record<number, CategoryL3Meta>);
        setCat3Map(map);
      })
      .catch((err) => {
        console.error("전체 세분류 로드 실패...\n", err);
        setCat3Map({});
      });
  }, []);

  // 소분류 로드
  useEffect(() => {
    if (!form.cat1_id) {
      setCat2List([]);
      return;
    }
    axios
      .get("/categories/lvl2", { params: { cat1_id: form.cat1_id } })
      .then((res) => {
        setCat2List(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        console.error("소분류 로드 실패...\n", err);
        setCat2List([]);
      });
  }, [form.cat1_id]);

  // 소분류 선택 시 IN/OUT 자동 설정
  useEffect(() => {
    if (form.cat2_id) {
      const selectedCat2 = cat2List.find(c => String(c.id) === form.cat2_id);
      if (selectedCat2 && selectedCat2.inout !== null) {
        setForm(f => ({ ...f, inout: String(selectedCat2.inout) }));
      }
    }
  }, [form.cat2_id, cat2List]);

  // 세분류 로드
  useEffect(() => {
    if (!form.cat2_id) {
      setCat3List([]);
      setForm((f) => ({ ...f, cat3_id: "" }));
      return;
    }
    axios
      .get("/categories/lvl3", { params: { cat2_id: form.cat2_id } })
      .then((res) => {
        setCat3List(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        console.error("세분류 로드 실패...\n", err);
        setCat3List([]);
      });
  }, [form.cat2_id]);

  const toTimeString = (hour?: number, minute?: number) => {
    if (typeof hour !== "number" || typeof minute !== "number") return "00:00";
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  const decorateSchedule = (item: any) => ({
    ...item,
    time: toTimeString(item.hour, item.minute),
    memo: item.memo || "",
    editable: false,
    __dirty: false,
  });

  /* 카드 실적에서 뺄지 — 기호를 누르는 즉시 담는다. 여기서 켜 두면 이
     스케줄이 대기 내역으로 나갈 때마다 표가 따라간다. 목록을 다시 읽지 않고
     그 줄만 갈아 끼우고, 담기지 않으면 되돌린다. */
  const togglePerfExclude = async (row: PerfRow, next: boolean) => {
    /* 고정 · 변동 기호와 나란히 선 작은 기호라 손가락이 스치기 쉽다.
       그쪽과 같이 한 번 묻는다. */
    if (!window.confirm(next ? "실적에서 제외하시겠습니까?" : "실적에 포함하시겠습니까?"))
      return;
    const id = row.schedule_id;
    const after = next ? 1 : 0;
    const before = row.perf_exclude ?? 0;
    const stamp = (v: number) =>
      setSchedules((prev) =>
        prev.map((x) => (x.schedule_id === id ? { ...x, perf_exclude: v } : x))
      );
    stamp(after);
    try {
      await axios.put(`/scheduled-entries/${id}/perf-exclude`, null, { params: { value: after } });
    } catch (err) {
      console.error(err);
      stamp(before);
      alert("실적 제외를 담지 못했습니다.");
    }
  };

  /* 고정인지 변동인지 — 카드 실적 제외와 같은 방식이다. 여기서 켜 두면 이
     스케줄이 대기 내역으로 나갈 때마다 표가 따라간다. */
  const toggleFixed = async (row: FixedRow, next: boolean) => {
    /* 기호가 작고 결제 수단 바로 옆이라 손가락이 스치기 쉽다. 잘못 눌러도
       곧바로 바뀌면 바뀐 줄도 모르고 지나간다. 지우기 · 확정과 같이 한 번 묻는다. */
    if (!window.confirm(`${next ? "변동 → 고정" : "고정 → 변동"} 내역으로 변경하시겠습니까?`))
      return;
    const id = row.schedule_id;
    const after = next ? 1 : 0;
    const before = row.fixed_flag ?? null;
    const stamp = (v: number | null) =>
      setSchedules((prev) =>
        prev.map((x) => (x.schedule_id === id ? { ...x, fixed_flag: v } : x))
      );
    stamp(after);
    try {
      await axios.put(`/scheduled-entries/${id}/fixed`, null, {
        params: { value: String(after) },
      });
    } catch (err) {
      console.error(err);
      stamp(before);
      alert("고정 · 변동을 담지 못했습니다.");
    }
  };

  // 스케줄 목록 로드
  const loadSchedules = useCallback(async (withHidden = showHidden) => {
    try {
      const res = await axios.get("/scheduled-entries", {
        params: withHidden ? { include_hidden: 1 } : undefined,
      });
      const data = Array.isArray(res.data) ? res.data : [];
      setSchedules(data.map(decorateSchedule));
    } catch (err) {
      console.error("스케줄 로드 실패...\n:", err);
      setSchedules([]);
    }
    /* decorateSchedule은 이 컴포넌트가 다시 그려질 때마다 새로 만들어지지만
       하는 일이 값에만 달려 있어 묶어 둘 것이 없다. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHidden]);

  /* 감춘 항목을 볼지 말지가 바뀌면 서버에서 다시 받아 온다 — 감춘 것은
     서버가 걸러 주므로 화면에서 걸러 낼 수가 없다. */
  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  // ------------------------------------
  // 편집 팝업
  // ------------------------------------

  const openEditor = useCallback((schedule: any) => {
    setDraft({ ...schedule });
    setDraftPlace(null);          // 이번 편집에서 새로 고른 장소만 추적한다.
    // 분할은 목록 조회에 합계만 실려 오므로, 편집할 때 상세를 따로 가져온다.
    setSplits([]);
    if (schedule.split_count > 0) {
      axios
        .get(`/scheduled-entries/${schedule.schedule_id}/splits`)
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
    setDraftPlace(null);
    setPlacePickerFor(null);
  }, []);

  // 팝업 안 필드 변경
  const setField = (field: string, value: any) => {
    setDraft((prev: any) => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };

      // 중분류가 바뀌면 하위 선택 초기화
      if (field === "cat1_id" && prev.cat1_id !== value) {
        next.cat2_id = null;
        next.cat3_id = null;
      }

      // 소분류 변경 시 IN/OUT 자동 설정 + 세분류 초기화
      if (field === "cat2_id") {
        if (prev.cat2_id !== value) next.cat3_id = null;
        if (value !== null && value !== undefined) {
          const selectedCat2 = cat2All.find((c) => c.id === Number(value));
          if (selectedCat2 && selectedCat2.inout !== null && selectedCat2.inout !== undefined) {
            next.inout = selectedCat2.inout;
          }
        }
      }

      return next;
    });
  };

  // IN/OUT 전환(소분류 선택 시 자동 설정되므로 비활성화)
  // const toggleScheduleInOut = (scheduleId: number) => {
  //   mutateSchedule(scheduleId, (item) => ({
  //     ...item,
  //     inout: item.inout === 1 ? -1 : 1,
  //   }));
  // };

  // Next 날짜 기준으로 정렬된 schedules
  /** 다음 예정일시가 이른 것부터. 값이 없으면 맨 뒤로 민다. */
  /* 예정일 빠른 차례. 감춘 것은 예정일이 없으므로 Infinity로 떨어져
     맨 아래 한 단에 모인다 — 앞으로 올 것들을 위에서 먼저 보게 한다. */
  const sortedSchedules = useMemo(() => {
    return [...schedules].sort((a, b) => {
      const ta = parseLocal(a.next_run_at)?.getTime() ?? Infinity;
      const tb = parseLocal(b.next_run_at)?.getTime() ?? Infinity;
      return ta - tb;
    });
  }, [schedules]);

  /** 예정일시의 날짜로 묶는다. 지출 내역·대기 내역과 같은 모양이 된다. */
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
    () => blurSetsFrom(cat1List, cat2All, cat3All),
    [cat1List, cat2All, cat3All]
  );

  /* 고정 · 변동은 소 · 세에만 둔다. 건에 손으로 정해 둔 것이 있으면 그것이 먼저다. */
  const fixSets = useMemo(() => fixedSetsFrom(cat2All, cat3All), [cat2All, cat3All]);

  const dateGroups = useMemo(
    () =>
      /* 날짜 단 합계는 집계라 테이프를 붙이지 않는다. 덮는 것은 카드뿐이다. */
      groupByDate(
        sortedSchedules.map((s) => ({
          ...s,
          tx_date: (s.next_run_at || "").substring(0, 10),
        }))
      ),
    [sortedSchedules]
  );

  const buildSchedulePayload = (schedule: any) => {
    const [hour, minute] = (schedule.time || "00:00").split(":").map(Number);

    return {
      day_of_month: Number(schedule.day_of_month),
      hour,
      minute,
      holiday_handling: schedule.holiday_handling,
      interval_months: Number(schedule.interval_months ?? 1),
      /* 매월은 박자를 정할 것이 없어 첫 달을 비운다. 셋 중 끝은 하나만
         사므로 나머지는 반드시 null이어야 서버가 막지 않는다. */
      anchor_ym: Number(schedule.interval_months ?? 1) === 1 ? null : schedule.anchor_ym || null,
      end_ym: schedule.end_ym || null,
      skip_ym: schedule.skip_ym || null,
      /* 감췄는지도 함께 담는다. 팝업에서 뒤집어 둔 것이 [저장]으로 먹는다. */
      is_active: schedule.is_active === 0 ? 0 : 1,
      cat1_id: Number(schedule.cat1_id),
      cat2_id: Number(schedule.cat2_id),
      cat3_id: schedule.cat3_id ? Number(schedule.cat3_id) : null,
      inout: Number(schedule.inout),
      amount: Number(schedule.amount),
      pay_method: schedule.pay_method ? Number(schedule.pay_method) : null,
      memo: schedule.memo ? schedule.memo : null,
      place_id: schedule.place_id ? Number(schedule.place_id) : null,
    };
  };

  const validateSchedule = (schedule: any) => {
    return (
      schedule.day_of_month &&
      schedule.time &&
      schedule.cat1_id &&
      schedule.cat2_id &&
      schedule.amount != null && schedule.amount !== '' &&
      schedule.pay_method
    );
  };

  // 팝업에서 저장 — 해당 스케줄만 반영한다.
  const saveDraft = async () => {
    if (!draft) return;

    if (!validateSchedule(draft)) {
      alert("모든 필수 항목(일자, 시간, 카테고리, 금액, 결제 수단)을 입력하세요.");
      return;
    }

    // 분할 검증 — 빈 줄은 버리고, 합계가 결제 금액을 넘으면 막는다.
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

    try {
      setIsSaving(true);
      const placeId = await ensurePlaceId(draftPlace, draft.place_id);
      await axios.put(`/scheduled-entries/${draft.schedule_id}`, {
        ...buildSchedulePayload(draft),
        place_id: placeId,
      });
      // 분할은 별도 엔드포인트다. 비어 있어도 보내야 기존 분할이 지워진다.
      await axios.put(`/scheduled-entries/${draft.schedule_id}/splits`, cleanSplits);
      closeEditor();
      alert("스케줄이 저장되었습니다.");
      await loadSchedules();
    } catch (err: any) {
      console.error(err);
      alert("저장 중 오류가 발생했습니다.\n" + (err.response?.data?.detail || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    if (
      !form.day_of_month ||
      !form.time ||
      !form.cat1_id ||
      !form.cat2_id ||
      form.amount == null || form.amount === '' ||
      !form.pay_method
    ) {
      alert("필수 항목을 모두 입력하세요.");
      return;
    }
    if (form.interval_months !== "1" && !form.anchor_ym) {
      alert("매월이 아니면 시작하는 달을 고르세요.");
      return;
    }

    // 몫은 빈 줄을 버리고, 합계가 결제 금액을 넘으면 막는다 — 편집과 같은 잣대다.
    const cleanSplits = formSplits.filter(
      (x) => x.amount !== "" && Number(x.amount) > 0
    );
    if (formSplits.some((x) => x.amount === "" || Number(x.amount) <= 0)) {
      alert("분할 금액은 0보다 커야 합니다.");
      return;
    }
    if (cleanSplits.reduce((a, r) => a + Number(r.amount), 0) > Number(form.amount)) {
      alert("분할 합계가 결제 금액을 초과합니다.");
      return;
    }

    // time 문자열을 시/분으로 분리(HH:MM → hour, minute)
    const [hour, minute] = form.time.split(":").map(Number);

    try {
      const placeId = await ensurePlaceId(formPlace, form.place_id);

      const res = await axios.post("/scheduled-entries", {
        day_of_month: Number(form.day_of_month),
        hour: hour,
        minute: minute,
        holiday_handling: form.holiday_handling,
        interval_months: Number(form.interval_months),
        anchor_ym: form.interval_months === "1" ? null : form.anchor_ym,
        end_ym: form.end_ym || null,
        cat1_id: Number(form.cat1_id),
        cat2_id: Number(form.cat2_id),
        cat3_id: form.cat3_id ? Number(form.cat3_id) : null,
        inout: Number(form.inout),
        amount: Number(form.amount),
        pay_method: form.pay_method ? Number(form.pay_method) : null,
        memo: form.memo || null,
        place_id: placeId,
        is_active: 1,
      });

      // 몫은 스케줄이 생긴 뒤에야 붙일 수 있다. 빈 채로는 부르지 않는다.
      const newId = res.data?.schedule_id;
      if (newId && cleanSplits.length > 0) {
        await axios.put(`/scheduled-entries/${newId}/splits`, cleanSplits);
      }

      alert("스케줄이 등록되었습니다.");
      loadSchedules();
      setFormPlace(null);
      setFormPlaceName("");

      // 폼 초기화 및 숨기기
      setForm(emptyForm());
      setFormSplits([]);
      setCat2List([]);
      setShowForm(false);
    } catch (err: any) {
      console.error(err);
      alert("등록 중 오류가 발생했습니다.\n" + (err.response?.data?.detail || err.message));
    }
  };

  const handleDelete = async (scheduleId: number) => {
    if (!window.confirm("이 정기 지출을 제거할까요?")) return;

    try {
      await axios.delete(`/scheduled-entries/${scheduleId}`);
      closeEditor();
      alert("제거 완료-!! ;-)");
      await loadSchedules();
    } catch (err) {
      console.error(err);
      alert(apiErrorMessage(err));
    }
  };

  /**
   * 감출지 말지를 뒤집는다.
   *
   * 팝업 안의 다른 칸과 같이 여기서는 초안만 바꾸고, [저장]을 눌러야
   * 반영된다 — 주기도 금액도 그렇게 움직이는데 이것만 즉시 먹으면
   * 한 팝업 안에서 잣대가 둘이 된다. 그래서 묻지도, 알리지도 않는다.
   *
   * 다음 예정일은 서버가 저장할 때 함께 손봐 준다. 감추면 비우고, 풀면
   * 다시 셈한다.
   */
  const toggleHidden = () =>
    setField("is_active", draft?.is_active === 0 ? 1 : 0);

  /* 일 선택 옵션 생성(1-31, 그리고 말일).
     말일을 맨 뒤에 두는 것은 1일부터 세어 온 차례의 끝이기 때문이다. */
  const dayOptions = [...Array.from({ length: 31 }, (_, i) => i + 1), LAST_DAY];

  return (
    <div className="page-wrap">

      {/* New & Save 툴바 */}
      {/* 툴바 껍데기는 쓴 내역 · 대기 내역과 같은 것을 쓴다.
          화면을 옮겨 다녀도 첫 줄이 같은 높이에서 시작해야 한다. */}
      <div className="toolbar-wrap">
        <div className="toolbar">
          {/* 분류 · 결제 수단과 같은 자리 · 같은 말 — 줄 왼쪽 끝이다.
              .toolbar-btns 안에 넣으면 그 묶음이 오른쪽에 붙어 있어
              가운데로 밀린다. */}
          <label className="cp-toggle">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
            />
            감춘 항목 보기
          </label>

          <div className="toolbar-btns">
            <CollapseAllButtons
              onExpandAll={() => setCollapsedDays(new Set())}
              onCollapseAll={() => setCollapsedDays(new Set(dateGroups.map((g) => g.date)))}
            />
            <button
              onClick={() => setShowForm(!showForm)}
              className="ui-btn primary scheduled-toolbar__btn scheduled-toolbar__btn--new"
            >
              [+] 새 정기 지출
            </button>
          </div>
        </div>
      </div>

      {/* 등록 폼 팝업 */}
      {showForm && (
        <CardEditModal
          title="새 정기 지출"
          onClose={closeForm}
          onSave={handleSubmit}
          saveLabel="등록"
          headerFields={
            <>
              {/* 첫 줄은 주기와 시작이 나눠 쓴다. 매월은 시작을 묻지 않으므로
                  주기가 그 줄을 혼자 쓰고, 날과 시각은 늘 둘째 줄에 나란히 선다 —
                  "몇 달마다"와 "며칠 몇 시"는 다른 결의 물음이다. */}
              <EditField label="주기" span={form.interval_months === "1" ? 12 : 6} required>
                <SingleSelect
                  noun="주기"
                  options={INTERVAL_OPTIONS.map((o) => ({ ...o }))}
                  selected={form.interval_months}
                  onChange={(value) =>
                    setForm({
                      ...form,
                      interval_months: value,
                      // 매월로 되돌리면 첫 달은 볼 것이 없어 비운다.
                      anchor_ym: value === "1" ? "" : form.anchor_ym || ymNow(),
                    })
                  }
                />
              </EditField>

              {/* 격월 이상일 때만 첫 달을 묻는다. 매월은 박자를 정할 것이 없다. */}
              {form.interval_months !== "1" && (
                <EditField label="시작" span={6} required>
                  <MonthPicker
                    value={form.anchor_ym}
                    onChange={(ym) => setForm({ ...form, anchor_ym: ym })}
                    suffix="부터"
                    placeholder="(시작)"
                  />
                </EditField>
              )}

              <EditField label={intervalLabel(form.interval_months)} span={6} required>
                <SingleSelect
                  noun="날짜"
                  options={dayOptions.map((d) => ({ value: String(d), label: dayLabel(d) }))}
                  selected={form.day_of_month}
                  onChange={(value) => setForm({ ...form, day_of_month: value })}
                  placeholder="(일)"
                />
              </EditField>

              <EditField label="시간" span={6} required>
                <input
                  type="time"
                  name="time"
                  value={form.time}
                  onChange={handleChange}
                  className="ui-input"
                  step="300"
                />
              </EditField>
            </>
          }
        >
          {/* 편집 팝업과 같은 12칸 격자 */}
          <div className="edit-grid">
                <EditField label="중분류" span={4} required>
                  <SingleSelect
                    noun="중분류"
                    options={visible(cat1List, (c) => String(c.id) === form.cat1_id)
                      .map((c) => ({ value: String(c.id), label: c.name }))}
                    selected={form.cat1_id}
                    onChange={(value) => setForm({ ...form, cat1_id: value })}
                    placeholder="(중분류)"
                  />
                </EditField>

                <EditField label="소분류" span={4} required>
                  <SingleSelect
                    noun="소분류"
                    options={visible(cat2List, (c) => String(c.id) === form.cat2_id)
                      .map((c) => ({ value: String(c.id), label: c.name }))}
                    selected={form.cat2_id}
                    onChange={(value) => setForm({ ...form, cat2_id: value })}
                    placeholder="(소분류)"
                  />
                </EditField>

                <EditField label="세분류" span={4}>
                  <SingleSelect
                    noun="세분류"
                    options={visible(cat3List, (c) => String(c.id) === form.cat3_id)
                      .map((c) => ({ value: String(c.id), label: c.name }))}
                    selected={form.cat3_id}
                    onChange={(value) => setForm({ ...form, cat3_id: value })}
                    placeholder="(세분류)"
                  />
                </EditField>

                <EditField label="IN/OUT" span={4} required>
                  <span
                    className={`inout-chip ${
                      form.inout === "1" ? "in" : form.inout === "-1" ? "out" : ""
                    }`}
                  >
                    {form.inout === "1" ? "IN(+)" : form.inout === "-1" ? "OUT(−)" : "—"}
                  </span>
                </EditField>

                <EditField label="결제 수단" span={4}>
                  <SingleSelect
                    noun="결제 수단"
                    options={visible(payList, (p) => p.code === form.pay_method)
                      .map((p) => ({ value: p.code, label: p.name }))}
                    selected={form.pay_method}
                    onChange={(value) => setForm({ ...form, pay_method: value })}
                    placeholder="(결제 수단)"
                  />
                </EditField>

                <EditField label="금액" span={4} required>
                  <input
                    type="number"
                    name="amount"
                    value={form.amount}
                    onChange={handleChange}
                    className="amount-input"
                    placeholder="(금액)"
                  />
                </EditField>

                {/* 휴일 처리 · 끝 — 편집 팝업과 같은 칸에 둔다. 거기서는 이 줄
                    셋째 자리에 [한 번 건너뛰기]가 서는데, 새로 만드는 스케줄에는
                    건너뛸 회차가 없어 그 자리를 비워 둔다. 자리를 당겨 채우면
                    두 팝업에서 같은 칸이 다른 x에 서게 된다. */}
                <EditField label="휴일 처리" span={4} required>
                  <SingleSelect
                    noun="휴일 처리"
                    options={HOLIDAY_OPTIONS.map((o) => ({ ...o }))}
                    selected={form.holiday_handling}
                    onChange={(value) => setForm({ ...form, holiday_handling: value })}
                  />
                </EditField>

                {/* 끝은 연월 하나다. 비워 두면 끝이 없다. */}
                <EditField label="끝" span={4}>
                  <MonthPicker
                    value={form.end_ym}
                    onChange={(ym) => setForm({ ...form, end_ym: ym })}
                    /* 끝은 시작보다 앞일 수 없다. 매월이면 시작이 없으니 이 달부터다. */
                    min={form.interval_months === "1" ? ymNow() : form.anchor_ym || ymNow()}
                    suffix="까지"
                    placeholder="(없음)"
                    clearable
                  />
                </EditField>

                <EditField label="장소/가게" span={12}>
                  <div className="edit-place">
                    <span className="edit-place__name">📍 {formPlaceName || "—"}</span>
                    <button
                      type="button"
                      className="ui-btn small"
                      onClick={() => setPlacePickerFor("form")}
                    >
                      검색
                    </button>
                  </div>
                </EditField>

                <EditField label="메모" span={12}>
                  <GrowArea
                    className="memo-input memo-area"
                    name="memo"
                    value={form.memo}
                    placeholder="(메모)"
                    maxLength={200}
                    onChange={(_v, e) => handleChange(e)}
                  />
                </EditField>
          </div>

          {/* 나가는 돈만 쪼갤 수 있다. 편집 팝업과 같은 자리·같은 모양이다. */}
          {form.inout === "-1" && (
            <>
              <EditDivider />
              <SplitEditor
                grossAmount={Number(form.amount) || 0}
                value={formSplits}
                onChange={setFormSplits}
              />
            </>
          )}
        </CardEditModal>
      )}

      {/* 등록된 스케줄 목록 */}
      {schedules.length === 0 ? (
        <p className="page-empty">
          등록된 정기 지출이 없습니다.
          <span className="page-empty__hint">위 [+] 새 정기 지출 을 눌러 등록할 수 있습니다.</span>
        </p>
      ) : (
        <div className="scheduled-card-list">
          {dateGroups.map((group) => (
          <section key={group.date || "no-date"} className="date-group">
            {/* 예정일이 없는 단은 날짜 대신 무엇을 모아 둔 단인지 적는다.
                대개 감춘 것만 모이지만, 끝난 것을 다시 보이게 하면 감춤이
                아니면서 예정일도 없는 줄이 섞인다 — 그때는 이름을 바꿔
                단다. 어느 쪽이든 안 나갈 돈이라 합계는 접는다. */}
            <DateGroupHeader
              label={
                group.date
                  ? group.label
                  : group.items.every((x: { is_active?: number }) => x.is_active === 0)
                  ? "감춘 항목"
                  : "예정 없음"
              }
              summary={group.summary}
              hideSum={!group.date}
              open={!collapsedDays.has(group.date)}
              onToggle={() => toggleDay(group.date)}
            />
            {!collapsedDays.has(group.date) &&
              group.items.map((s: any) => (
            <ScheduleCard
              key={s.schedule_id}
              s={s}
              cat1List={cat1List}
              cat2Map={cat2Map}
              cat3Map={cat3Map}
              payList={payList}
              toTimeString={toTimeString}
              onOpenEditor={openEditor}
              blurred={isBlurred(s, blurSets)}
              fixed={isFixed(s, fixSets)}
              onToggleFixed={toggleFixed}
              onTogglePerfExclude={togglePerfExclude}
            />
            ))}
          </section>
          ))}
        </div>
      )}

      {/* 편집 팝업 */}
      {draft && (
        <CardEditModal
          title="스케줄 편집"
          onClose={closeEditor}
          onSave={saveDraft}
          onDelete={() => handleDelete(draft.schedule_id)}
          deleteLabel="제거"
          /* 제거 바로 옆에 감추기를 둔다. 둘은 성격이 다르다 —
             제거는 되돌릴 수 없고, 감추기는 언제든 풀 수 있다. */
          footerAfterDelete={
            <button
              type="button"
              className={`set-hide-btn${draft.is_active === 0 ? " on" : ""}`}
              title={
                draft.is_active === 0
                  ? "다시 보이게 한다 — 다음 예정일을 새로 셈한다."
                  : "감춘다 — 목록에서 빠지고 더 오지 않는다."
              }
              onClick={toggleHidden}
            >
              {draft.is_active === 0 ? "감춤" : "감추기"}
            </button>
          }
          saveDisabled={isSaving}
          saveLabel={isSaving ? "저장 중..." : "저장"}
          headerFields={
            <>
              {/* 등록 팝업과 같은 짜임 — 주기와 시작이 첫 줄, 날과 시각이 둘째 줄이다. */}
              <EditField
                label="주기"
                span={String(draft.interval_months ?? 1) === "1" ? 12 : 6}
                required
              >
                <SingleSelect
                  noun="주기"
                  options={INTERVAL_OPTIONS.map((o) => ({ ...o }))}
                  selected={String(draft.interval_months ?? 1)}
                  onChange={(value) => {
                    setField("interval_months", Number(value));
                    // 매월로 되돌리면 첫 달은 볼 것이 없다. 격월 이상으로
                    // 올리면 박자를 정할 달이 있어야 하므로 이 달로 깐다.
                    setField("anchor_ym", value === "1" ? null : draft.anchor_ym || ymNow());
                  }}
                />
              </EditField>

              {String(draft.interval_months ?? 1) !== "1" && (
                <EditField label="시작" span={6} required>
                  <MonthPicker
                    value={draft.anchor_ym}
                    onChange={(ym) => setField("anchor_ym", ym)}
                    suffix="부터"
                    placeholder="(시작)"
                  />
                </EditField>
              )}

              <EditField
                label={intervalLabel(draft.interval_months)}
                span={6}
                required
              >
                <SingleSelect
                  noun="날짜"
                  options={dayOptions.map((d) => ({ value: String(d), label: dayLabel(d) }))}
                  selected={String(draft.day_of_month ?? "")}
                  onChange={(value) => setField("day_of_month", value ? Number(value) : null)}
                  placeholder="(일)"
                />
              </EditField>

              <EditField label="시간" span={6} required>
                <input
                  type="time"
                  value={draft.time || toTimeString(draft.hour, draft.minute)}
                  onChange={(e) => setField("time", e.target.value)}
                  step="300"
                />
              </EditField>
            </>
          }
        >
          <div className="edit-grid">
            {/* 1행 — 분류 3단 */}
            <EditField label="중분류" span={4} required>
              <SingleSelect
                noun="중분류"
                options={visible(cat1List, (c) => c.id === draft.cat1_id)
                  .map((c) => ({ value: String(c.id), label: c.name }))}
                selected={String(draft.cat1_id ?? "")}
                onChange={(value) => setField("cat1_id", value ? Number(value) : null)}
                placeholder="(중분류)"
              />
            </EditField>

            <EditField label="소분류" span={4} required>
              <SingleSelect
                noun="소분류"
                options={visible(cat2All, (c) => c.id === draft.cat2_id)
                  .filter((c) => c.cat1_id === draft.cat1_id)
                  .map((c) => ({ value: String(c.id), label: c.name }))}
                selected={String(draft.cat2_id ?? "")}
                onChange={(value) => setField("cat2_id", value ? Number(value) : null)}
                placeholder="(소분류)"
              />
            </EditField>

            <EditField label="세분류" span={4}>
              <SingleSelect
                noun="세분류"
                options={[
                  { value: "", label: "(세분류)" },
                  ...visible(cat3All, (c) => c.id === draft.cat3_id)
                    .filter((c) => c.cat2_id === draft.cat2_id)
                    .map((c) => ({ value: String(c.id), label: c.name })),
                ]}
                selected={String(draft.cat3_id ?? "")}
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

            <EditField label="결제 수단" span={4}>
              <SingleSelect
                noun="결제 수단"
                options={visible(payList, (p) => String(p.code) === String(draft.pay_method))
                  .map((p) => ({ value: p.code, label: p.name }))}
                selected={
                  draft.pay_method === null || draft.pay_method === undefined
                    ? ""
                    : String(draft.pay_method)
                }
                onChange={(value) => setField("pay_method", value ? Number(value) : null)}
                placeholder="(결제 수단)"
              />
            </EditField>

            <EditField label="금액" span={4} required>
              <input
                type="number"
                value={draft.amount ?? ""}
                onChange={(e) => setField("amount", e.target.value === "" ? null : Number(e.target.value))}
                className="amount-input"
                placeholder="(금액)"
              />
            </EditField>

            {/* 3행 — 휴일 처리 · 끝 · 한 번 건너뛰기.
                셋 다 "언제 오고 언제까지 오는가"를 말하므로 한 줄에 둔다.
                건너뛰기는 이미 있는 스케줄에만 뜻이 있어 등록 팝업에는 없다 —
                정기 결제는 대개 승인 며칠 전에 알림이 오므로, 그걸 보고
                다가오는 한 번만 넘기고 싶을 때 쓴다. */}
            <EditField label="휴일 처리" span={4} required>
              <SingleSelect
                noun="휴일 처리"
                options={HOLIDAY_OPTIONS.map((o) => ({ ...o }))}
                selected={draft.holiday_handling}
                onChange={(value) => setField("holiday_handling", value)}
              />
            </EditField>

            <EditField label="끝" span={4}>
              <MonthPicker
                value={draft.end_ym}
                onChange={(ym) => setField("end_ym", ym || null)}
                min={
                  Number(draft.interval_months ?? 1) === 1
                    ? ymNow()
                    : draft.anchor_ym || ymNow()
                }
                suffix="까지"
                placeholder="(없음)"
                clearable
              />
            </EditField>

            <EditField label="한 번 건너뛰기" span={4}>
              {/* 분류 화면의 고정 · 변동과 같은 스위치다. 켜진 전구가 건너뜀,
                  꺼진 전구가 그대로다. 켜면 온통 물들어, 카드에 서는 딱지와
                  같은 빛깔로 같은 것을 말한다. */}
              <span
                className={`set-fixed set-skip${draft.skip_ym ? " set-skip--on" : ""}`}
                role="group"
                aria-label="한 번 건너뛰기"
              >
                <button
                  type="button"
                  className={draft.skip_ym ? "on" : ""}
                  aria-pressed={!!draft.skip_ym}
                  title={
                    draft.skip_ym
                      ? `${ymLong(draft.skip_ym)}은 건너뛴다.`
                      : "다가오는 한 번만 건너뛴다."
                  }
                  onClick={() => setField("skip_ym", skipTarget(draft))}
                >
                  <BulbOnIcon />
                </button>
                <button
                  type="button"
                  className={draft.skip_ym ? "" : "on"}
                  aria-pressed={!draft.skip_ym}
                  title="건너뛰지 않고 그대로 온다."
                  onClick={() => setField("skip_ym", null)}
                >
                  <BulbOffIcon />
                </button>
              </span>
            </EditField>

            <EditField label="장소/가게" span={12}>
              <div className="edit-place">
                <span className="edit-place__name">
                  📍 {draftPlace?.place_name || draft.place_name || "—"}
                </span>
                <button
                  type="button"
                  className="ui-btn small"
                  onClick={() => setPlacePickerFor("draft")}
                >
                  변경
                </button>
              </div>
            </EditField>

            {/* 5행 — 메모 */}
            <EditField label="메모" span={12}>
              <GrowArea
                className="memo-input memo-area"
                value={draft.memo || ""}
                placeholder="(메모)"
                maxLength={200}
                onChange={(v) => setField("memo", v)}
              />
            </EditField>
          </div>

          {/* 금액 쪼개기 — 지출일 때만 의미가 있다.
              여기에 걸어 둔 분할은 스케줄이 돌 때마다 Pending으로 따라간다. */}
          {Number(draft.inout) === -1 && (
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
      <QuickActions />

      {/* 장소 선택 — 편집 팝업과 신규 등록 폼이 함께 쓴다. */}
      {placePickerFor && (
        <PlacePicker
          onSelect={(place) => {
            if (placePickerFor === "draft") {
              setDraftPlace(place);
              setDraft((prev: any) => prev && ({
                ...prev,
                place_id: place.place_id ?? prev.place_id,
                place_name: place.place_name,
              }));
            } else {
              setFormPlace(place);
              setFormPlaceName(place.place_name);
              setForm((f) => ({
                ...f,
                place_id: place.place_id ? String(place.place_id) : "",
              }));
            }
            setPlacePickerFor(null);
          }}
          onClose={() => setPlacePickerFor(null)}
        />
      )}
    </div>
  );
}

// ------------------------------------
// 스케줄 카드 한 장 — 표시 전용. 꾹 누르면 편집 팝업이 열린다.
// ------------------------------------
export function ScheduleCard({
  s,
  cat1List,
  cat2Map,
  cat3Map,
  payList,
  toTimeString,
  onOpenEditor,
  blurred,
  readOnly = false,
  onTogglePerfExclude,
  fixed,
  onToggleFixed,
}: {
  s: any;
  cat1List: { id: number; name: string }[];
  cat2Map: Record<number, CategoryL2Meta>;
  cat3Map: Record<number, CategoryL3Meta>;
  payList: { code: string; name: string; category?: string }[];
  toTimeString: (hour?: number, minute?: number) => string;
  onOpenEditor?: (schedule: any) => void;
  /* 카드 실적에서 뺄지를 켜고 끈다. 넘기지 않으면 기호가 보기 전용이 된다. */
  onTogglePerfExclude?: (schedule: PerfRow, next: boolean) => void;
  /* 이 건이 고정인지 — 건에 정해 둔 것이 없으면 분류를 따라 화면이 셈해서 넘긴다. */
  fixed?: boolean;
  /* 고정 · 변동을 뒤집는다. 넘기지 않으면 기호가 보기 전용이 된다. */
  onToggleFixed?: (schedule: FixedRow, next: boolean) => void;
  /* 중 · 소 · 세 어디에 Blur가 걸렸는지는 화면이 셈해서 넘긴다.
     넘기지 않으면 예전처럼 소분류만 본다. */
  blurred?: boolean;
  /* 보기만 하는 화면(기간 상세)에서는 꾹 눌러 편집하지 않는다.
     기본값은 지금까지와 같으므로 이 화면의 동작은 그대로다. */
  readOnly?: boolean;
}) {
  const openEditor = useCallback(() => onOpenEditor?.(s), [onOpenEditor, s]);
  const { pressing, handlers } = useLongPress(openEditor);
  const peel = usePeel(openEditor);

  const [revealed, setRevealed] = useState(false);
  const startReveal = useRevealDrag(setRevealed);
  /* 쪼갠 몫을 펼쳤는지. 카드마다 따로 기억한다. */
  const [splitOpen, setSplitOpen] = useState(false);

  const cat1 = cat1List.find((c) => c.id === s.cat1_id);
  const cat2Id = s.cat2_id !== null && s.cat2_id !== undefined ? Number(s.cat2_id) : null;
  const cat3Id = s.cat3_id !== null && s.cat3_id !== undefined ? Number(s.cat3_id) : null;
  const cat2Name = cat2Id !== null ? cat2Map[cat2Id]?.name : null;
  /* 소분류에 Blur가 걸려 있으면 금액을 테이프로 덮는다.
     끌면 잠깐 보이는 동작은 지출·대기 내역과 같다. */
  const isBlur = blurred ?? (cat2Id !== null && cat2Map[cat2Id]?.blur === 1);
  const cat3Name = cat3Id !== null ? cat3Map[cat3Id]?.name : null;
  const pay = payList.find((p) => p.code === String(s.pay_method));
  const holidayLabel =
    s.holiday_handling === "before" ? "휴일 전" : s.holiday_handling === "after" ? "휴일 후" : "당일";
  // 쪼갠 건은 실지출(net)을 대표 금액으로 삼는다. 분할이 없으면 net === amount다.
  const hasSplit = (s.split_count ?? 0) > 0;
  const shownAmount = hasSplit ? s.net_amount : s.amount;
  const amountDisplay =
    typeof shownAmount === "number" && !Number.isNaN(shownAmount)
      ? shownAmount.toLocaleString()
      : "-";
  const timeDisplay = hour12(s.time || toTimeString(s.hour, s.minute));

  /* 카드 셋째 줄에 설 딱지들.
     주기의 첫 달은 격월 이상일 때만 뜻이 있고, 매년은 몇 월인지를 이미
     둘째 줄의 "매년 6월 25일"이 말하고 있어 또 적지 않는다. */
  const spanChips: { key: string; text: string }[] = [];
  if (Number(s.interval_months ?? 1) > 1 && Number(s.interval_months) !== 12 && s.anchor_ym) {
    spanChips.push({ key: "from", text: `${ymLong(s.anchor_ym)}부터` });
  }
  if (s.end_ym) spanChips.push({ key: "till", text: `${ymLong(s.end_ym)}까지` });
  if (s.skip_ym) {
    spanChips.push({ key: "skip", text: `${ymLong(s.skip_ym)} 건너뜀` });
  }
  /* 감춘 것은 딱지 줄 오른쪽 끝에 `감춤`이 선다. 딱지가 하나도 없어도
     그 줄은 생겨야 하므로 여기서 따로 센다. */
  const hidden = s.is_active === 0;

  return (
    <div
      className={`card card--entry schedule-card card--pressable${readOnly ? " card--flat" : ""} ${pressing && !readOnly ? "pressing" : ""}`}
      {...(readOnly ? {} : handlers)}
      title={readOnly ? undefined : "꾹 눌러서 편집"}
    >
      {/* IN/OUT 표시 — 종이 왼쪽 위 귀퉁이를 접은 자국 */}
      <div
        className={`inout-bar ${s.inout === 1 ? "in-bar" : s.inout === -1 ? "out-bar" : ""}`}
      ></div>
      {/* 접은 자국을 잡는 자리와, 끌 때 비는 자리 · 접혀 넘어오는 조각.
          보기만 하는 화면(기간 상세)에서도 뗄 수 있다 — 거기서는 끝까지 떼어도
          열 팝업이 없으니 제자리로 펴져 붙기만 한다. */}
      <span className="peel-patch" aria-hidden="true" />
      <span className="peel-flap" aria-hidden="true">
        <span className="peel-flap__face" />
      </span>
      <span className="peel-grip" data-no-longpress aria-hidden="true" {...peel} />
      <div className="schedule-card__body">
        {/* 1행: 분류 + 금액 — 지출 · 대기 내역 카드와 같은 자리다.
            다음 예정일시는 위 날짜 단 머리말이 이미 말하고 있어 뺐다. */}
        <div className="entry-ln entry-ln--head">
          <span className="cat-display">
            <span className="cat-text">{cat1?.name || "-"}</span>
            <span className="cat-sep"> &gt; </span>
            <span className="cat-text">{cat2Name || "-"}</span>
            {cat3Name && (
              <>
                <span className="cat-sep"> &gt; </span>
                <span className="cat3-text">{cat3Name}</span>
              </>
            )}
          </span>

          <span
            className={`amount-text ${
              shownAmount === 0
                ? "zero"
                : s.inout === 1
                ? "schedule-card__amount-value--in"
                : "schedule-card__amount-value--out"
            } ${isBlur && !revealed ? "masked" : "revealed"}`}
            title={isBlur ? "끌면 잠깐 보인다." : undefined}
            onMouseDown={isBlur ? startReveal : undefined}
            onTouchStart={isBlur ? startReveal : undefined}
          >
            {amountDisplay}
          </span>
        </div>

        {/* 2행: 딱지 + 휴일 처리 + 결제 수단 — 지출 · 대기의 장소가 서던 자리다.
            언제 빠져나가는가 — 날과 시각은 한 가지 사실이라 한 딱지에 담고,
            휴일 처리도 같은 것을 말하므로 그 딱지 바로 오른쪽에 붙인다.
            결제 수단은 세 화면 모두 그렇듯 줄 오른쪽 끝에 선다.
            메모는 카드에서 빼내 바로 아래 제 판에 담는다(MemoPad). */}
        <div className="entry-ln">
          <span className="schedule-card__when">
            <span className="schedule-card__when-day">
              {whenLabel(s.interval_months, s.anchor_ym, s.day_of_month)}
            </span>
            <span className="schedule-card__when-cut" aria-hidden="true" />
            <span className="schedule-card__when-time">{timeDisplay}</span>
          </span>
          <span className="schedule-card__holiday">{holidayLabel}</span>
          {/* 달마다 같은 자리에 오는 돈인지. 건마다 뒤집을 수 있다. */}
          <FixedMark
            on={fixed ?? false}
            readOnly={readOnly || !onToggleFixed}
            onToggle={(next) => onToggleFixed?.(s, next)}
          />
          {/* 카드로 긋는 건에만 실적 제외 기호가 선다. */}
          {pay?.category === "카드" && (
            <PerfExcludeButton
              on={!!s.perf_exclude}
              readOnly={readOnly || !onTogglePerfExclude}
              onToggle={(next) => onTogglePerfExclude?.(s, next)}
            />
          )}
          <span className="pay-method-text">{pay?.name || "-"}</span>
        </div>

        {/* 3행: 주기가 매월이 아니거나 끝이 잡혀 있거나 감춘 카드에만 선다.
            매월 · 끝없음 · 안 감춘 카드는 적을 것이 없으므로 줄 자체가
            생기지 않는다 — 지금까지의 카드 높이가 그대로인 자리다. */}
        {(spanChips.length > 0 || hidden) && (
          <div className="entry-ln entry-ln--span">
            {spanChips.map((c) => (
              <span key={c.key} className={`schedule-card__span schedule-card__span--${c.key}`}>
                {c.text}
              </span>
            ))}
            {hidden && <span className="set-hide-mark">감춤</span>}
          </div>
        )}

        <MemoPad memo={s.memo} />

        {/* 쪼갠 건 — 카드 바닥에 붙는 칸. 누르면 그 아래로 함께한 사람과 몫이 펼쳐진다. */}
        {hasSplit && (
          <div className={`split-tab${splitOpen ? " open" : ""}`}>
            <span
              className={`amount-split ${isBlur && !revealed ? "masked" : "revealed"} is-toggle${splitOpen ? " open" : ""}`}
              role="button"
              tabIndex={0}
              data-no-longpress
              title={splitOpen ? "몫 접기" : "함께한 사람 보기"}
              onClick={(e) => { e.stopPropagation(); setSplitOpen((v) => !v); }}
            >
              {/* 뺄셈 한 덩어리 — "모두 펼치기|접기"와 같은 음영을 깔고 손잡이만 밖에 둔다. */}
              <span className="amount-split__calc">
                {s.amount.toLocaleString()}
                <span className="amount-split__op"> − </span>
                {s.split_amount.toLocaleString()}
              </span>
              <span className="amount-split__caret" aria-hidden="true">›</span>
            </span>
            {splitOpen && (
              <SplitRows base="/scheduled-entries" ownerId={s.schedule_id} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
