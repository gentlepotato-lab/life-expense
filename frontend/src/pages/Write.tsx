import { visible } from "../utils/visible";
import React, { useEffect, useState } from "react";
import axios from "../api/client";
import useBackClose from "../hooks/useBackClose";
import SingleSelect from "./components/SingleSelect";
import CalculatorPopup from "./components/CalculatorPopup";
import { EditField } from "./components/CardEditModal";
import PlacePicker from "./components/PlacePicker";

export default function Write() {
  const [form, setForm] = useState({
    tx_date: "",
    cat1_id: "",
    cat2_id: "",
    cat3_id: "",
    inout: "-1",
    amount: "",
    pay_method: "",
    memo: "",
    place_id: ""
  });

  const [cat1List, setCat1List] = useState<{ id: number; name: string; is_active?: number }[]>([]);
  const [cat2List, setCat2List] = useState<{ id: number; name: string; inout: number | null; is_active?: number }[]>([]);
  const [cat3List, setCat3List] = useState<{ id: number; name: string; is_active?: number }[]>([]);
  const [payList, setPayList] = useState<{ code: string; name: string; is_active?: number }[]>([]);

  const [showPlacePicker, setShowPlacePicker] = useState(false);

  /* 뒤로 가기 · Backspace 로 장소 고르기를 닫는다 */
  useBackClose(showPlacePicker, () => setShowPlacePicker(false));
  const [selectedPlaceName, setSelectedPlaceName] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  
  const [isDirty, setIsDirty] = useState(false);

  // 중분류(카테고리1) 불러오기
  useEffect(() => {
    axios.get("/categories/lvl1").then((res) => setCat1List(res.data));
  }, []);

  // 소분류(카테고리2) 불러오기 → cat1_id 변경 시
  useEffect(() => {
    if (!form.cat1_id) return;
    axios
      .get("/categories/lvl2", { params: { cat1_id: form.cat1_id } })
      .then((res) => setCat2List(res.data));
  }, [form.cat1_id]);

  // 소분류 선택 시 IN/OUT 자동 설정
  useEffect(() => {
    if (form.cat2_id) {
      const selectedCat2 = cat2List.find(c => String(c.id) === form.cat2_id);
      if (selectedCat2 && selectedCat2.inout !== null) {
        setForm(f => ({ ...f, inout: String(selectedCat2.inout) }));
        setIsDirty(true);
      }
    }
  }, [form.cat2_id, cat2List]);

  // 세분류(카테고리3) 불러오기 → cat2_id 변경 시
  useEffect(() => {
    if (!form.cat2_id) {
      setCat3List([]);
      setForm(f => ({ ...f, cat3_id: "", place_id: "" }));
      return;
    }
    axios
      .get("/categories/lvl3", { params: { cat2_id: form.cat2_id } })
      .then((res) => setCat3List(res.data));
  }, [form.cat2_id]);

  // 결제 수단 불러오기
  useEffect(() => {
    axios.get("/payment-methods").then((res) =>
      setPayList(
        res.data.map((p: any) => ({
          code: String(p.method_id),
          name: p.method_name,
          is_active: p.is_active,
        }))
      )
    );
  }, []);

  // 계산기 팝업 열렸을 때 뒤 화면 스크롤/인터랙션 막기
  useEffect(() => {
    if (calculatorOpen) {
      document.documentElement.classList.add("modal-open");
    } else {
      document.documentElement.classList.remove("modal-open");
    }
  }, [calculatorOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setIsDirty(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !form.tx_date ||
      !form.cat1_id ||
      !form.cat2_id ||
      form.amount == null || form.amount === '' ||
      !form.pay_method
    ) {
      alert("Date, CategoryM/S, Amount, PaymentMethod는 필수 입력입니다.");
      return;
    }

    try {
      let place_id = form.place_id ? Number(form.place_id) : null;

      // 새 장소인 경우 → DB에 아직 없음
      if (!place_id && selectedPlace && !selectedPlace.place_id) {
        // 새로 등록(백엔드에서 kakao_id로 중복 검사)
        const res = await axios.post("/places", {
          place_name: selectedPlace.place_name,
          lat: selectedPlace.lat,
          lng: selectedPlace.lng,
          address_name: selectedPlace.address_name,
          kakao_id: selectedPlace.kakao_id,
          road_address_name: selectedPlace.road_address_name,
          phone: selectedPlace.phone,
          category_name: selectedPlace.category_name,
          category_group_code: selectedPlace.category_group_code,
          category_group_name: selectedPlace.category_group_name,
          place_url: selectedPlace.place_url,
        });
        place_id = res.data.place_id;
      }

      const payload = [
        {
          tx_date: form.tx_date,
          cat1_id: Number(form.cat1_id),
          cat2_id: Number(form.cat2_id),
          cat3_id: form.cat3_id ? Number(form.cat3_id) : null,
          inout: Number(form.inout),
          amount: Number(form.amount),
          pay_method: form.pay_method,
          memo: form.memo,

          place_id: place_id,

          // Kakao 신규 장소(place_id 없을 경우...)를 위해서 추가 전달
          place_name: selectedPlace?.place_name ?? null,
          place_lat: selectedPlace?.lat ?? null,
          place_lng: selectedPlace?.lng ?? null,
          kakao_id: selectedPlace?.kakao_id ?? null,
          address_name: selectedPlace?.address_name ?? null,
          road_address_name: selectedPlace?.road_address_name ?? null,
          phone: selectedPlace?.phone ?? null,
          category_name: selectedPlace?.category_name ?? null,
          category_group_code: selectedPlace?.category_group_code ?? null,
          category_group_name: selectedPlace?.category_group_name ?? null,
          place_url: selectedPlace?.place_url ?? null,
        },
      ];

      await axios.post("/entries", payload);
      alert("전송 완료-!! ;-)");

      // 초기화
      setForm({
        tx_date: "",
        cat1_id: "",
        cat2_id: "",
        cat3_id: "",
        inout: "-1",
        amount: "",
        pay_method: "",
        memo: "",
        place_id: "",
      });
      setSelectedPlace(null);
      setSelectedPlaceName("");
      setCat2List([]);
      setIsDirty(false);
    } catch (err) {
      console.error(err);
      alert("입력 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="page-wrap">

      {/* 카드 스타일 폼 컨테이너 */}
      <form onSubmit={handleSubmit} className="card entry-card-form"
        style={{display: 'flex', flexDirection: 'column'}}
      >
        {/* 날짜는 편집 팝업의 머리말과 같은 자리에 둔다 */}
        <div className="edit-modal__headfields entry-form__headfields">
          <EditField label="날짜" span={12}>
            <input
              type="date"
              name="tx_date"
              value={form.tx_date}
              onChange={handleChange}
            />
          </EditField>
        </div>

        {/* 편집 팝업과 동일한 12칸 그리드 배치 */}
        <div className="edit-grid">
          {/* 1행 — 분류 3단 */}
          <EditField label="중분류" span={4}>
            <SingleSelect
              options={visible(cat1List, (c) => String(c.id) === form.cat1_id)
                .map(c => ({ value: String(c.id), label: c.name }))}
              selected={form.cat1_id}
              onChange={(value) => {
                setForm({ ...form, cat1_id: value });
                setIsDirty(true);
              }}
              placeholder="(중분류)"
            />
          </EditField>

          <EditField label="소분류" span={4}>
            <SingleSelect
              options={cat2List.map(c => ({ value: String(c.id), label: c.name }))}
              selected={form.cat2_id}
              onChange={(value) => {
                setForm({ ...form, cat2_id: value });
                setIsDirty(true);
              }}
              placeholder="(소분류)"
            />
          </EditField>

          <EditField label="세분류" span={4}>
            <SingleSelect
              options={cat3List.map(c => ({ value: String(c.id), label: c.name }))}
              selected={form.cat3_id}
              onChange={(value) => {
                setForm({ ...form, cat3_id: value });
                setIsDirty(true);
              }}
              placeholder="(세분류)"
            />
          </EditField>

          {/* 2행 — 거래 속성. IN/OUT 은 소분류가 결정하므로 분류 바로 아래 */}
          <EditField label="IN/OUT" span={4}>
            <span className={`inout-chip ${form.inout === "1" ? "in" : form.inout === "-1" ? "out" : ""}`}>
              {form.inout === "1" ? "IN(+)" : form.inout === "-1" ? "OUT(−)" : "—"}
            </span>
          </EditField>

          <EditField label="결제 수단" span={4}>
            <SingleSelect
              options={visible(payList, (p) => p.code === form.pay_method)
                .map(p => ({ value: p.code, label: p.name }))}
              selected={form.pay_method}
              onChange={(value) => {
                setForm({ ...form, pay_method: value });
                setIsDirty(true);
              }}
              placeholder="(결제 수단)"
            />
          </EditField>

          <EditField label="금액" span={4}>
            <input
              type="number"
              name="amount"
              value={form.amount}
              placeholder="(금액)"
              onChange={handleChange}
              className="amount-input"
            />
          </EditField>

          {/* 3행 — 장소 */}
          <EditField label="장소/가게" span={12}>
            <div className="edit-place">
              <span className="edit-place__name">
                📍 {selectedPlaceName || "—"}
              </span>
              <button
                type="button"
                className="ui-btn small"
                onClick={() => setShowPlacePicker(true)}
              >
                검색
              </button>
            </div>
          </EditField>

          {/* 4행 — 메모 */}
          <EditField label="메모" span={12}>
            <input
              type="text"
              name="memo"
              value={form.memo}
              placeholder="(메모)"
              onChange={handleChange}
            />
          </EditField>
        </div>

        {showPlacePicker && (
          <PlacePicker
            onSelect={(place) => {
              setSelectedPlace(place);

              setForm(f => ({
                ...f,
                place_id: place.place_id ? String(place.place_id) : ""
              }));

              setSelectedPlaceName(place.place_name);
              setShowPlacePicker(false);
              setIsDirty(true);
            }}
            onClose={() => setShowPlacePicker(false)}
          />
        )}

        {/* Send Button */}
        <button
          type="submit"
          className="ui-btn primary w-full entry-form__submit"
          disabled={!isDirty}
        >
          전송
        </button>
      </form>
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
