/**
 * 첫 화면의 칸마다 들어가는 그림.
 *
 * 아직 속이 비어 있는 화면들이라, 무엇이 들어올 자리인지 그림으로 미리 보여 준다.
 * 바깥에서 불러오는 것 없이 전부 여기에 그린다 — 로고만 브랜드 파일을 그대로 쓴다.
 *
 * 색은 로고와 같은 두 가지다. 값은 고른 빛깔 벌이 CSS 변수로 내려 준다
 * (utils/palettes.ts). 그림 속성에 var()를 그대로 쓸 수 있어 여기서는
 * 변수만 가리키고, 벌이 바뀌면 다시 그릴 것 없이 따라 바뀐다.
 * 로고도 벌을 따른다. `<img>`로 붙는 그림 파일이라 CSS가 닿지 않으므로
 * 벌마다 한 장씩 미리 물들여 둔다(tools/palette-logos.mjs).
 */

import { currentPalette } from "../../utils/palettes";

const INK = "var(--art-ink)";
const AQUA = "var(--art-aqua)";
const TINT = "var(--art-tint)";

/** 쓰기 — 서비스 로고(펜에서 동전으로 흐르는 가로형) */
export function ArtWrite() {
  return (
    <img
      className="home-art home-art--logo"
      src={`/palette/logo-${currentPalette().key}.svg`}
      alt=""
      aria-hidden="true"
    />
  );
}

/** 돈쓴이 — 프로필 */
export function ArtProfile() {
  return (
    <svg className="home-art home-art--profile" viewBox="0 0 96 72" aria-hidden="true">
      <circle cx="48" cy="26" r="13" fill="none" stroke={AQUA} strokeWidth="3.2" />
      <path
        d="M25 62c0-12.7 10.3-21 23-21s23 8.3 23 21"
        fill="none"
        stroke={INK}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 씀씀이 — 달마다 얼마를 썼는지(막대)와 그 흐름(꺾은선).
 *
 * 가로로 차지하는 폭은 잔소리의 종+영수증과 같게 맞춰 두었다(104px).
 * 두 칸이 나란히 놓이므로 그림이 시작하고 끝나는 자리가 같아야 가지런하다.
 * 그래서 좌표를 viewBox 14~100 안에 가둔다.
 */
export function ArtChart() {
  /* 막대 여섯 — [x, 윗변]. 바닥은 58.
     꺾은선과 오르내리는 모양을 일부러 다르게 뒀다. 둘이 같이 움직이면
     같은 값을 두 번 그린 것처럼 보여 굳이 겹쳐 둘 이유가 없어진다. */
  const BARS = [
    [17, 40],
    [31, 30],
    [45, 36],
    [59, 26],
    [73, 34],
    [87, 27],
  ];

  return (
    <svg className="home-art" viewBox="0 0 140 72" aria-hidden="true">
      {/* 바닥 눈금 */}
      <path d="M13.7 58h86.3" stroke="#E4E7EC" strokeWidth="1.6" strokeLinecap="round" />

      {/* 막대 */}
      <g fill={TINT}>
        {BARS.map(([x, top]) => (
          <rect key={x} x={x} y={top} width="9" height={58 - top} rx="2" />
        ))}
      </g>

      {/* 흐름 — 막대 위를 지난다.
          끝까지 오르기만 하면 그래프가 아니라 화살표처럼 읽힌다.
          다섯째에서 고점을 찍고 마지막은 살짝 내려온다. */}
      <path
        d="M21.5 34 35.5 26 49.5 30 63.5 20 77.5 16 91.5 21"
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 가장 최근 값 */}
      <circle cx="91.5" cy="21" r="4.4" fill="#FFFFFF" stroke={AQUA} strokeWidth="3" />
    </svg>
  );
}

/**
 * 잔소리 — 방금 흔들린 종과, 그 뒤에 기대어 선 영수증.
 *
 * 다른 칸의 그림은 모두 한순간을 담고 있다 — 쓰기는 펜에서 동전이 흐르고,
 * 씀씀이는 꺾은선이 고점을 찍고 내려오며, 어디 쓰나는 길이 두 핀을 잇는다.
 * 종만 반듯하게 서 있으면 아무 일도 일어나지 않는다. 종은 울릴 때 종이다.
 *
 * 종을 13도 눕히고 추를 그 방향으로 따라 내보낸다. 소리는 옅은 물결 둘로
 * 양옆에 퍼뜨린다. 영수증은 반대쪽으로 7도 눕혀 종에 기대 세운다 — 둘이
 * 서로 어긋난 방향으로 누워야 멈춰 있지 않고 흔들리는 중으로 읽힌다.
 *
 * 영수증은 폭을 33에서 28로 좁혀 종과 겹친다. 종의 몸통이 흰색으로 차 있어
 * 겹친 자리에서 영수증 선이 가려지고, 그래서 앞뒤가 생긴다.
 */
export function ArtNudge() {
  return (
    <svg className="home-art" viewBox="0 0 140 72" aria-hidden="true">
      {/* 영수증 — 아래쪽은 톱니로 뜯긴 모양. 종과 반대쪽으로 눕는다.
          눌러 그리지 않고 좌표를 다시 잡았다 — 그래야 선 두께가 고르다. */}
      <g transform="rotate(7 72 36)">
        <path
          d="M57 12h28a3 3 0 0 1 3 3v39l-4 3-4-3-4 3-4-3-4 3-4-3-4 3-4-3V15a3 3 0 0 1 3-3Z"
          fill="#FFFFFF"
          stroke={INK}
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        <path
          d="M60.5 22h21M60.5 30h21M60.5 38h11"
          stroke={TINT}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </g>

      {/* 종 — 위가 둥글고 아래로 벌어진 뒤 테두리에서 딱 끊긴다. */}
      <g transform="translate(12 12) scale(0.92)">
        {/* 몸통과 꼭지는 꼭지 자리를 축으로 함께 눕는다. 추는 몸통을 따라
            나가지만 함께 돌지는 않는다 — 매달린 것이라 제 방향으로 흐른다. */}
        <g transform="rotate(-13 28 12)">
          <path
            d="M28 15c-7.2 0-11.4 5.2-11.4 12 0 8-1.8 11.4-4.2 13.8h31.2C41.2 38.4 39.4 35 39.4 27c0-6.8-4.2-12-11.4-12Z"
            fill="#FFFFFF"
            stroke={AQUA}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M28 10.5v4.5" stroke={AQUA} strokeWidth="3" strokeLinecap="round" />
        </g>
        <path
          d="M27.2 45.6a4.4 4.4 0 0 0 8.8-.9"
          fill="none"
          stroke={AQUA}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* 소리 — 양옆으로 퍼진다. 종보다 옅게 두어 몸통과 다투지 않는다.
            맨 위에 얹는다. 오른쪽 물결은 영수증과 겹치지만, 소리는 양쪽으로
            고르게 퍼져야 흔들리는 것으로 읽힌다.

            겹치는 자리가 영수증의 남색 테두리라 옅은 청록이 그대로 묻힌다.
            흰 테를 먼저 깔아 띄운다 — 흰 바탕 위에서는 보이지 않으므로
            왼쪽 물결의 모습은 달라지지 않는다. */}
        <g fill="none" strokeLinecap="round">
          <g stroke="#FFFFFF" strokeWidth="5.4">
            <path d="M6.4 22a13 13 0 0 0-1.2 14" />
            <path d="M49.6 18.5a13 13 0 0 1 1.6 14" />
          </g>
          <g stroke={AQUA} strokeWidth="2.6" opacity="0.5">
            <path d="M6.4 22a13 13 0 0 0-1.2 14" />
            <path d="M49.6 18.5a13 13 0 0 1 1.6 14" />
          </g>
        </g>
      </g>
    </svg>
  );
}

/** 어디 쓰나 — 접힌 지도에 핀 둘 */
export function ArtPlaces() {
  return (
    <svg className="home-art" viewBox="0 0 140 72" aria-hidden="true">
      {/* 씀씀이 · 잔소리의 그림은 13.7~100에 그려져 가운데가 56.85다. 이것은
          30~110이라 가운데가 70이었다 — 셋을 나란히 놓으면 혼자 오른쪽으로
          밀려 보였다. 가운데끼리 맞춘다. */}
      <g transform="translate(-13.15, 0)">
      {/* 접힌 지도 — 세로로 두 번 접혀 골이 지고, 접힌 자리마다 높낮이가 엇갈린다. */}
      <path
        d="M30 20 55 12l30 8 25-8v40l-25 8-30-8-25 8V20Z"
        fill="#FFFFFF"
        stroke={INK}
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      {/* 접힌 골 */}
      <path d="M55 12v40M85 20v40" stroke={INK} strokeWidth="2.8" strokeLinejoin="round" />

      {/* 길 — 지도 위를 가로지른다. */}
      <path
        d="M36 44c8-2 10-12 19-13s12 7 20 5 13-11 21-12"
        fill="none"
        stroke={TINT}
        strokeWidth="2.8"
        strokeLinecap="round"
      />

      {/* 핀 — 다녀온 자리. 큰 것 하나에 작은 것 하나. */}
      <path
        d="M70 16.5a7.5 7.5 0 0 1 7.5 7.5c0 5.6-7.5 13-7.5 13s-7.5-7.4-7.5-13a7.5 7.5 0 0 1 7.5-7.5Z"
        fill="#FFFFFF"
        stroke={AQUA}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="70" cy="24" r="2.8" fill={AQUA} />
      <path
        d="M44 32.5a4.6 4.6 0 0 1 4.6 4.6c0 3.4-4.6 8-4.6 8s-4.6-4.6-4.6-8a4.6 4.6 0 0 1 4.6-4.6Z"
        fill="#FFFFFF"
        stroke={AQUA}
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      </g>
    </svg>
  );
}
