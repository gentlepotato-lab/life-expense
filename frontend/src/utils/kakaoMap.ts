/**
 * 카카오 지도 SDK를 한 번만 띄운다.
 *
 * 장소 고르개(PlacePicker)와 쓰기 슬라이드가 함께 쓴다. 두 벌로 적어 두면
 * 열쇠나 libraries가 바뀔 때 한쪽만 고쳐져, 어떤 화면에서는 지도가 뜨고
 * 어떤 화면에서는 안 뜨게 된다.
 *
 * 이미 올라와 있으면 다시 내려받지 않고 바로 돌려준다. autoload=false로
 * 받아 두고 kakao.maps.load로 깨우는 것은 SDK가 시키는 차례다.
 */
export function loadKakaoMap(): Promise<void> {
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
