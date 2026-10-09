import { useEffect, useState } from "react";
import axios from "../api/client";

/**
 * 적어 둔 것이 걸쳐 있는 연월의 처음과 끝.
 *
 * 달을 넘겨 보는 화면(지출 내역 · 묶은 내역 · 씀씀이 · 안쓴이 도전)이
 * 어디까지 거슬러 갈 수 있는지를 여기서 한 벌로 받는다. 화면마다 제 나름의
 * 바닥을 잡으면 같은 ‹ 를 눌렀는데 어떤 화면은 더 가고 어떤 화면은 멈춘다.
 *
 * 한 번 받아 두고 돌려 쓴다 — 적은 날의 처음은 쓰는 동안 거의 바뀌지 않고,
 * 바뀌어도 더 앞으로만 간다(새로 적은 것이 과거일 때). 그 한 달을 더 보려면
 * 화면을 다시 열면 된다.
 */

/** 앞으로 몇 달까지 넘어갈 수 있는가 — 아직 오지 않은 달은 빈 화면이다. */
export const AHEAD = 2;

type Span = { first: string | null; last: string | null };

let 담은것: Span | null = null;
let 받는중: Promise<Span> | null = null;

async function 받기(): Promise<Span> {
  const r = await axios.get("/entries/span");
  return { first: r.data?.first_ym ?? null, last: r.data?.last_ym ?? null };
}

/** 이 달에서 step만큼 옮긴 연월 'YYYY-MM' */
export function 옮긴달(ym: string, step: number): string {
  const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + step, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 오늘의 'YYYY-MM' */
export function 이번달(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 넘겨 볼 수 있는 맨 앞 · 맨 뒤 연월.
 *
 * 뒤는 늘 이 달 + {@link AHEAD}개월이다. 앞은 처음 적은 달인데, 아직 받아
 * 오기 전이면 가두지 않는다 — 가둬 두면 화면이 뜨자마자 ‹ 가 잠겨 보였다가
 * 풀리는 깜박임이 생긴다.
 */
export default function useMonthSpan(): { min: string | null; max: string } {
  const [span, setSpan] = useState<Span | null>(담은것);

  useEffect(() => {
    if (담은것) return;
    if (!받는중) {
      받는중 = 받기()
        .then((v) => {
          담은것 = v;
          return v;
        })
        .catch(() => ({ first: null, last: null }))
        .finally(() => {
          받는중 = null;
        });
    }
    let 살아있나 = true;
    받는중.then((v) => {
      if (살아있나) setSpan(v);
    });
    return () => {
      살아있나 = false;
    };
  }, []);

  return { min: span?.first ?? null, max: 옮긴달(이번달(), AHEAD) };
}
