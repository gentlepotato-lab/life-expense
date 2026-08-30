/**
 * 카카오 지도 짐 싣기.
 *
 * 화면이 뜰 때마다 싣지 않는다 — 한 번 실어 두면 창을 닫을 때까지 남는다.
 * 이미 실려 있으면 kakao.maps.load 가 곧바로 부른다.
 *
 * 장소 고르기 팝업(PlacePicker)도 같은 일을 제 안에서 한다. 그쪽은 건드리지
 * 않았으니 지금은 두 벌이지만, 싣는 짐은 하나라 두 번 내려받지는 않는다.
 */
export function loadKakaoMap(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (window.kakao && window.kakao.maps) {
      window.kakao.maps.load(resolve);
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://dapi.kakao.com/v2/maps/sdk.js?appkey=" +
      `${import.meta.env.VITE_KAKAO_MAP_KEY}&autoload=false&libraries=services`;
    script.onload = () => window.kakao.maps.load(resolve);
    document.head.appendChild(script);
  });
}
