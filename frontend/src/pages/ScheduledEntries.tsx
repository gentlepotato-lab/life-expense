import PageHead from "./components/PageHead";
import { visible } from "../utils/visible";
import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "../api/client";
import useBackClose from "../hooks/useBackClose";
import SingleSelect from "./components/SingleSelect";
import CalculatorPopup from "./components/CalculatorPopup";
import CardEditModal, { EditField, EditDivider } from "./components/CardEditModal";
import SplitEditor from "./components/SplitEditor";
import type { SplitDraft } from "./components/SplitEditor";
import PlacePicker from "./components/PlacePicker";
import useLongPress from "../hooks/useLongPress";

type CategoryL2Meta = { id: number; name: string; cat1_id?: number; inout?: number | null; is_active?: number };
type CategoryL3Meta = { id: number; name: string; cat2_id?: number; is_active?: number };

interface Holiday {
  dt: string;
  is_holiday: number;
}

// Date를 YYYY-MM-DD 문자열로 변환 (로컬 시간대 기준)
function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 휴일이 아닌 가장 가까운 날짜 찾기 (Backend 로직과 동일)
function findNearestNonHoliday(
  targetDate: Date,
  holidayHandling: string,
  holidays: Holiday[]
): Date {
  // holidays 데이터가 없으면 그대로 반환
  if (holidays.length === 0) {
    console.warn('⚠️ Holidays data not loaded yet');
    return targetDate;
  }

  // UTC가 아닌 로컬 시간대 기준으로 날짜 문자열 생성
  const dateStr = formatDateLocal(targetDate);
  const holiday = holidays.find(h => h.dt === dateStr);
  
  console.log(`🔍 Checking ${dateStr}:`, {
    targetDate: targetDate.toString(),
    found: !!holiday,
    is_holiday: holiday?.is_holiday,
    holidayHandling,
    totalHolidays: holidays.length
  });
  
  // 휴일 여부 확인: holiday가 없거나 is_holiday === 0이면 평일
  const isHoliday = holiday && holiday.is_holiday === 1;
  
  if (!isHoliday) {
    // 평일이면 그대로 반환
    console.log(`✅ ${dateStr} is a weekday (not a holiday)`);
    return targetDate;
  }
  
  console.log(`🚫 ${dateStr} is a holiday, finding nearest non-holiday...`);
  
  // 휴일인 경우
  if (holidayHandling === 'on') {
    // 당일 처리 (휴일이어도 그대로)
    return targetDate;
  } else if (holidayHandling === 'before') {
    // 휴일 전 가장 가까운 평일 찾기
    let current = new Date(targetDate);
    for (let i = 0; i < 30; i++) {
      current.setDate(current.getDate() - 1);
      const currentStr = formatDateLocal(current);
      const h = holidays.find(hol => hol.dt === currentStr);
      console.log(`  Checking before: ${currentStr}, found: ${!!h}, is_holiday: ${h?.is_holiday}`);
      // h가 있고 is_holiday === 0이면 평일
      if (h && h.is_holiday === 0) {
        console.log(`  ✅ Found weekday: ${currentStr}`);
        return current;
      }
    }
    console.warn(`  ⚠️ Could not find weekday before ${dateStr}`);
    return targetDate; // 못 찾으면 원래 날짜 반환
  } else { // 'after'
    // 휴일 후 가장 가까운 평일 찾기
    let current = new Date(targetDate);
    for (let i = 0; i < 30; i++) {
      current.setDate(current.getDate() + 1);
      const currentStr = formatDateLocal(current);
      const h = holidays.find(hol => hol.dt === currentStr);
      console.log(`  Checking after: ${currentStr}, found: ${!!h}, is_holiday: ${h?.is_holiday}`);
      // h가 있고 is_holiday === 0이면 평일
      if (h && h.is_holiday === 0) {
        console.log(`  ✅ Found weekday: ${currentStr}`);
        return current;
      }
    }
    console.warn(`  ⚠️ Could not find weekday after ${dateStr}`);
    return targetDate; // 못 찾으면 원래 날짜 반환
  }
}

// 다음 실행 예정일 계산 함수 (holiday_handling 반영)
function calculateNextRun(
  dayOfMonth: number,
  time: string,
  holidayHandling: string,
  holidays: Holiday[]
): string {
  const now = new Date();
  const [hours, minutes] = time.split(":").map(Number);
  
  console.log(`\n📅 calculateNextRun START: day=${dayOfMonth}, time=${time}, handling=${holidayHandling}`);
  console.log(`⏰ Current time: ${now.toString()}`);
  
  // 이번 달 예정일
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), dayOfMonth, hours, minutes);
  
  // 다음 달 예정일
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth, hours, minutes);
  
  console.log(`📌 thisMonth: ${thisMonth.toString()}, thisMonth > now: ${thisMonth > now}`);
  console.log(`📌 nextMonth: ${nextMonth.toString()}`);
  
  // 이번 달 예정일이 아직 지나지 않았으면 이번 달, 지났으면 다음 달
  let targetDate = thisMonth > now ? thisMonth : nextMonth;
  console.log(`🎯 Initial targetDate: ${targetDate.toString()}`);
  
  // holiday_handling 적용
  const beforeHoliday = new Date(targetDate);
  targetDate = findNearestNonHoliday(targetDate, holidayHandling, holidays);
  console.log(`🏖️ After holiday handling: ${beforeHoliday.toString()} → ${targetDate.toString()}`);
  
  // 휴일 처리 후 날짜가 현재 시간보다 과거가 되었다면 다음 달로 이동
  if (targetDate <= now) {
    console.log(`⚠️ targetDate is in the past, moving to next month...`);
    // 다음 달 예정일을 다시 계산
    const nextMonthBase = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth, hours, minutes);
    console.log(`📌 nextMonthBase: ${nextMonthBase.toString()}`);
    targetDate = findNearestNonHoliday(nextMonthBase, holidayHandling, holidays);
    console.log(`🎯 Final targetDate after next month: ${targetDate.toString()}`);
  }
  
  // 포맷: 2025-12-10 10:00 a.m.
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, "0");
  const day = String(targetDate.getDate()).padStart(2, "0");
  const hour = targetDate.getHours();
  const minute = String(targetDate.getMinutes()).padStart(2, "0");
  const ampm = hour >= 12 ? "p.m." : "a.m.";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  
  const result = `${year}-${month}-${day} ${displayHour}:${minute} ${ampm}`;
  console.log(`✅ calculateNextRun RESULT: ${result}\n`);
  
  return result;
}

// 다음 실행 예정일을 Date 객체로 반환 (정렬용)
function calculateNextRunDate(
  dayOfMonth: number,
  time: string,
  holidayHandling: string,
  holidays: Holiday[]
): Date {
  const now = new Date();
  const [hours, minutes] = time.split(":").map(Number);
  
  // 이번 달 예정일
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), dayOfMonth, hours, minutes);
  
  // 다음 달 예정일
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth, hours, minutes);
  
  // 이번 달 예정일이 아직 지나지 않았으면 이번 달, 지났으면 다음 달
  let targetDate = thisMonth > now ? thisMonth : nextMonth;
  
  // holiday_handling 적용
  targetDate = findNearestNonHoliday(targetDate, holidayHandling, holidays);
  
  // 휴일 처리 후 날짜가 현재 시간보다 과거가 되었다면 다음 달로 이동
  if (targetDate <= now) {
    const nextMonthBase = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth, hours, minutes);
    targetDate = findNearestNonHoliday(nextMonthBase, holidayHandling, holidays);
  }
  
  return targetDate;
}

export default function ScheduledEntries() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);  // 폼 표시 여부
  const [form, setForm] = useState({
    day_of_month: "",
    time: "",
    holiday_handling: "on",
    cat1_id: "",
    cat2_id: "",
    cat3_id: "",
    inout: "-1",
    amount: "",
    pay_method: "",
    memo: "",
    place_id: "",
  });

  const [cat1List, setCat1List] = useState<{ id: number; name: string; is_active?: number }[]>([]);
  const [cat2List, setCat2List] = useState<{ id: number; name: string; inout: number | null; is_active?: number }[]>([]);
  const [cat3List, setCat3List] = useState<{ id: number; name: string; is_active?: number }[]>([]);
  const [cat2All, setCat2All] = useState<CategoryL2Meta[]>([]);
  const [cat3All, setCat3All] = useState<CategoryL3Meta[]>([]);
  const [payList, setPayList] = useState<{ code: string; name: string; is_active?: number }[]>([]);
  const [cat2Map, setCat2Map] = useState<Record<number, CategoryL2Meta>>({});
  const [cat3Map, setCat3Map] = useState<Record<number, CategoryL3Meta>>({});
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  // 편집 팝업 상태 — 카드를 꾹 누르면 열린다
  const [draft, setDraft] = useState<any | null>(null);
  const [splits, setSplits] = useState<SplitDraft[]>([]);

  // 장소 선택 — 편집 팝업(draft)과 신규 등록 폼(form) 중 어디에 반영할지
  const [placePickerFor, setPlacePickerFor] = useState<"draft" | "form" | null>(null);

  /* 뒤로 가기 · Backspace 로 지금 열린 것만 닫는다 */
  useBackClose(showForm, () => setShowForm(false));
  useBackClose(placePickerFor !== null, () => setPlacePickerFor(null));
  // 아직 DB 에 없는 카카오 장소는 저장 직전에 등록해야 하므로 원본을 들고 있는다
  const [draftPlace, setDraftPlace] = useState<any | null>(null);
  const [formPlace, setFormPlace] = useState<any | null>(null);
  const [formPlaceName, setFormPlaceName] = useState("");

  // 팝업 열림/닫힘 시 배경 스크롤 제어
  useEffect(() => {
    if (showForm || calculatorOpen || draft || placePickerFor) {
      document.documentElement.classList.add("modal-open");
      // showForm일 때만 pointerEvents 설정 (calculatorOpen은 CalculatorPopup에서 처리)
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
  }, [showForm, calculatorOpen, draft, placePickerFor]);

  /**
   * 저장 직전에 place_id 를 확정한다.
   * 새로 고른 카카오 장소는 아직 DB 에 없으므로 먼저 등록하고 발급된 id 를 쓴다.
   * (백엔드가 kakao_id 로 중복을 걸러 준다)
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

  // 휴일 데이터 로드
  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;

    console.log(`\n📅 ========== LOADING HOLIDAYS ==========`);
    console.log(`📅 Requesting: ${currentYear}-${String(currentMonth).padStart(2, '0')} and ${nextYear}-${String(nextMonth).padStart(2, '0')}`);

    // 이번 달과 다음 달의 휴일 데이터 가져오기
    Promise.all([
      axios.get(`/holidays?year=${currentYear}&month=${currentMonth}`),
      axios.get(`/holidays?year=${nextYear}&month=${nextMonth}`)
    ]).then(([current, next]) => {
      const allHolidays = [...current.data, ...next.data];
      console.log(`✅ Loaded holidays: ${allHolidays.length} records total`);
      console.log(`  - ${currentYear}-${String(currentMonth).padStart(2, '0')}: ${current.data.length} records`);
      console.log(`  - ${nextYear}-${String(nextMonth).padStart(2, '0')}: ${next.data.length} records`);
      
      // 12월 13, 14, 15일 데이터 상세 확인
      ['2025-12-12', '2025-12-13', '2025-12-14', '2025-12-15'].forEach(dt => {
        const h = allHolidays.find((item: any) => item.dt === dt);
        if (h) {
          console.log(`  📆 ${dt}: is_holiday=${h.is_holiday}, weekday=${h.weekday}, name=${h.holiday_name || 'none'}`);
        } else {
          console.warn(`  ⚠️ ${dt}: NOT FOUND`);
        }
      });
      
      // 1월 13일도 확인
      const jan13 = allHolidays.find((h: any) => h.dt === '2026-01-13');
      if (jan13) {
        console.log(`  📆 2026-01-13: is_holiday=${jan13.is_holiday}, weekday=${jan13.weekday}`);
      }
      
      console.log(`========================================\n`);
      
      setHolidays(allHolidays);
    }).catch(err => {
      console.error("❌ 휴일 데이터 로드 실패:", err);
    });
  }, []);

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

  // 스케줄 목록 로드
  const loadSchedules = async () => {
    try {
      const res = await axios.get("/scheduled-entries");
      const data = Array.isArray(res.data) ? res.data : [];
      setSchedules(data.map(decorateSchedule));
    } catch (err) {
      console.error("스케줄 로드 실패...\n:", err);
      setSchedules([]);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  // ------------------------------------
  // 편집 팝업
  // ------------------------------------

  const openEditor = useCallback((schedule: any) => {
    setDraft({ ...schedule });
    setDraftPlace(null);          // 이번 편집에서 새로 고른 장소만 추적한다
    // 분할은 목록 조회에 합계만 실려 오므로, 편집할 때 상세를 따로 가져온다
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

  // IN/OUT 전환 (소분류 선택 시 자동 설정되므로 비활성화)
  // const toggleScheduleInOut = (scheduleId: number) => {
  //   mutateSchedule(scheduleId, (item) => ({
  //     ...item,
  //     inout: item.inout === 1 ? -1 : 1,
  //   }));
  // };

  // Next 날짜 기준으로 정렬된 schedules
  const sortedSchedules = useMemo(() => {
    if (schedules.length === 0 || holidays.length === 0) {
      return schedules;
    }

    return [...schedules].sort((a, b) => {
      const timeA = a.time || toTimeString(a.hour, a.minute);
      const timeB = b.time || toTimeString(b.hour, b.minute);
      
      // day_of_month와 time이 없으면 맨 뒤로
      if (!a.day_of_month || !timeA) return 1;
      if (!b.day_of_month || !timeB) return -1;

      try {
        const dateA = calculateNextRunDate(
          a.day_of_month,
          timeA,
          a.holiday_handling || "on",
          holidays
        );
        const dateB = calculateNextRunDate(
          b.day_of_month,
          timeB,
          b.holiday_handling || "on",
          holidays
        );
        return dateA.getTime() - dateB.getTime();
      } catch (err) {
        console.error("정렬 중 오류:", err);
        return 0;
      }
    });
  }, [schedules, holidays]);

  const buildSchedulePayload = (schedule: any) => {
    const [hour, minute] = (schedule.time || "00:00").split(":").map(Number);

    return {
      day_of_month: Number(schedule.day_of_month),
      hour,
      minute,
      holiday_handling: schedule.holiday_handling,
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

  // 팝업에서 저장 — 해당 스케줄만 반영한다
  const saveDraft = async () => {
    if (!draft) return;

    if (!validateSchedule(draft)) {
      alert("모든 필수 항목(일자, 시간, 카테고리, 금액, 결제 수단)을 입력하세요.");
      return;
    }

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
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    // time 문자열을 시/분으로 분리 (HH:MM → hour, minute)
    const [hour, minute] = form.time.split(":").map(Number);

    try {
      const placeId = await ensurePlaceId(formPlace, form.place_id);

      await axios.post("/scheduled-entries", {
        day_of_month: Number(form.day_of_month),
        hour: hour,
        minute: minute,
        holiday_handling: form.holiday_handling,
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

      alert("스케줄이 등록되었습니다.");
      loadSchedules();
      setFormPlace(null);
      setFormPlaceName("");

      // 폼 초기화 및 숨기기
      setForm({
        day_of_month: "",
        time: "",
        holiday_handling: "on",
        cat1_id: "",
        cat2_id: "",
        cat3_id: "",
        inout: "-1",
        amount: "",
        pay_method: "",
        memo: "",
        place_id: "",
      });
      setCat2List([]);
      setShowForm(false);
    } catch (err: any) {
      console.error(err);
      alert("등록 중 오류가 발생했습니다.\n" + (err.response?.data?.detail || err.message));
    }
  };

  const handleDelete = async (scheduleId: number) => {
    if (!confirm("이 스케줄을 삭제하시겠습니까?")) return;

    try {
      await axios.delete(`/scheduled-entries/${scheduleId}`);
      closeEditor();
      alert("삭제되었습니다.");
      await loadSchedules();
    } catch (err) {
      console.error(err);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  // 일 선택 옵션 생성 (1-31)
  const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="page-wrap">
      <PageHead />

      {/* New & Save 툴바 */}
      {/* 툴바 껍데기는 쓴 내역 · 대기 내역과 같은 것을 쓴다.
          화면을 옮겨 다녀도 첫 줄이 같은 높이에서 시작해야 한다. */}
      <div className="toolbar-wrap">
        <div className="toolbar">
          <div className="toolbar-btns">
            <button
              onClick={() => setShowForm(!showForm)}
              className="ui-btn primary scheduled-toolbar__btn scheduled-toolbar__btn--new"
            >
              [+] 새 정기 결제
            </button>
          </div>
        </div>
      </div>

      {/* 등록 폼 팝업 */}
      {showForm && (
        <div className="popup-overlay" onClick={() => {
          setShowForm(false);
          // 폼 닫을 때 초기화
          setForm({
            day_of_month: "",
            time: "",
            holiday_handling: "on",
            cat1_id: "",
            cat2_id: "",
            cat3_id: "",
            inout: "-1",
            amount: "",
            pay_method: "",
            memo: "",
            place_id: "",
          });
          setCat2List([]);
        }}>
          <div className="popup-panel" onClick={(e) => e.stopPropagation()}>
            <h3>스케줄</h3>
            
            <form onSubmit={handleSubmit}>
              {/* 매월 일 + 시간 */}
              <div className="flex gap-2" style={{marginBottom: '6px', marginTop: '4px'}}>
                <div className="form-row" style={{flex: 1, marginBottom: 0}}>
                  <label className="form-label required">매월</label>
                  <SingleSelect
                    options={dayOptions.map(d => ({ value: String(d), label: `${d}일` }))}
                    selected={form.day_of_month}
                    onChange={(value) => setForm({ ...form, day_of_month: value })}
                    placeholder="(일)"
                  />
                </div>
                <div className="form-row" style={{flex: 1, marginBottom: 0}}>
                  <label className="form-label required">시간</label>
                  <input
                    type="time"
                    name="time"
                    value={form.time}
                    onChange={handleChange}
                    className="ui-input"
                    step="300"
                    required
                  />
                </div>
              </div>

              {/* 휴일 처리 | 중분류 */}
              <div className="flex gap-2" style={{marginBottom: '6px'}}>
                <div className="form-row" style={{flex: 1, marginBottom: 0}}>
                  <label className="form-label required">휴일 처리</label>
                  <SingleSelect
                    options={[
                      { value: "before", label: "휴일 전" },
                      { value: "on", label: "당일" },
                      { value: "after", label: "휴일 후" }
                    ]}
                    selected={form.holiday_handling}
                    onChange={(value) => setForm({ ...form, holiday_handling: value as "before" | "on" | "after" })}
                    placeholder="(휴일 처리)"
                  />
                </div>
                <div className="form-row" style={{flex: 1, marginBottom: 0}}>
                  <label className="form-label required">중분류</label>
                  <SingleSelect
                    options={visible(cat1List, (c) => String(c.id) === form.cat1_id)
                      .map(c => ({ value: String(c.id), label: c.name }))}
                    selected={form.cat1_id}
                    onChange={(value) => setForm({ ...form, cat1_id: value })}
                    placeholder="(중분류)"
                  />
                </div>
              </div>

              {/* 소분류 | 세분류 */}
              <div className="flex gap-2" style={{marginBottom: '6px'}}>
                <div className="form-row" style={{flex: 1, marginBottom: 0}}>
                  <label className="form-label required">소분류</label>
                  <SingleSelect
                    options={visible(cat2List, (c) => String(c.id) === form.cat2_id)
                      .map(c => ({ value: String(c.id), label: c.name }))}
                    selected={form.cat2_id}
                    onChange={(value) => setForm({ ...form, cat2_id: value })}
                    placeholder="(소분류)"
                  />
                </div>
                <div className="form-row" style={{flex: 1, marginBottom: 0}}>
                  <label className="form-label">세분류</label>
                  <SingleSelect
                    options={visible(cat3List, (c) => String(c.id) === form.cat3_id)
                      .map(c => ({ value: String(c.id), label: c.name }))}
                    selected={form.cat3_id}
                    onChange={(value) => setForm({ ...form, cat3_id: value })}
                    placeholder="(세분류)"
                  />
                </div>
              </div>

              {/* IN/OUT | 결제 수단 */}
              <div className="flex gap-2" style={{marginBottom: '6px'}}>
                <div className="form-row" style={{flex: 1, marginBottom: 0}}>
                  <label className="form-label required">IN/OUT</label>
                  <div className="ui-input" style={{ display: 'flex', alignItems: 'center', padding: '0 10px', height: '36px', background: 'var(--color-bg)', cursor: 'not-allowed' }}>
                    {form.inout === "1" ? "IN(+)" : form.inout === "-1" ? "OUT(-)" : "—"}
                  </div>
                </div>
                <div className="form-row" style={{flex: 1, marginBottom: 0}}>
                  <label className="form-label required">결제 수단</label>
                  <SingleSelect
                    options={visible(payList, (p) => p.code === form.pay_method)
                      .map(p => ({ value: p.code, label: p.name }))}
                    selected={form.pay_method}
                    onChange={(value) => setForm({ ...form, pay_method: value })}
                    placeholder="(결제 수단)"
                  />
                </div>
              </div>

              {/* 금액 */}
              <div className="form-row" style={{marginBottom: '16px'}}>
                <label className="form-label required">금액</label>
                <input
                  type="number"
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                  className="ui-input"
                  required
                  placeholder="(금액)"
                />
              </div>

              {/* 장소/가게 */}
              <div className="form-row" style={{marginBottom: '6px'}}>
                <label className="form-label">장소/가게</label>
                <div className="edit-place">
                  <span className="edit-place__name">
                    📍 {formPlaceName || "—"}
                  </span>
                  <button
                    type="button"
                    className="ui-btn small"
                    onClick={() => setPlacePickerFor("form")}
                  >
                    검색
                  </button>
                </div>
              </div>

              {/* 메모 */}
              <div className="form-row" style={{marginBottom: '16px'}}>
                <label className="form-label">메모</label>
                <input
                  type="text"
                  name="memo"
                  value={form.memo}
                  onChange={handleChange}
                  className="ui-input"
                  placeholder="(메모)"
                />
              </div>

              <button type="submit" className="ui-btn primary w-full">
                등록
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 등록된 스케줄 목록 */}
      {schedules.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-2">등록된 스케줄이 없습니다.</p>
          <p className="text-sm text-gray-400">위의 "[+] 새로운 스케줄" 버튼을 눌러 스케줄을 등록하세요.</p>
        </div>
      ) : (
        <div className="scheduled-card-list">
          {sortedSchedules.map((s) => (
            <ScheduleCard
              key={s.schedule_id}
              s={s}
              cat1List={cat1List}
              cat2Map={cat2Map}
              cat3Map={cat3Map}
              payList={payList}
              holidays={holidays}
              toTimeString={toTimeString}
              onOpenEditor={openEditor}
            />
          ))}
        </div>
      )}

      {/* 편집 팝업 */}
      {draft && (
        <CardEditModal
          title="스케줄 편집"
          subtitle={`매월 ${draft.day_of_month ?? "-"}일 ${draft.time || toTimeString(draft.hour, draft.minute)}`}
          onClose={closeEditor}
          onSave={saveDraft}
          onDelete={() => handleDelete(draft.schedule_id)}
          saveDisabled={isSaving}
          saveLabel={isSaving ? "저장 중..." : "저장"}
          headerFields={
            <>
              <EditField label="매월" span={6}>
                <SingleSelect
                  options={dayOptions.map((d) => ({ value: String(d), label: `${d}일` }))}
                  selected={String(draft.day_of_month ?? "")}
                  onChange={(value) => setField("day_of_month", value ? Number(value) : null)}
                  placeholder="(일)"
                />
              </EditField>

              <EditField label="시간" span={6}>
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
            <EditField label="중분류" span={4}>
              <SingleSelect
                options={visible(cat1List, (c) => c.id === draft.cat1_id)
                  .map((c) => ({ value: String(c.id), label: c.name }))}
                selected={String(draft.cat1_id ?? "")}
                onChange={(value) => setField("cat1_id", value ? Number(value) : null)}
                placeholder="(중분류)"
              />
            </EditField>

            <EditField label="소분류" span={4}>
              <SingleSelect
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

            {/* 2행 — 거래 속성. IN/OUT 은 소분류가 결정하므로 분류 바로 아래에 둔다 */}
            <EditField label="IN/OUT" span={4}>
              <span className={`inout-chip ${draft.inout === 1 ? "in" : draft.inout === -1 ? "out" : ""}`}>
                {draft.inout === 1 ? "IN(+)" : draft.inout === -1 ? "OUT(−)" : "—"}
              </span>
            </EditField>

            <EditField label="결제 수단" span={4}>
              <SingleSelect
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

            <EditField label="금액" span={4}>
              <input
                type="number"
                value={draft.amount ?? ""}
                onChange={(e) => setField("amount", e.target.value === "" ? null : Number(e.target.value))}
                className="amount-input"
                placeholder="(금액)"
              />
            </EditField>

            {/* 3행 — 휴일 처리 + 장소 */}
            <EditField label="휴일 처리" span={4}>
              <SingleSelect
                options={[
                  { value: "before", label: "휴일 전" },
                  { value: "on", label: "당일" },
                  { value: "after", label: "휴일 후" },
                ]}
                selected={draft.holiday_handling}
                onChange={(value) => setField("holiday_handling", value)}
                placeholder="(휴일 처리)"
              />
            </EditField>

            <EditField label="장소/가게" span={8}>
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
              <input
                type="text"
                value={draft.memo || ""}
                onChange={(e) => setField("memo", e.target.value)}
                className="memo-input"
                placeholder="(메모)"
              />
            </EditField>
          </div>

          {/* 금액 쪼개기 — 지출일 때만 의미가 있다.
              여기에 걸어 둔 분할은 스케줄이 돌 때마다 Pending 으로 따라간다. */}
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

      {/* 장소 선택 — 편집 팝업과 신규 등록 폼이 함께 쓴다 */}
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
// 스케줄 카드 한 장 — 표시 전용. 꾹 누르면 편집 팝업이 열린다
// ------------------------------------
function ScheduleCard({
  s,
  cat1List,
  cat2Map,
  cat3Map,
  payList,
  holidays,
  toTimeString,
  onOpenEditor,
}: {
  s: any;
  cat1List: { id: number; name: string }[];
  cat2Map: Record<number, CategoryL2Meta>;
  cat3Map: Record<number, CategoryL3Meta>;
  payList: { code: string; name: string }[];
  holidays: Holiday[];
  toTimeString: (hour?: number, minute?: number) => string;
  onOpenEditor: (schedule: any) => void;
}) {
  const openEditor = useCallback(() => onOpenEditor(s), [onOpenEditor, s]);
  const { pressing, handlers } = useLongPress(openEditor);

  const cat1 = cat1List.find((c) => c.id === s.cat1_id);
  const cat2Id = s.cat2_id !== null && s.cat2_id !== undefined ? Number(s.cat2_id) : null;
  const cat3Id = s.cat3_id !== null && s.cat3_id !== undefined ? Number(s.cat3_id) : null;
  const cat2Name = cat2Id !== null ? cat2Map[cat2Id]?.name : null;
  const cat3Name = cat3Id !== null ? cat3Map[cat3Id]?.name : null;
  const pay = payList.find((p) => p.code === String(s.pay_method));
  const holidayLabel =
    s.holiday_handling === "before" ? "휴일 전" : s.holiday_handling === "after" ? "휴일 후" : "당일";
  // 쪼갠 건은 실지출(net)을 대표 금액으로 삼는다. 분할이 없으면 net === amount 다.
  const hasSplit = (s.split_count ?? 0) > 0;
  const shownAmount = hasSplit ? s.net_amount : s.amount;
  const amountDisplay =
    typeof shownAmount === "number" && !Number.isNaN(shownAmount)
      ? shownAmount.toLocaleString()
      : "-";
  const timeDisplay = s.time || toTimeString(s.hour, s.minute);

  return (
    <div
      className={`card schedule-card card--pressable ${pressing ? "pressing" : ""}`}
      {...handlers}
      title="꾹 눌러서 편집"
    >
      <div
        className={`inout-bar ${s.inout === 1 ? "in-bar" : s.inout === -1 ? "out-bar" : ""}`}
      ></div>
      <div className="schedule-card__body">
        <div className="schedule-card__row schedule-card__row--header">
          <div className="schedule-card__date-block">
            <div className="schedule-card__date-line">
              <span className="schedule-card__month">매월 {s.day_of_month}일</span>
              <span className="schedule-card__time">{timeDisplay}</span>
            </div>
            {s.day_of_month && timeDisplay && (
              <div className="schedule-card__next-run">
                Next: {calculateNextRun(s.day_of_month, timeDisplay, s.holiday_handling, holidays)}
              </div>
            )}
          </div>
        </div>

        {/* 카테고리 행 */}
        <div className="row-category">
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
        </div>

        {/* 결제 수단 + 금액 행 */}
        <div className="row-payment">
          <span className="pay-method-text">{pay?.name || "-"}</span>

          {/* 쪼갠 건은 큰 금액을 실지출로 보여 주고, 원래 결제액은 그 위에 작게 남긴다 */}
          <span className="amount-stack">
            {hasSplit && (
              <span className="amount-split">
                {s.amount.toLocaleString()}
                <span className="amount-split__op"> − </span>
                {s.split_amount.toLocaleString()}
              </span>
            )}
            <span
              className={`amount-text ${
                s.inout === 1 ? "schedule-card__amount-value--in" : "schedule-card__amount-value--out"
              }`}
            >
              {amountDisplay}
            </span>
          </span>
        </div>

        <div className="schedule-card__row schedule-card__row--meta-single">
          <div className="schedule-card__label">휴일 처리</div>
          <span className="schedule-card__meta-value">{holidayLabel}</span>
        </div>

        <div className="schedule-card__row schedule-card__row--meta-single">
          <div className="schedule-card__label">메모</div>
          <span
            className={`schedule-card__meta-value ${
              s.memo ? "" : "schedule-card__meta-value--placeholder"
            }`}
          >
            {s.memo || "-"}
          </span>
        </div>
      </div>
    </div>
  );
}
