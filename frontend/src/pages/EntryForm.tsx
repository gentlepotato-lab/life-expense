import Menu from "./components/Menu";
import React, { useEffect, useState } from "react";
import axios from "../api/client";
import SingleSelect from "./components/SingleSelect";
import CalculatorPopup from "./components/CalculatorPopup";
import { EditField } from "./components/CardEditModal";

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
  zIndex: 12000, // 편집 팝업(.popup-overlay, 9999) 위에 떠야 한다
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

/** 결과 목록이 어느 출처를 보여 주는지 */
type PlaceSource = "db" | "kakao";

function PlacePicker({ onSelect, onClose }: PlacePickerProps) {
  const [keyword, setKeyword] = useState("");
  const [dbResults, setDbResults] = useState<any[]>([]);
  const [apiResults, setApiResults] = useState<KakaoPlace[]>([]);
  const [selected, setSelected] = useState<any>(null);

  // 저장된 장소와 새 장소를 한 영역에 번갈아 보여 준다
  const [source, setSource] = useState<PlaceSource>("db");
  const [searched, setSearched] = useState(false);

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
    setSource("db");
    setSearched(true);
    setSelected(null);
    const res = await axios.get("/api/places/search", { params: { q: keyword } });
    setDbResults(res.data);
  };

  const searchKakao = async () => {
    setSource("kakao");
    setSearched(true);
    setSelected(null);
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

  // 엔터로 현재 선택된 출처를 다시 검색
  const runSearch = () => (source === "db" ? searchDB() : searchKakao());

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

  // 저장된 장소와 새 장소를 한 영역에 번갈아 표시한다
  const results: any[] = source === "db" ? dbResults : apiResults;
  const listTitle = source === "db" ? "저장된 장소/가게" : "새로운 장소/가게";

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div className="place-picker" onClick={(e) => e.stopPropagation()}>
        <header className="place-picker__head">
          <h3 className="place-picker__title">장소/가게</h3>
          <button
            type="button"
            className="edit-modal__close"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        {/* 검색어 */}
        <input
          className="ui-input place-picker__keyword"
          placeholder="검색어를 입력하세요."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runSearch();
            }
          }}
        />

        {/* 출처 전환 — 누른 쪽으로 목록과 제목이 바뀐다 */}
        <div className="place-picker__tabs">
          <button
            type="button"
            className={`place-tab ${source === "db" ? "active" : ""}`}
            onClick={searchDB}
          >
            저장된 장소/가게
          </button>
          <button
            type="button"
            className={`place-tab ${source === "kakao" ? "active" : ""}`}
            onClick={searchKakao}
          >
            [+] 새로운 장소/가게
          </button>
        </div>

        <div className="place-picker__listhead">
          <span className="place-picker__listtitle">{listTitle}</span>
          {searched && <span className="place-picker__count">{results.length}건</span>}
        </div>

        {/* 결과 목록 — 한 영역만 쓴다 */}
        <div className="place-picker__list">
          {results.length === 0 ? (
            <div className="popup-empty">
              {searched
                ? `${listTitle} 검색 결과가 없습니다.`
                : "검색어를 입력하고 위 버튼을 누르세요."}
            </div>
          ) : source === "db" ? (
            dbResults.map((r) => (
              <div
                key={r.place_id}
                className={`popup-item ${
                  selected?.source === "db" && selected?.place_id === r.place_id
                    ? "popup-selected"
                    : ""
                }`}
                onClick={() => setSelected({ source: "db", ...r, x: r.lng, y: r.lat })}
              >
                <strong>{r.place_name}</strong>
                <div className="popup-sub">{r.address}</div>
              </div>
            ))
          ) : (
            apiResults.map((r) => (
              <div
                key={r.id}
                className={`popup-item ${
                  selected?.source === "kakao" && selected?.id === r.id
                    ? "popup-selected"
                    : ""
                }`}
                onClick={() => setSelected({ source: "kakao", ...r })}
              >
                <strong>{r.place_name}</strong>
                <div className="popup-sub">{r.address_name}</div>
              </div>
            ))
          )}
        </div>

        {/* 지도 — 영역은 항상 잡아 두고, 선택 전에는 안내를 띄운다 */}
        <div className="place-picker__mapwrap">
          <div id="popup-map" className="place-picker__map"></div>
          {!selected && (
            <div className="place-picker__mapempty">
              목록에서 장소를 선택하면 지도가 표시됩니다.
            </div>
          )}
        </div>

        <footer className="place-picker__foot">
          <span className="place-picker__selected">
            {selected ? selected.place_name : "선택된 장소 없음"}
          </span>
          <div className="place-picker__foot-btns">
            <button className="ui-btn" onClick={onClose} type="button">
              닫기
            </button>
            <button
              className="ui-btn primary"
              onClick={applySelection}
              disabled={!selected}
              type="button"
            >
              선택
            </button>
          </div>
        </footer>
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
              options={cat1List.map(c => ({ value: String(c.id), label: c.name }))}
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
              {form.inout === "1" ? "IN (+)" : form.inout === "-1" ? "OUT (−)" : "—"}
            </span>
          </EditField>

          <EditField label="결제 수단" span={4}>
            <SingleSelect
              options={payList.map(p => ({ value: p.code, label: p.name }))}
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

export { PlacePicker };