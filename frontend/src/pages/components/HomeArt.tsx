/**
 * 첫 화면의 칸마다 들어가는 그림.
 *
 * 아직 속이 비어 있는 화면들이라, 무엇이 들어올 자리인지 그림으로 미리 보여 준다.
 * 바깥에서 불러오는 것 없이 전부 여기에 그린다 — 로고만 브랜드 파일을 그대로 쓴다.
 *
 * 색은 로고와 같은 두 가지다. 남색 #5B5FEF, 청록 #00C7BE.
 */

const INK = "#5B5FEF";
const AQUA = "#00C7BE";

/** 쓰기 — 서비스 로고(펜에서 동전으로 흐르는 가로형) */
export function ArtWrite() {
  return (
    <img className="home-art home-art--logo" src="/logo-h.svg" alt="" aria-hidden="true" />
  );
}

/** 쓰는 사람 — 프로필 */
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
      <g fill="#C9CDF6">
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

/** 잔소리 — 종과 영수증 */
export function ArtNudge() {
  return (
    <svg className="home-art" viewBox="0 0 140 72" aria-hidden="true">
      {/* 영수증 — 아래쪽은 톱니로 뜯긴 모양.
          영수증은 길쭉한 종이니 종보다 키가 커야 그럴듯하다. 폭은 좁히고 키는
          키워 종과의 비율을 실제에 가깝게 뒀다(종 높이 : 영수증 높이 ≈ 3 : 4).
          눌러 그리지 않고 좌표를 다시 잡았다 — 그래야 선 두께가 고르다. */}
      <path
        d="M63.5 14h33a3.5 3.5 0 0 1 3.5 3.5v35.5l-5 3.5-5-3.5-5 3.5-5-3.5-5 3.5-5-3.5-5 3.5-5-3.5V17.5a3.5 3.5 0 0 1 3.5-3.5Z"
        fill="#FFFFFF"
        stroke={INK}
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <path
        d="M67 24.5h26M67 33h26M67 41.5h14"
        stroke="#C9CDF6"
        strokeWidth="2.8"
        strokeLinecap="round"
      />

      {/* 종 — 위가 둥글고 아래로 벌어진 뒤 테두리에서 딱 끊긴다.
          영수증이 길어지면서 둘의 세로 가운데가 어긋나 6만큼 내려 맞췄다 */}
      <g transform="translate(2.24 8.4) scale(0.92)">
        <path
          d="M28 15c-7.2 0-11.4 5.2-11.4 12 0 8-1.8 11.4-4.2 13.8h31.2C41.2 38.4 39.4 35 39.4 27c0-6.8-4.2-12-11.4-12Z"
          fill="#FFFFFF"
          stroke={AQUA}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* 꼭지 */}
        <path d="M28 10.5v4.5" stroke={AQUA} strokeWidth="3" strokeLinecap="round" />
        {/* 추 — 종이 울린다 */}
        <path
          d="M23.6 45a4.4 4.4 0 0 0 8.8 0"
          fill="none"
          stroke={AQUA}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
