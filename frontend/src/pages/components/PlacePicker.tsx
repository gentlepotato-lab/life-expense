import React, { useEffect, useState } from "react";
import axios from "../../api/client";

/**
 * 장소 고르기 팝업.
 *
 * 저장해 둔 장소를 먼저 찾고, 없으면 카카오에서 찾아 새로 적는다.
 * 쓰기 · 쓴 내역 · 쓰다 만 내역 · 쓸 내역 네 화면이 함께 쓰기 때문에
 * 어느 한 화면에 얹어 두지 않고 여기 따로 둔다.
 */
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
  zIndex: 12000, // 편집 팝업(.popup-overlay, 9999) 위에 떠야 한다.
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

export default function PlacePicker({ onSelect, onClose }: PlacePickerProps) {
  const [keyword, setKeyword] = useState("");
  const [dbResults, setDbResults] = useState<any[]>([]);
  const [apiResults, setApiResults] = useState<KakaoPlace[]>([]);
  const [selected, setSelected] = useState<any>(null);

  // 저장된 장소와 새 장소를 한 영역에 번갈아 보여 준다.
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
    const res = await axios.get("/places/search", { params: { q: keyword } });
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

  // 저장된 장소와 새 장소를 한 영역에 번갈아 표시한다.
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
          placeholder="(검색어)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runSearch();
            }
          }}
        />

        {/* 출처 전환 — 누른 쪽으로 목록과 제목이 바뀐다. */}
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

        {/* 결과 목록 — 한 영역만 쓴다. */}
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

        {/* 지도 — 영역은 항상 잡아 두고, 선택 전에는 안내를 띄운다. */}
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
