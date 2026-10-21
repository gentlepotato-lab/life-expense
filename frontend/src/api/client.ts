import axios from "axios";
import { 요청적기, 느린참 } from "../utils/track";
import { 끊겼다 } from "../utils/adminSession";

/**
 * 서버로 나가는 모든 요청의 공통 앞자락.
 *
 * API는 전부 /api 아래에 모여 있다. 화면(SPA)이 루트를 쓰기 때문에,
 * 앞자락이 없으면 /entries 같은 주소가 화면 경로와 부딪힌다.
 *
 * 개발 서버에서도 같은 값을 쓴다 — Vite가 /api를 백엔드로 넘겨 준다.
 */
const api = axios.create({
  baseURL: "/api",
});

/**
 * 오래 걸리거나 물린 요청을 적는다.
 *
 * 하는 일은 재는 것뿐이다. **원래 흐름은 한 치도 바꾸지 않는다** — 성공은
 * 그대로 흘려보내고, 실패는 같은 오류를 그대로 다시 던진다. 부르는 쪽은
 * 인터셉터가 붙었는지도 모른다.
 *
 * 적는 일이 어긋나도 요청은 멀쩡해야 하므로 재는 자리마다 감싼다. 기록
 * 때문에 화면이 멈추면 그게 더 큰 탈이다.
 */
api.interceptors.request.use((cfg) => {
  try {
    (cfg as { 잰때?: number }).잰때 = performance.now();
  } catch {
    /* 조용히 넘긴다. */
  }
  return cfg;
});

/** 요청 하나를 가리키는 이름. 번호가 든 자리는 뭉뚱그린다. */
function 길이름(cfg: unknown): string {
  const url = (cfg as { url?: string })?.url ?? "";
  const 길 = url.split("?")[0];
  /* /entries/1234/splits처럼 번호가 낀 길은 번호를 지운다. 그러지 않으면
     같은 자리가 수천 가지 이름으로 쌓인다. */
  return 길.replace(/\/\d+/g, "/{id}") || "(없음)";
}

function 걸린참(cfg: unknown): number {
  const 잰때 = (cfg as { 잰때?: number })?.잰때;
  if (typeof 잰때 !== "number") return 0;
  return Math.round(performance.now() - 잰때);
}

api.interceptors.response.use(
  (res) => {
    try {
      const 걸림 = 걸린참(res.config);
      if (걸림 >= 느린참) 요청적기(길이름(res.config), 길이름(res.config), 걸림, res.status);
    } catch {
      /* 조용히 넘긴다. */
    }
    return res;
  },
  (err) => {
    try {
      const cfg = (err as { config?: unknown })?.config;
      const status = (err as { response?: { status?: number } })?.response?.status;
      요청적기(길이름(cfg), 길이름(cfg), 걸린참(cfg), status);
      /* 관리자 끝점이 401로 돌려보내면 토큰이 죽은 것이다. 걷어서 화면이
         자물쇠로 돌아가게 한다. 그러지 않으면 부르는 쪽이 그 401을 "받아 온
         것이 없다"로 받아, 목록을 빈 채로 그려 자료가 사라진 것처럼 보인다.
         관리자 길만 본다. 사용자 화면은 401을 쓰지 않는다. */
      if (status === 401 && String((cfg as { url?: string })?.url ?? "").startsWith("/admin")) {
        끊겼다();
      }
    } catch {
      /* 조용히 넘긴다. */
    }
    /* 같은 오류를 그대로 다시 던진다 — 부르는 쪽의 catch가 지금과 같게 돈다. */
    return Promise.reject(err);
  }
);

export default api;
