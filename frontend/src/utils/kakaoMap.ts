import { 바깥적기 } from "./track";

/**
 * 카카오 지도 SDK를 한 번만 띄운다.
 *
 * 장소 고르개(PlacePicker)와 쓰기 슬라이드가 함께 쓴다. 두 벌로 적으면
 * 열쇠나 libraries가 바뀔 때 한쪽만 고쳐져, 어떤 화면에서는 지도가 뜨고
 * 어떤 화면에서는 안 뜨게 된다.
 *
 * 이미 올라와 있으면 다시 내려받지 않고 바로 돌려준다. autoload=false로
 * 받고 kakao.maps.load로 깨우는 것은 SDK가 시키는 차례다.
 */
/** 기록에 적는 이름. 관리자 사이트의 외부 API 목록과 같은 글이어야 한다
 *  (app/routers/admin.py의 바깥들). */
export const 카카오 = "카카오 지도";

export function loadKakaoMap(): Promise<void> {
  return new Promise<void>((resolve) => {
    // 이미 로드되어 있으면 바로 resolve
    if (window.kakao && window.kakao.maps) {
      window.kakao.maps.load(resolve);
      return;
    }

    /* 내려받는 데 걸린 참을 잰다. 관리자 사이트의 외부 API 쪽이 이것을
       마지막 요청으로 읽는다(utils/track.ts의 바깥적기). 서버를 거치지 않고
       브라우저가 바로 부르므로, 적어 보내지 않으면 아무 데도 남지 않는다. */
    const 시작 = performance.now();
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${import.meta.env.VITE_KAKAO_MAP_KEY}&autoload=false&libraries=services`;
    script.onload = () => {
      바깥적기(카카오, "지도 띄우기", Math.round(performance.now() - 시작), 200);
      window.kakao.maps.load(resolve);
    };
    script.onerror = () => {
      바깥적기(카카오, "지도 띄우기", Math.round(performance.now() - 시작), 500);
      /* 못 받아도 멈추지는 않는다. 부르는 쪽이 지도 없이 그리거나 빈 목록을
         내놓는다. */
      resolve();
    };
    document.head.appendChild(script);
  });
}
