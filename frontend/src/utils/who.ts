/**
 * 이름과 이모지를 화면들이 나눠 쓰는 자리.
 *
 * 돈쓴이에서 담은 것을 서버가 들고 있지만, 꺼내 쓰는 자리가 둘이다 — 안내 줄
 * 오른쪽 끝의 쪽지와, React보다 먼저 서는 앞머리 화면이다. 앞머리는 서버를
 * 부를 수조차 없으므로, 받아 온 값을 브라우저에 한 벌 남기고 거기서 꺼낸다.
 * 설정(utils/prefs.ts)이 쓰는 방식 그대로다.
 *
 * 처음 깐 기기에서는 남은 것이 없어 앞머리에 아무것도 안 뜬다. 돈쓴이를 한
 * 번 열고 나면 그다음부터 뜬다 — 틀린 이름을 띄우느니 안 띄우는 편이 낫다.
 *
 * 열쇠 이름은 index.html의 인라인 글에 적힌 것과 같아야 한다.
 */

import axios from "../api/client";

export type Who = { name: string; emoji: string };

const STORE_KEY = "life-expense:who";

const EMPTY: Who = { name: "", emoji: "" };

/** 브라우저에 한 벌 남긴다. 막혀 있으면 그냥 지나간다. */
export function putWho(who: Who): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(who));
  } catch {
    /* 담을 자리가 막혀 있으면 그대로 움직인다. */
  }
}

/** 남은 것을 꺼낸다. 없거나 깨졌으면 빈 값이다. */
export function getWho(): Who {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return EMPTY;
    const p = parsed as Partial<Who>;
    return {
      name: typeof p.name === "string" ? p.name : "",
      emoji: typeof p.emoji === "string" ? p.emoji : "",
    };
  } catch {
    return EMPTY;
  }
}

/**
 * 쪽지와 앞머리에 적을 글.
 *
 * 이름만 있으면 이름만, 이모지만 있으면 이모지만, 둘 다 없으면 빈 글이다 —
 * 부르는 쪽은 빈 글이면 아예 띄우지 않는다.
 */
export function 누구글(who: Who): string {
  return `${who.name}${who.emoji}`.trim();
}

/**
 * 남은 것이 없으면 서버에서 한 번만 받아 채운다.
 *
 * 돈쓴이를 한 번도 안 연 기기에서는 남은 것이 없다. 그러면 쪽지도 앞머리도
 * 영영 비어 있다 — 설정은 해 두었는데 아무 데도 안 나오는 꼴이다. 그래서
 * 비어 있을 때만 서버를 한 번 두드린다.
 *
 * 이 조각은 모든 화면의 머리말에 서므로, 한 번 부르고 나면 다시 부르지
 * 않는다(부른적). 바꾼 이름은 돈쓴이가 담을 때 갱신하므로 여기서 또 물을
 * 까닭이 없다.
 */
let 부른적 = false;

export async function 누구채우기(): Promise<Who | null> {
  if (부른적) return null;
  부른적 = true;
  const 있는것 = getWho();
  if (있는것.name || 있는것.emoji) return null;
  try {
    const r = await axios.get("/profile");
    const 받은것: Who = {
      name: typeof r.data?.display_name === "string" ? r.data.display_name : "",
      emoji: typeof r.data?.emoji === "string" ? r.data.emoji : "",
    };
    putWho(받은것);
    return 받은것;
  } catch {
    /* 못 받아 오면 이름 없이 간다 — 틀린 이름을 띄우느니 낫다. */
    return null;
  }
}

/**
 * 글 한 자가 먹는 칸 — 글씨 크기를 1로 본 값이다.
 *
 * 어림이 아니라 그 글꼴로 실제 재어 맞춘 값이다. 20px 굵은 글씨로 재니
 * 한글 0.864, 이모지 1.373, 영 대문자 0.620, 숫자 0.615, 영 소문자 0.499,
 * 빈칸 0.301이었다.
 *
 * 쓰는 자리가 둘이다. 쪽지는 이 값으로 글씨 크기를 정하고(PenMark), 돈쓴이는
 * 이름에 더 넣을 수 있는지 가른다. 두 곳이 서로 다른 자로 재면 이름은
 * 들어가는데 쪽지에서는 넘치는 일이 생긴다.
 */
export function 글칸(글: string): number {
  let 합 = 0;
  for (const c of 글) {
    const u = c.codePointAt(0)!;
    /* 이모지는 두 칸짜리(surrogate)이거나 기호 그림 자리에 있다. */
    if (u > 0xffff || (u >= 0x2190 && u <= 0x2bff)) 합 += 1.38;
    else if (u >= 0x1100) 합 += 0.87;
    else if (c === " ") 합 += 0.3;
    /* 대문자와 숫자는 소문자보다 눈에 띄게 넓다 — 한데 묶으면 대문자로만
       적은 이름이 쪽지에서 넘친다. */
    else if ((u >= 0x41 && u <= 0x5a) || (u >= 0x30 && u <= 0x39)) 합 += 0.62;
    else if (u >= 0x61 && u <= 0x7a) 합 += 0.5;
    /* 나머지는 쉼표나 괄호 같은 좁은 기호다. */
    else 합 += 0.38;
  }
  return 합;
}

/**
 * 이름에 넣을 수 있는 자리 — 한글 일곱 자만큼이다.
 *
 * 글자 수로 끊으면 폭이 좁은 영문이 손해를 본다. 한글 일곱 자와 영문 일곱
 * 자는 눈으로 보면 두 배 가까이 차이가 난다. 쪽지에 들어가는 것은 글자 수가
 * 아니라 폭이므로, 폭으로 끊어야 둘 다 제 몫을 쓴다 — 한글은 일곱 자,
 * 영문은 열네 자 남짓이다.
 */
export const 이름자리 = 글칸("가나다라마바사");
