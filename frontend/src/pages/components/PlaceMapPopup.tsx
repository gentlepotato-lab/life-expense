import { useEffect, useRef } from "react";
import useBackClose from "../../hooks/useBackClose";
import { loadKakaoMap } from "../../utils/kakaoMap";
import type { BoardPlace } from "../../utils/placeBoard";

/**
 * 장소 하나를 지도에 찍어 보여 준다.
 *
 * 껍데기는 다른 팝업과 같은 틀(popup-overlay · popup-panel--framed)이다.
 * 쓰기에서 장소를 고를 때 뜨는 지도와 같은 모양으로, 고른 곳에 핀 하나를
 * 꽂고 그 자리를 가운데에 둔다.
 */
const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

/**
 * 마지막으로 간 날.
 *
 * 다른 화면이 쓰는 꼴(formatDateLabel)에는 요일이 붙는데, 세 칸 가운데
 * 하나에 넣기에는 그만큼이 길어 칸을 넘는다. 여기서는 요일을 뗀다.
 */
const day = (v: string) => {
  const [y, m, d] = v.split("-");
  return `${y}. ${Number(m)}. ${Number(d)}.`;
};

export default function PlaceMapPopup({
  place,
  onClose,
}: {
  place: BoardPlace;
  onClose: () => void;
}) {
  useBackClose(true, onClose);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("modal-open");
    return () => document.documentElement.classList.remove("modal-open");
  }, []);

  useEffect(() => {
    if (place.lat === null || place.lng === null) return;
    let alive = true;

    void loadKakaoMap().then(() => {
      if (!alive || !box.current) return;
      const { kakao } = window;
      const at = new kakao.maps.LatLng(place.lat, place.lng);
      const map = new kakao.maps.Map(box.current, { center: at, level: 3 });
      new kakao.maps.Marker({ position: at, map });
    });

    return () => {
      alive = false;
    };
  }, [place.lat, place.lng]);

  const where = [place.city, place.district, place.town].filter(Boolean).join(" ");

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel popup-panel--framed"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="장소 상세"
      >
        <header className="popup-head">
          <h3 className="popup-head__title">{place.place_name}</h3>
        </header>

        <div className="popup-body wh-detail">
          {/* 지도는 자리를 늘 잡아 둔다 — 좌표가 없으면 그 자리에 까닭을 적는다. */}
          <div className="wh-map">
            {place.lat !== null && place.lng !== null ? (
              <div className="wh-map__box" ref={box} />
            ) : (
              <div className="wh-map__none">좌표가 적혀 있지 않은 곳입니다.</div>
            )}
          </div>

          <div className="tag-row wh-detail__tags">
            {place.kind && <span className="tag">{place.kind}</span>}
            {place.kind2 && place.kind2 !== place.kind && (
              <span className="tag">{place.kind2}</span>
            )}
            {where && <span className="tag">{where}</span>}
          </div>

          {place.address && <p className="wh-detail__addr">{place.address}</p>}
          {place.phone && <p className="wh-detail__addr">{place.phone}</p>}

          <div className="chart-tiles wh-tiles">
            <div className="chart-tile">
              <span className="chart-tile__label">간 횟수</span>
              <span className="me-tile__foot">
                <span className="chart-tile__value">
                  {place.used_count.toLocaleString("ko-KR")}
                </span>
                <span className="chart-tile__sub">번</span>
              </span>
            </div>
            <div className="chart-tile">
              <span className="chart-tile__label">쓴 돈</span>
              <span className="me-tile__foot">
                <span className="chart-tile__value">{won(place.total)}</span>
              </span>
            </div>
            <div className="chart-tile">
              <span className="chart-tile__label">마지막 방문</span>
              <span className="me-tile__foot">
                <span className="chart-tile__value wh-tile__day">
                  {place.last_used ? day(place.last_used) : "—"}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="btn-row popup-foot">
          {place.place_url && (
            <a
              className="ui-btn wh-detail__link"
              href={place.place_url}
              target="_blank"
              rel="noreferrer noopener"
            >
              카카오맵
            </a>
          )}
          <button className="ui-btn" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
