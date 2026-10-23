/**
 * 메인 탭 첫 쪽의 칸마다 들어가는 그림.
 *
 * 사용자 사이트의 홈 그림과 같은 잣대로 그린다(HomeArt.tsx). 같은 상자에
 * 같은 두께(3.2)다. 빛깔도 그쪽이 쓰는 세 변수를 그대로 가리킨다. 관리자
 * 쪽에서는 그 값을 보라 한 결로 내려 주므로(index.css), 여기서는 변수만
 * 가리키고 값을 적지 않는다.
 *
 * **상자와 그림이 서는 자리가 칸 꼴마다 다르다.**
 *   반 칸(나란히 둘). 96×72 상자에 그림을 가운데로 모은다. 칸이 그림을
 *     가운데에 세우므로(.home-card--half .home-card__art), 상자 안에서
 *     치우쳐 있으면 그만큼 삐뚤어 보인다. 돈쓴이 그림과 같은 꼴이다.
 *   넓은 칸(한 줄 하나). 140×72 상자에 그림의 오른쪽 끝을 x=100에 맞춘다.
 *     칸이 그림을 오른쪽에 붙여 세우므로(justify-content: flex-end), 여러
 *     칸의 그림이 같은 세로줄에서 끝나려면 그 끝이 같아야 한다. 씀씀이와
 *     잔소리와 어디 쓰나가 모두 그 자리에서 끝난다.
 */

const INK = "var(--art-ink)";
const AQUA = "var(--art-aqua)";
const TINT = "var(--art-tint)";

/**
 * 대시보드의 그림. 계기판이다.
 *
 * 막대와 꺾은선으로 그렸다가 다시 그렸다. 씀씀이 그림이 바로 그 꼴이라
 * (HomeArt.tsx의 ArtChart) 두 사이트에 같은 그림이 둘 선 꼴이었다.
 *
 * 계기판으로 바꾼 까닭은 대시보드라는 말이 본디 그것이기 때문이다. 바늘
 * 하나로 "지금 얼마나"를 말하므로, 여러 날을 늘어놓는 씀씀이의 막대와
 * 하는 말도 갈린다.
 *
 * 가운데는 (48, 50), 반지름은 30이다. 바늘과 축까지 넣으면 그림이 y 20에서
 * 53.5까지라, 상자 가운데(36)와 거의 맞아떨어진다.
 */
export function ArtDash() {
  return (
    <svg className="home-art home-art--admin" viewBox="0 0 96 72" aria-hidden="true">
      {/* 눈금판. 반 바퀴다. 옅은 빛으로 깔고 그 위에 지나온 만큼을 덧긋는다. */}
      <path
        d="M18 50A30 30 0 0 1 78 50"
        fill="none"
        stroke={TINT}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {/* 지나온 만큼. 왼쪽 끝에서 바늘이 선 자리까지다. */}
      <path
        d="M18 50A30 30 0 0 1 65.2 25.4"
        fill="none"
        stroke={INK}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {/* 눈금 다섯. 눈금판 안쪽으로 짧게 긋는다. */}
      <g stroke={TINT} strokeWidth="2" strokeLinecap="round">
        <path d="M22 50h4M29.6 31.6l2.8 2.8M48 24v4M66.4 31.6l-2.8 2.8M70 50h4" />
      </g>
      {/* 바늘과 축. */}
      <path d="M48 50L61.8 30.3" stroke={AQUA} strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="48" cy="50" r="3.5" fill={INK} />
    </svg>
  );
}

/**
 * 액션 기록의 그림. 쌓인 줄과 그것을 들여다보는 돋보기다.
 *
 * 줄머리의 점이 "한 줄씩 쌓인 것"을 말하고, 돋보기가 "한 줄씩 들여다보는
 * 자리"를 말한다. 반 칸이라 96 상자 가운데로 모은다.
 */
export function ArtLogs() {
  return (
    <svg className="home-art home-art--admin" viewBox="0 0 96 72" aria-hidden="true">
      {/* 줄은 돋보기 왼쪽에서 멈춘다. 겹쳐 놓으니 알이 줄 위에 얹혀
          무엇을 보는 그림인지 흐려졌다. */}
      <g stroke={TINT} strokeWidth="3.2" strokeLinecap="round">
        <path d="M21 14h43M21 25h43M21 36h27" />
      </g>
      <g fill={INK}>
        <circle cx="14" cy="14" r="3" />
        <circle cx="14" cy="25" r="3" />
        <circle cx="14" cy="36" r="3" />
      </g>
      <circle cx="70" cy="47" r="10" fill="none" stroke={INK} strokeWidth="3.2" />
      <path d="M77.1 54.1L84 61" stroke={AQUA} strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 사용자의 그림. 다섯이 겹쳐 선 모습이다.
 *
 * 둘만 세웠던 때는 「사용자」가 아니라 「둘」로 읽혔다. 여럿을 보는 자리라
 * 사람 수가 그림에서도 여럿이어야 한다.
 *
 * 다섯이 저마다 다르게 생겼다. 머리 크기도 어깨 너비도 선 굵기도 하나씩
 * 다르다. 같은 사람을 다섯 번 찍어 놓으면 사람이 여럿인 것이 아니라 한
 * 사람이 되풀이되는 것으로 보인다. 앞에 선 하나만 어깨가 넓고, 나머지는
 * 좁게 그려 앞엣것이 떡 벌어져 보이지 않게 한다.
 *
 * 뒤엣것은 옅은 빛, 앞엣것은 짙은 빛이다. 앞뒤를 크기로만 가르면 작은 쪽이
 * 멀리 선 것이 아니라 어린 사람으로 보인다.
 *
 * 겹치는 자리마다 바탕빛으로 한 번 더 긋고 그 위에 제 빛으로 긋는다. 선으로
 * 그린 사람이 겹치면 획이 서로를 가로질러 뒤엉키는데, 바탕빛 테가 뒤엣것을
 * 끊어 주어 앞뒤가 갈린다.
 *
 * 넓은 칸이라 140 상자에 그리고 x를 14에서 100 사이에 가둔다. 오른쪽 끝만
 * 맞추고 좁게 그렸더니, 오른쪽에 붙여 세우는 칸에서 그림이 다른 칸들보다
 * 9px 더 오른쪽으로 치우쳐 보였다. 씀씀이와 잔소리와 어디 쓰나가 모두 그
 * 폭을 꽉 채운다.
 */
/**
 * 그림에 설 다섯 사람.
 *
 * 뒤에서 앞으로 적는다. 적은 차례대로 그리므로 뒤엣것부터 깔려야 앞엣것이
 * 그 위에 선다.
 *
 * 테는 앞으로 나온 셋만 두른다. 맨 뒤엣것은 가릴 것이 없다.
 */
const 사람들 = [
  { cx: 46, cy: 18, r: 6, 어깨: 12, 바닥: 45, 들림: 9, 굵기: 2.6, 빛: TINT, 테: false },
  { cx: 74, cy: 20, r: 6.5, 어깨: 13, 바닥: 47, 들림: 10, 굵기: 2.6, 빛: TINT, 테: false },
  { cx: 31, cy: 27, r: 7.5, 어깨: 17, 바닥: 60, 들림: 16, 굵기: 3, 빛: AQUA, 테: true },
  { cx: 86, cy: 28, r: 8, 어깨: 14, 바닥: 60, 들림: 18, 굵기: 3, 빛: AQUA, 테: true },
  { cx: 57, cy: 32, r: 9, 어깨: 22, 바닥: 60, 들림: 21, 굵기: 3.2, 빛: INK, 테: true },
];

/**
 * 어깨 한 줄.
 *
 * 양 끝에서 올라와 머리 밑에서 평평해진다. 처음 세운 사람의 어깨를 치수만
 * 바꿔 쓴 것이라, 다섯이 같은 손으로 그린 것으로 보인다.
 */
const 어깨선 = (사람: (typeof 사람들)[number]) => {
  const { cx, 어깨: w, 바닥: y, 들림: h } = 사람;
  const 끝 = (n: number) => Math.round(n * 10) / 10;
  return (
    `M${cx - w} ${y}c0-${끝(h * 0.61)} ${끝(w * 0.45)}-${h} ${w}-${h}` +
    `s${w} ${끝(h * 0.39)} ${w} ${h}`
  );
};

export function ArtUsers() {
  /* 겹치는 자리를 끊는 테. 카드 바탕과 같은 빛이라 끊긴 자리가 비어 보인다. */
  const 테 = { fill: "none", stroke: "var(--color-surface)" };

  return (
    <svg className="home-art" viewBox="0 0 140 72" aria-hidden="true">
      {사람들.map((사람) => (
        <g key={사람.cx} fill="none" strokeLinecap="round">
          {사람.테 && (
            <>
              {/* 바탕빛 테를 먼저 긋는다. 뒤엣것이 이 선 밑에서 끊긴다. */}
              <circle
                cx={사람.cx}
                cy={사람.cy}
                r={사람.r}
                strokeWidth={사람.굵기 + 3.2}
                {...테}
              />
              <path d={어깨선(사람)} strokeWidth={사람.굵기 + 3.2} {...테} />
            </>
          )}
          <circle
            cx={사람.cx}
            cy={사람.cy}
            r={사람.r}
            stroke={사람.빛}
            strokeWidth={사람.굵기}
          />
          <path d={어깨선(사람)} stroke={사람.빛} strokeWidth={사람.굵기} />
        </g>
      ))}
    </svg>
  );
}
