import { useEffect, useRef, useState, type CSSProperties } from "react";
import { getWho, 누구글, 누구채우기 } from "../../utils/who";

/**
 * 안내 한 줄 오른쪽 끝에 서는 만년필 자국.
 *
 * 기다림 그림(Waiting)과 같은 손놀림인데 쓰임이 다르다. 저쪽은 일이 끝날
 * 때까지 돌고, 이쪽은 한 번 쓰고 한참 쉰다 — 7초에 한 번, 쓰는 데는 2.5초쯤
 * 걸린다. 눈을 붙잡으려는 것이 아니라 화면이 살아 있다는 것만 알린다.
 *
 * 폭은 화면 폭을 따라간다. 안내 한 줄이 아래로 접히지만 않으면 되는데 그
 * 여유가 화면마다 다르다 — 가장 긴 안내(설정 첫 화면)를 두고 재니 360px에서
 * 42px, 390px에서 72px, 412px에서 94px이 남았다. 한 값으로 못 박으면 가장
 * 좁은 쪽에 맞춰야 해서 넓은 화면에서 쓸데없이 짧다.
 *
 * 늘어나는 것은 줄뿐이고 끝의 그림은 크기가 그대로다. viewBox를 픽셀과
 * 1:1로 두어 늘려도 찌그러지지 않는다.
 *
 * 머리말 높이에는 손대지 않는다. 띄워서 얹으므로 이것이 있어도 없어도 아래
 * 내용이 서는 자리가 같다.
 *
 * 알려 줄 뜻이 없는 꾸밈이라 읽는 장치에서는 숨긴다.
 */

/**
 * 자국의 폭.
 *
 * 설정 첫 화면의 안내를 두고 재니 한 줄을 지키면서 내줄 수 있는 자리가
 * 360px에서 42px, 390px에서 72px, 412px에서 94px이었다 — 화면 폭에서 318을
 * 뺀 값이다. 2px을 더 접고, 자국과 글 사이 틈 8px을 뺀다.
 */
function 자국폭(화면: number): number {
  return Math.max(32, Math.min(112, Math.round(화면 - 328)));
}

/**
 * 쪽지 폭 — 그림 칸과 종이가 같은 네모다.
 *
 * 종이만 넓히고 그림 칸을 그대로 두면 펜이 종이의 오른쪽 토막에서만 오가고,
 * 글이 드러나는 끝과 펜촉도 어긋난다. 한 네모로 묶어 둘이 같은 자리를 쓴다.
 *
 * 자국폭보다 14px 길다. 안내 글이 비울 틈은 여기에 6px을 더해 잡는다 —
 * 가장 긴 안내(설정 첫 화면 291px)를 두고 재도 400px 화면에서 남는다.
 */
function 쪽지폭(화면: number): number {
  return 자국폭(화면) + 14;
}

/** 자국이 그려지는 상자. 줄은 YB에 놓이고 끝 그림은 그 위 S칸을 꽉 채운다. */
const 높이 = 36;
const YB = 28;
const 여백 = 1.5;
/** 끝 그림이 쓰는 네모. 여덟 가지가 모두 이 한 칸을 같게 채운다. */
const S = 15;

const 꼴들 = ["별", "동그라미", "네모", "세모", "다이아", "하트", "초승달", "돼지꼬리"] as const;
export type 자국꼴 = (typeof 꼴들)[number];

/**
 * 하트 곡선.
 *
 * x = 16sin³t, y = 17cos t − 4cos2t − 3cos3t − cos4t. 아래 끝(t=π)과 가운데
 * 패인 데(t=2π)에서 x와 y의 기울기가 함께 0이 되어 저절로 뾰족해지고, 나머지
 * 자리는 끊긴 데가 없어 매끄럽다.
 *
 * y의 네 수는 흔히 쓰는 13·5·2·1이 아니다. 그 꼴은 아래가 길고 가늘어 15px에
 * 2.3 굵기로 그으면 뭉개진다. 손으로 잇던 하트의 비례를 재서(패인 데 0.82,
 * 가장 넓은 자리 0.65, 키의 1/4 높이에서 반폭 0.28) 그 값에 가장 가까운 네
 * 수를 골랐다 — 0.819 / 0.643 / 0.290으로 거의 그대로다.
 *
 * 틀이 정해진 꼴이라 테두리는 한 번만 잰다.
 */
const 하트X = (t: number) => 16 * Math.sin(t) ** 3;
const 하트Y = (t: number) =>
  17 * Math.cos(t) - 4 * Math.cos(2 * t) - 3 * Math.cos(3 * t) - Math.cos(4 * t);
const 하트기울X = (t: number) => 48 * Math.sin(t) ** 2 * Math.cos(t);
const 하트기울Y = (t: number) =>
  -17 * Math.sin(t) + 8 * Math.sin(2 * t) + 9 * Math.sin(3 * t) + 4 * Math.sin(4 * t);
const 하트끝 = (() => {
  let 아래 = Infinity;
  let 위 = -Infinity;
  for (let i = 0; i <= 720; i += 1) {
    const v = 하트Y((i * Math.PI) / 360);
    if (v < 아래) 아래 = v;
    if (v > 위) 위 = v;
  }
  return { 아래, 위 };
})();

/* 소수 한 자리면 15px짜리 꼴에서 0.1px씩 끊겨 둥근 데가 울퉁불퉁해 보인다. */
const 쪽 = (v: number) => v.toFixed(2);
const 점 = (x: number, y: number) => `L${쪽(x)} ${쪽(y)}`;
const 굽이 = (p: number[]) => `C${p.map(쪽).join(" ")}`;
const 호 = (r: number, 큰: number, 돎: number, x: number, y: number) =>
  `A${쪽(r)} ${쪽(r)} 0 ${큰} ${돎} ${쪽(x)} ${쪽(y)}`;

/**
 * 쭉 그은 줄에 그림 하나를 이어 붙인 한 획.
 *
 * 여덟 가지 모두 펜을 떼지 않고 한 번에 그린다 — 줄이 끝나는 자리에서
 * 그대로 이어진다. 그래야 줄과 그림이 한 path가 되어 그어지는 시늉
 * (stroke-dashoffset)과 펜의 길(offset-path)을 하나로 쓴다.
 *
 * 모두 같은 네모(S×S)를 채운다. 꼴마다 크기가 들쭉날쭉하면 7초마다 그림이
 * 커졌다 작아졌다 해서 눈에 걸린다.
 */
/**
 * 글이 드는 바퀴에 긋는 민줄.
 *
 * 끝의 그림 없이 왼쪽 끝에서 오른쪽 끝까지 곧게 간다 — 글 아래에 밑줄이
 * 그어지는 꼴이다. 끝 그림을 함께 두면 글과 그림이 좁은 쪽지 안에서 겹친다.
 */
function 민줄(폭: number): string {
  return `M${여백} ${YB} L${폭 - 여백} ${YB}`;
}

function 한획(폭: number, 꼴: 자국꼴): string {
  const 머리 = `M2 ${YB}`;
  const 끝 = 폭 - 여백 - S;
  const 위 = YB - S;
  const cx = 끝 + S / 2;

  /* 하트와 초승달은 24칸 상자에 그린 꼴을 그대로 줄여 옮긴다. */
  const 옮김 = () => {
    const k = S / 18;
    return {
      X: (x: number) => 끝 + (x - 3) * k,
      Y: (y: number) => YB - (21 - y) * k,
      k,
    };
  };

  if (꼴 === "네모") {
    return [머리, 점(끝, YB), 점(끝, 위), 점(끝 + S, 위), 점(끝 + S, YB), 점(끝, YB)].join(" ");
  }

  if (꼴 === "세모") {
    return [머리, 점(끝, YB), 점(cx, 위), 점(끝 + S, YB), 점(끝, YB)].join(" ");
  }

  if (꼴 === "다이아") {
    return [머리, 점(cx, YB), 점(끝 + S, YB - S / 2), 점(cx, 위), 점(끝, YB - S / 2), 점(cx, YB)].join(" ");
  }

  if (꼴 === "동그라미") {
    const r = S / 2;
    /* 호 둘로 한 바퀴. 한 호로는 시작과 끝이 같은 점이라 그려지지 않는다. */
    return [머리, 점(cx, YB), 호(r, 1, 1, cx, 위), 호(r, 1, 1, cx, YB)].join(" ");
  }

  if (꼴 === "별") {
    /* 꼭짓점을 하나 건너뛰며 돌면 다섯 선으로 제자리에 돌아온다. 그래서
       펜을 떼지 않고 줄에서 별까지 이어 그을 수 있다.

       정오각별은 폭보다 키가 작다(1.902r 대 1.809r). 다른 일곱이 S칸을 꽉
       채우는데 혼자 2px 낮으면 7초마다 그림이 주저앉아 보여, 세로만 살짝
       늘려 같은 칸을 채운다. */
    const rx = S / 1.902;
    const ry = S / 1.809;
    const cy = YB - (0.809 / 1.809) * S;
    const 꼭 = (k: number) => {
      const a = ((90 + 72 * k) * Math.PI) / 180;
      return [cx + rx * Math.cos(a), cy - ry * Math.sin(a)] as const;
    };
    return [머리, ...[2, 4, 1, 3, 0, 2].map((k) => 점(...꼭(k)))].join(" ");
  }

  if (꼴 === "하트") {
    /* 굽이를 손으로 이어 붙이면 이은 자리마다 휘는 정도가 턱턱 바뀌어
       울퉁불퉁해 보인다. 기울기는 맞췄는데도 그렇다 — 눈에 걸리는 것은
       기울기가 아니라 휘는 정도다.

       그래서 손으로 잡지 않고 하트 곡선을 그대로 따라 그린다. 끊긴 데가
       없는 한 가닥이라 울퉁불퉁할 자리가 아예 없고, 아래 뾰족한 끝과
       가운데 패인 데에서만 저절로 뾰족해진다 — 하트에 있어야 할 꼭 두
       군데다. 굽이 열여섯 토막은 곡선을 베껴 뜬 것일 뿐 꼴을 정하지
       않는다. 각 토막의 잡는 점은 그 자리의 기울기에서 바로 나온다. */
    const 사이 = (Math.PI * 2) / 16;
    const 가로 = S / 32;
    const 세로 = S / (하트끝.위 - 하트끝.아래);
    const 자리 = (t: number) =>
      [cx + 하트X(t) * 가로, YB - (하트Y(t) - 하트끝.아래) * 세로] as const;
    /* 화면은 아래가 커지는 쪽이라 세로 기울기만 뒤집는다. */
    const 기울 = (t: number) =>
      [하트기울X(t) * 가로, -하트기울Y(t) * 세로] as const;
    const 토막: string[] = [];
    for (let i = 0; i < 16; i += 1) {
      const t0 = Math.PI + i * 사이;
      const t1 = t0 + 사이;
      const [x0, y0] = 자리(t0);
      const [x1, y1] = 자리(t1);
      const [dx0, dy0] = 기울(t0);
      const [dx1, dy1] = 기울(t1);
      토막.push(
        굽이([
          x0 + (dx0 * 사이) / 3,
          y0 + (dy0 * 사이) / 3,
          x1 - (dx1 * 사이) / 3,
          y1 - (dy1 * 사이) / 3,
          x1,
          y1,
        ])
      );
    }
    return [머리, 점(cx, YB), ...토막].join(" ");
  }

  if (꼴 === "초승달") {
    /* 큰 원을 한 바퀴 돌아 작은 원으로 살을 파낸다. 두 원이 만나는 두 점이
       달의 뿔이다. 바닥 점에서 시작해 제자리로 돌아온다. */
    const { X, Y, k } = 옮김();
    return [
      머리,
      점(X(12), Y(21)),
      호(9 * k, 1, 1, X(11.21), Y(3)),
      호(7 * k, 0, 0, X(21), Y(12.79)),
      호(9 * k, 0, 1, X(12), Y(21)),
    ].join(" ");
  }

  /* 돼지꼬리 — 한 바퀴 크게 돌고 안으로 말려 든다. 여덟 가운데 제자리로
     돌아오지 않는 하나인데, 꼬리란 본디 어딘가에서 멎는 것이라 그 편이 맞다. */
  return [
    머리,
    점(끝, YB),
    굽이([끝 - S * 0.06, YB - S * 1.22, 끝 + S * 1.14, YB - S * 1.2, 끝 + S * 0.92, YB - S * 0.55]),
    굽이([끝 + S * 0.72, YB - S * 0.1, 끝 + S * 0.12, YB - S * 0.3, 끝 + S * 0.34, YB - S * 0.66]),
    굽이([끝 + S * 0.5, YB - S * 0.9, 끝 + S * 0.8, YB - S * 0.8, 끝 + S * 0.72, YB - S * 0.62]),
  ].join(" ");
}

/** 방금 그린 것과 다른 것으로 고른다. 같은 것이 잇달아 나오면 안 바뀐 줄 안다. */
function 다음꼴(이전: 자국꼴): 자국꼴 {
  const 남은 = 꼴들.filter((k) => k !== 이전);
  return 남은[Math.floor(Math.random() * 남은.length)];
}

/**
 * 한 바퀴에 무엇이 드는가.
 *
 *   첫인사 — 화면을 새로 연 뒤 첫 바퀴. 늘 `안녕하세요-! ;-)`다.
 *   자국   — 지금까지 하던 그 한 획.
 *   이름   — 설정한 이름과 이모지.
 *
 * 첫 바퀴가 지나면 자국과 이름을 바퀴마다 무작위로 고른다. 둘로 번갈아만
 * 두면 다음에 무엇이 올지 뻔히 읽혀, 그 자리를 더는 쳐다보지 않게 된다.
 */
type 바퀴 = "첫인사" | "자국" | "이름";

/** 첫 바퀴에 적는 글. 이름을 설정하지 않았어도 이것만은 뜬다. */
const 첫인사말 = "안녕하세요-! ;-)";

/** 쪽지 안에서 글 양옆으로 비우는 자리. */
const 옆여백 = 6;

/**
 * 글 한 자가 먹는 칸 — 글씨 크기를 1로 본 값이다.
 *
 * 실제로 재어 맞췄다. 이모지 하나가 14px에서 19px이라 1.36, 한글 한 자가
 * 같은 크기에서 12px이라 0.86이다. 영문과 기호는 그 절반에 못 미치고 빈칸은
 * 더 좁다. 한글과 이모지를 같은 값으로 치면 한글만 적은 글이 쓸데없이 작게
 * 나온다 — 일곱 자가 10px로 떨어져 쪽지의 삼분의 이만 썼다.
 */
function 글칸(글: string): number {
  let 합 = 0;
  for (const c of 글) {
    const u = c.codePointAt(0)!;
    /* 이모지는 두 칸짜리(surrogate)이거나 기호 그림 자리에 있다. */
    if (u > 0xffff || (u >= 0x2190 && u <= 0x2bff)) 합 += 1.4;
    else if (u >= 0x1100) 합 += 0.88;
    else if (c === " ") 합 += 0.3;
    else 합 += 0.42;
  }
  return 합;
}

/**
 * 쪽지에 적을 글씨 크기.
 *
 * 글자 수가 적으면 키워서 쪽지를 채운다 — `젠포🎩` 석 자를 10px로 적으면
 * 쪽지의 삼분의 일만 쓰고 휑하다. 들어갈 만큼까지만 키우고, 그래도 넘치면
 * 가장 작은 10px에서 멈춘다(그 아래로는 읽기 어렵다).
 */
function 글크기(글: string, 폭: number): number {
  /* 좌우로 6px씩 비운다. 글이 가장 길 때 꼭 이 자리를 채우므로, 그때 왼쪽과
     오른쪽에 남는 자리가 같아져 가운데 맞춤처럼 보인다. */
  const 쓸자리 = 폭 - 옆여백 * 2;
  const 칸 = Math.max(글칸(글), 1);
  /* 정수로 끊으면 남는 자리가 한쪽으로 쏠린다 — 11px로 끊긴 글이 자리를 다
     못 채워 오른쪽만 넓어졌다. 0.1px까지 재단해 자리에 딱 맞춘다.
     0.97은 글칸으로 셈한 폭과 실제로 그려지는 폭의 차를 메운다. */
  const 재단 = 쓸자리 / (칸 * 0.97);
  return Math.max(10, Math.min(14, Math.round(재단 * 10) / 10));
}

/**
 * 첫인사를 이미 했는가.
 *
 * 이 조각은 화면을 옮길 때마다 새로 선다. 상태에 담아 두면 탭을 누를 때마다
 * 첫인사가 다시 떠, "앱을 새로 열었을 때"라는 뜻을 잃는다. 조각 바깥에 두어
 * 앱이 떠 있는 동안 한 번만 하게 한다.
 */
let 첫인사했나 = false;

export default function PenMark() {
  const [폭, set폭] = useState(() =>
    쪽지폭(typeof document === "undefined" ? 360 : document.documentElement.clientWidth)
  );
  const [꼴, set꼴] = useState<자국꼴>(() => 꼴들[Math.floor(Math.random() * 꼴들.length)]);
  /* 앱을 새로 연 뒤 첫 바퀴만 첫인사다. 화면을 옮겨 다시 설 때는 바로
     자국과 이름으로 간다. */
  const [바퀴, set바퀴] = useState<바퀴>(() => (첫인사했나 ? "자국" : "첫인사"));
  const 줄ref = useRef<SVGPathElement | null>(null);

  /* 이름은 브라우저에 남은 것을 꺼내 쓴다. 이 조각은 모든 화면의 머리말에
     서므로 화면마다 서버를 부르면 같은 것을 수십 번 묻게 된다(utils/who.ts).
     남은 것이 없는 기기에서는 누구채우기가 한 번만 서버를 두드려 채운다. */
  const [이름글, set이름글] = useState(() => 누구글(getWho()));

  useEffect(() => {
    let 살아있나 = true;
    void 누구채우기().then((받은것) => {
      if (살아있나 && 받은것) set이름글(누구글(받은것));
    });
    return () => {
      살아있나 = false;
    };
  }, []);

  /* 안내 글이 비울 자리도 여기서 정한다. CSS가 100vw로 따로 셈하면
     굴림대가 있는 화면에서 둘이 어긋나, 글이 자국 밑으로 깔린다. */
  useEffect(() => {
    const 재기 = () => {
      const w = 쪽지폭(document.documentElement.clientWidth);
      set폭(w);
      document.documentElement.style.setProperty("--doodle-room", `${w + 6}px`);
    };
    재기();
    window.addEventListener("resize", 재기);
    return () => window.removeEventListener("resize", 재기);
  }, []);

  /* 한 바퀴가 끝날 때마다 다음에 들 것을 고른다. 7초 가운데 4초 남짓은
     아무것도 보이지 않는 쉬는 참이라, 그때 바뀌어도 눈에 걸리지 않는다.

     줄은 인사가 뜨는 바퀴에도 그대로 돈다 — 보이지만 않을 뿐이다. 이 줄의
     한 바퀴가 시계 노릇을 하므로, 멈춰 세우면 다음 바퀴가 오지 않는다. */
  useEffect(() => {
    const el = 줄ref.current;
    if (!el) return;
    const 한바퀴 = () => {
      set꼴((전) => 다음꼴(전));
      첫인사했나 = true;
      /* 이름도 이모지도 없으면 인사 바퀴를 건너뛰고 자국만 돈다. */
      set바퀴(이름글 ? (Math.random() < 0.5 ? "자국" : "이름") : "자국");
    };
    el.addEventListener("animationiteration", 한바퀴);
    return () => el.removeEventListener("animationiteration", 한바퀴);
  }, [이름글]);

  /* 이 바퀴에 적을 글. 빈 글이면 자국이 드는 바퀴다. */
  const 적을글 = 바퀴 === "첫인사" ? 첫인사말 : 바퀴 === "이름" ? 이름글 : "";
  /* 글이 드는 바퀴에는 끝 그림 없이 곧은 줄만 긋는다. 펜은 이 길을 타고
     가므로, 길을 바꾸면 펜이 가는 결도 함께 바뀐다. */
  const 길 = 적을글 ? 민줄(폭) : 한획(폭, 꼴);

  return (
    <span
      className={`page-doodle${적을글 ? " page-doodle--say" : ""}`}
      aria-hidden="true"
      style={{ width: `${폭}px` }}
    >
      {/* 글 칸은 자국이 드는 바퀴에도 그대로 세워 둔다.

          바퀴마다 새로 세우면 그 칸의 움직임도 그때부터 센다 — 기다림(3.3초)이
          다시 걸려 펜만 먼저 긋고 글은 한참 뒤에 튀어나왔다. 한 번 세워 두고
          글자만 갈아 끼우면 줄과 같은 참에 들고 난다. */}
      <span
        className="page-doodle__say"
        style={{ "--doodle-say-size": `${글크기(적을글 || "가", 폭)}px` } as CSSProperties}
      >
        {적을글}
      </span>
      <svg viewBox={`0 0 ${폭} ${높이}`} focusable="false">
        <path ref={줄ref} className="page-doodle__line" pathLength={100} d={길} />
        <g className="page-doodle__pen" style={{ offsetPath: `path("${길}")` }}>
          <g transform="rotate(26) scale(0.66)">
            {/* 펜대 — 아래가 굵고 위로 좁아지는 몸통. 잉크와 같은 빛깔이면
                그은 줄과 구분이 안 되므로 닙과 같은 빛깔로 채운다. */}
            <path className="page-doodle__body" d="M-2.6 -14 L-2.2 -29 Q0 -31.5 2.2 -29 L2.6 -14 Z" />
            <path className="page-doodle__nib" d="M0 0 L-4.2 -11.5 Q0 -15.5 4.2 -11.5 Z" />
            <path className="page-doodle__slit" d="M0 0 V-9" />
          </g>
        </g>
      </svg>
    </span>
  );
}
