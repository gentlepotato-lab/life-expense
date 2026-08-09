import Menu from "./components/Menu";
import React, { useEffect, useState } from "react";
import axios from "../api/client";
import SingleSelect from "./components/SingleSelect";
import CalculatorPopup from "./components/CalculatorPopup";

function loadKakaoMap() {
  return new Promise<void>((resolve) => {
    // 이미 로드되어 있으면 바로 resolve
    if (window.kakao && window.kakao.maps) {
      window.kakao.maps.load(resolve);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${import.meta.env.VITE_KAKAO_MAP_KEY}&autoload=false&libraries=services`;
    script.onload = () => {
      window.kakao.maps.load(resolve);
    };
    document.head.appendChild(script);
  });
}

const overlayStyle: React.CSSProperties = {
  position: "fixed" as const,
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  overflowY: "auto",
  overflowX: "hidden",
  padding: "32px 0",
  zIndex: 2000,
  WebkitOverflowScrolling: "touch",
  pointerEvents: "auto",
};

type KakaoPlace = {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name?: string;
  phone?: string;
  category_name?: string;
  category_group_code?: string;
  category_group_name?: string;
  place_url?: string;
  x: string;
  y: string;
};

type PlacePickerProps = {
  onSelect: (place: {
    place_id: number | null;
    place_name: string;
    lat?: number;
    lng?: number;
    address_name?: string;

    kakao_id?: string;
    road_address_name?: string;
    phone?: string;
    category_name?: string;
    category_group_code?: string;
    category_group_name?: string;
    place_url?: string;
  }) => void;

  onClose: () => void;
};

function PlacePicker({ onSelect, onClose }: PlacePickerProps) {
  const [keyword, setKeyword] = useState("");
  const [dbResults, setDbResults] = useState<any[]>([]);
  const [apiResults, setApiResults] = useState<KakaoPlace[]>([]);
  const [selected, setSelected] = useState<any>(null);

  // 외부 클릭 완전 차단
  useEffect(() => {
    document.documentElement.classList.add("modal-open");
    document.body.style.pointerEvents = "none";

    return () => {
      document.documentElement.classList.remove("modal-open");
      document.body.style.pointerEvents = "auto";
    };
  }, []);

  // 지도 로드 함수
  useEffect(() => {
    if (!selected || !selected.y || !selected.x) return;

    loadKakaoMap().then(() => {
      const { kakao } = window as any;
      const mapContainer = document.getElementById("popup-map");
      if (!mapContainer) return;

      const mapOption = {
        center: new kakao.maps.LatLng(Number(selected.y), Number(selected.x)),
        level: 3,
      };

      const map = new kakao.maps.Map(mapContainer, mapOption);

      new kakao.maps.Marker({
        position: new kakao.maps.LatLng(Number(selected.y), Number(selected.x)),
        map,
      });
    });
  }, [selected]);

  const searchDB = async () => {
    const res = await axios.get("/api/places/search", { params: { q: keyword } });
    setDbResults(res.data);
  };

  const searchKakao = async () => {
    await loadKakaoMap();
    const { kakao } = window as any;
    const ps = new kakao.maps.services.Places();
    ps.keywordSearch(keyword, (data: any, status: any) => {
      if (status === kakao.maps.services.Status.OK) {
        setApiResults(data);
      } else {
        setApiResults([]);
      }
    });
  };

  const applySelection = () => {
    if (!selected) return;

    // DB 저장하지 않고, 선택된 정보만 전달
    if (selected.source === "db") {
      onSelect({
        place_id: selected.place_id,
        place_name: selected.place_name,
        lat: selected.lat,
        lng: selected.lng,

        kakao_id: selected.id,
        address_name: selected.address_name,
        road_address_name: selected.road_address_name,
        phone: selected.phone,
        category_name: selected.category_name,
        category_group_code: selected.category_group_code,
        category_group_name: selected.category_group_name,
        place_url: selected.place_url,
      });
    } else {
      onSelect({
        place_id: null,
        place_name: selected.place_name,
        lat: Number(selected.y),
        lng: Number(selected.x),

        kakao_id: selected.id,
        address_name: selected.address_name,
        road_address_name: selected.road_address_name,
        phone: selected.phone,
        category_name: selected.category_name,
        category_group_code: selected.category_group_code,
        category_group_name: selected.category_group_name,
        place_url: selected.place_url,
      });
    }

    onClose();
  };

  // 팝업 스타일
  const popupStyle: React.CSSProperties = {
    background: "#fff",
    padding: 8,
    borderRadius: 16,
    width: "calc(100vw - 32px)", // 100% 뷰포트에서 좌우 여백 확보
    maxWidth: "480px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    maxHeight: "90vh",
    overflow: "hidden",
    margin: "auto",
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={popupStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, textAlign: "center" }}>장소/가게</h3>

        {/* 스크롤 가능한 본문 */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
          {/* 검색 입력 */}
          <input
            className="ui-input"
            placeholder="검색어를 입력하세요."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ marginBottom: 8 }}
          />

          {/* 검색 버튼 묶음 */}
          <div className="btn-row" style={{ marginBottom: 12 }}>
            <button className="ui-btn" onClick={searchDB} type="button">
              저장된 장소/가게
            </button>
            <button className="ui-btn" onClick={searchKakao} type="button">
              [+] 새로운 장소/가게
            </button>
          </div>

          {/* Stored Places */}
          <h4 className="popup-section-title">저장된 장소/가게</h4>
          <div className="popup-list">
            {dbResults.length === 0 ? (
              <div className="popup-empty">저장된 장소/가게 검색 결과가 없습니다.</div>
            ) : (
              dbResults.map((r) => (
                <div
                  key={r.place_id}
                  className={`popup-item ${
                    selected?.place_id === r.place_id ? "popup-selected" : ""
                  }`}
                  onClick={() =>
                    setSelected({ source: "db", ...r, x: r.lng, y: r.lat })
                  }
                >
                  <strong>{r.place_name}</strong>
                  <div className="popup-sub">{r.address}</div>
                </div>
              ))
            )}
          </div>

          {/* New Places */}
          <h4 className="popup-section-title">새로운 장소/가게</h4>
          <div className="popup-list">
            {apiResults.length === 0 ? (
              <div className="popup-empty">새로운 장소/가게 검색 결과가 없습니다.</div>
            ) : (
              apiResults.map((r) => (
                <div
                  key={r.id}
                  className={`popup-item ${
                    selected?.place_name === r.place_name ? "popup-selected" : ""
                  }`}
                  onClick={() => setSelected({ source: "kakao", ...r })}
                >
                  <strong>{r.place_name}</strong>
                  <div className="popup-sub">{r.address_name}</div>
                </div>
              ))
            )}
          </div>

          {/* 지도도 스크롤 영역 안에 포함 */}
          {selected && (
            <div
              id="popup-map"
              style={{
                width: "100%",
                height: "320px",
                marginTop: "12px",
                borderRadius: "12px",
                overflow: "hidden",
                border: "1px solid #e5e7eb",
                flexShrink: 0,
              }}
            ></div>
          )}

          {/* 하단 버튼 묶음 */}
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button
              className="ui-btn primary"
              onClick={applySelection}
              disabled={!selected}
            >
              선택된 장소/가게 입력
            </button>
            <button className="ui-btn" onClick={onClose}>
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EntryForm() {
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

  const [cat1List, setCat1List] = useState<{ id: number; name: string }[]>([]);
  const [cat2List, setCat2List] = useState<{ id: number; name: string; inout: number | null }[]>([]);
  const [cat3List, setCat3List] = useState<{ id: number; name: string }[]>([]);
  const [payList, setPayList] = useState<{ code: string; name: string }[]>([]);

  const [showPlacePicker, setShowPlacePicker] = useState(false);
  const [selectedPlaceName, setSelectedPlaceName] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  
  const [isDirty, setIsDirty] = useState(false);

  // 중분류(카테고리1) 불러오기
  useEffect(() => {
    axios.get("/meta/categories/lvl1").then((res) => setCat1List(res.data));
  }, []);

  // 소분류(카테고리2) 불러오기 → cat1_id 변경 시
  useEffect(() => {
    if (!form.cat1_id) return;
    axios
      .get("/meta/categories/lvl2", { params: { cat1_id: form.cat1_id } })
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
      .get("/meta/categories/lvl3", { params: { cat2_id: form.cat2_id } })
      .then((res) => setCat3List(res.data));
  }, [form.cat2_id]);

  // 결제 수단 불러오기
  useEffect(() => {
    axios.get("/meta/payment-methods/list").then((res) =>
      setPayList(
        res.data.map((p: any) => ({
          code: String(p.method_id),
          name: p.method_name
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
        // 새로 등록 (백엔드에서 kakao_id로 중복 검사)
        const res = await axios.post("/api/places", {
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
      <Menu />
      <h1 className="page-title">Add Expense</h1>

      {/* 카드 스타일 폼 컨테이너 */}
      <form onSubmit={handleSubmit} className="card entry-card-form"
        style={{display: 'flex', flexDirection: 'column'}}
      >
        {/* Date */}
        <div className="form-row" style={{marginBottom: '16px', marginTop: '4px'}}>
          <label className="form-label required">날짜</label>
          <input
            type="date"
            name="tx_date"
            value={form.tx_date}
            onChange={handleChange}
            className="ui-input"
          />
        </div>

        {/* CategoryM + IN/OUT */}
        <div className="flex gap-2" style={{marginBottom: '6px'}}>
          <div className="form-row" style={{flex: 1, marginBottom: 0}}>
            <label className="form-label required">중분류</label>
            <SingleSelect
              options={cat1List.map(c => ({ value: String(c.id), label: c.name }))}
              selected={form.cat1_id}
              onChange={(value) => {
                setForm({ ...form, cat1_id: value });
                setIsDirty(true);
              }}
              placeholder="(중분류)"
            />
          </div>
          <div className="form-row" style={{flex: 1, marginBottom: 0}}>
            <label className="form-label required">IN/OUT</label>
            <div className="ui-input" style={{ display: 'flex', alignItems: 'center', padding: '0 10px', height: '36px', background: 'var(--color-bg)', cursor: 'not-allowed' }}>
              {form.inout === "1" ? "IN(+)" : form.inout === "-1" ? "OUT(-)" : "—"}
            </div>
          </div>
        </div>

        {/* CategoryS + Payment */}
        <div className="flex gap-2" style={{marginBottom: '6px'}}>
          <div className="form-row" style={{flex: 1, marginBottom: 0}}>
            <label className="form-label required">소분류</label>
            <SingleSelect
              options={cat2List.map(c => ({ value: String(c.id), label: c.name }))}
              selected={form.cat2_id}
              onChange={(value) => {
                setForm({ ...form, cat2_id: value });
                setIsDirty(true);
              }}
              placeholder="(소분류)"
            />
          </div>
          <div className="form-row" style={{flex: 1, marginBottom: 0}}>
            <label className="form-label required">결제 수단</label>
            <SingleSelect
              options={payList.map(p => ({ value: p.code, label: p.name }))}
              selected={form.pay_method}
              onChange={(value) => {
                setForm({ ...form, pay_method: value });
                setIsDirty(true);
              }}
              placeholder="(결제 수단)"
            />
          </div>
        </div>

        {/* CategoryD + Amount */}
        <div className="flex gap-2" style={{marginBottom: '16px'}}>
          <div className="form-row" style={{flex: 1, marginBottom: 0}}>
            <label className="form-label">세분류</label>
            <SingleSelect
              options={cat3List.map(c => ({ value: String(c.id), label: c.name }))}
              selected={form.cat3_id}
              onChange={(value) => {
                setForm({ ...form, cat3_id: value });
                setIsDirty(true);
              }}
              placeholder="(세분류)"
            />
          </div>
          <div className="form-row" style={{flex: 1, marginBottom: 0}}>
            <label className="form-label required">금액</label>
            <input
              type="number"
              name="amount"
              value={form.amount}
              placeholder="(금액)"
              onChange={handleChange}
              className="ui-input"
            />
          </div>
        </div>

        {/* Place */}
        <div className="form-row" style={{marginBottom: '16px'}}>
          <label className="form-label">장소/가게</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={selectedPlaceName}
              className="ui-input"
              readOnly
              placeholder="(장소/가게)"
              style={{flex: 1}}
            />
            <button
              type="button"
              className="ui-btn small"
              onClick={() => setShowPlacePicker(true)}
            >
              검색
            </button>
          </div>
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

        {/* Memo */}
        <div className="form-row" style={{marginBottom: '16px'}}>
          <label className="form-label">메모</label>
          <input
            type="text"
            name="memo"
            value={form.memo}
            placeholder="(메모)"
            onChange={handleChange}
            className="ui-input"
          />
		</div>

        {/* Send Button */}
        <button
          type="submit"
          className="ui-btn primary w-full"
          disabled={!isDirty}
          style={{marginBottom: '4px'}}
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

export { PlacePicker };