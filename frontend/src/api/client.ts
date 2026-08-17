import axios from "axios";

/**
 * 서버로 나가는 모든 요청의 공통 앞자락.
 *
 * API 는 전부 /api 아래에 모여 있다. 화면(SPA)이 루트를 쓰기 때문에,
 * 앞자락이 없으면 /entries 같은 주소가 화면 경로와 부딪힌다.
 *
 * 개발 서버에서도 같은 값을 쓴다 — Vite 가 /api 를 백엔드로 넘겨 준다.
 */
const api = axios.create({
  baseURL: "/api",
});

export default api;
