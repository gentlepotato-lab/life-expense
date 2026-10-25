import { 바깥적기, 바깥자취 } from "./track";

/* 지도 SDK를 받아 오는 자리. 열쇠(appkey)는 부를 때 물음표 뒤에 붙으므로
   여기에는 없다. 기록에 적는 주소도 이것이다(track.ts의 바깥적기). */
const SDK주소 = "https://dapi.kakao.com/v2/maps/sdk.js";

/* 장소를 찾을 때 SDK가 보내는 자리. 자취에서 못 집었을 때만 쓴다
   (pages/components/PlacePicker.tsx와 WriteSlideModal.tsx). */
export const 장소찾기주소 = "https://dapi.kakao.com/v2/local/search/keyword.json";

/**
 * 장소나 가게를 찾은 것을 적는다.
 *
 * 주소는 SDK가 제 손으로 보내므로 우리가 쥐고 있지 않다. 브라우저가 적은
 * 자취에서 집어 온다(utils/track.ts의 바깥자취). 물음표 뒤에 찾은 말(query)이
 * 붙어 있어, 코드에 적은 주소보다 이쪽이 자세하다.
 *
 * **한 참 기다렸다가 집는다.** 자취는 요청이 다 끝난 뒤에 적히는데, SDK가
 * 결과를 돌려주는 순간은 그보다 앞설 수 있다. 바로 집으면 아직 없어서
 * 코드에 적은 주소(물음표 없는 것)로 떨어졌다. 지도를 적는 자리와 같은
 * 잣대다(지도적기).
 *
 * 걸린 시간은 기다리기 전에 재 둔다. 기다린 시간까지 더해지면 안 된다.
 */
export function 장소찾기적기(시작: number, 됐나: boolean): void {
  const 걸린 = Math.round(performance.now() - 시작);
  window.setTimeout(() => {
    바깥적기(
      카카오,
      "장소/가게 찾기",
      걸린,
      됐나 ? 200 : 204,
      "GET",
      바깥자취("dapi.kakao.com/v2/local") ?? 장소찾기주소
    );
  }, 500);
}

/**
 * 지도를 한 번 그렸다고 적는다.
 *
 * SDK 파일을 처음 받는 줄만 쌓이던 때는, 장소를 선택해 지도를 몇 번 그리든
 * 기록에 한 줄도 남지 않았다. 바깥에 나가는 품은 그만큼 드는데 센 것이
 * 없었다.
 *
 * 타일은 지도를 그린 뒤에 날아가므로 한 참 기다렸다가 자취에서 집는다.
 * 타일 한 장마다 적지는 않는다. 한 번 그릴 때 열몇 장이 나가 기록이
 * 타일로 뒤덮인다. 지도 한 번에 한 줄이다.
 */
export function 지도적기(시작: number): void {
  const 걸린 = Math.round(performance.now() - 시작);
  window.setTimeout(() => {
    바깥적기(카카오, "지도 보기", 걸린, 200, "GET", 바깥자취("daumcdn.net"));
  }, 800);
}

/**
 * 카카오 지도 SDK를 한 번만 띄운다.
 *
 * 장소 선택기(PlacePicker)와 쓰기 슬라이드가 함께 쓴다. 두 벌로 적으면
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

    /* 내려받는 데 걸린 시간을 잰다. 관리자 사이트의 외부 API 쪽이 이것을
       마지막 요청으로 읽는다(utils/track.ts의 바깥적기). 서버를 거치지 않고
       브라우저가 바로 부르므로, 적어 보내지 않으면 아무 데도 남지 않는다. */
    const 시작 = performance.now();
    const script = document.createElement("script");
    script.src = `${SDK주소}?appkey=${import.meta.env.VITE_KAKAO_MAP_KEY}&autoload=false&libraries=services`;
    script.onload = () => {
      바깥적기(카카오, "지도 띄우기", Math.round(performance.now() - 시작), 200, "GET", SDK주소);
      window.kakao.maps.load(resolve);
    };
    script.onerror = () => {
      바깥적기(카카오, "지도 띄우기", Math.round(performance.now() - 시작), 500, "GET", SDK주소);
      /* 못 받아도 멈추지는 않는다. 부르는 쪽이 지도 없이 그리거나 빈 목록을
         내놓는다. */
      resolve();
    };
    document.head.appendChild(script);
  });
}
