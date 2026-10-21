/**
 * 관리자 자물쇠 — 토큰을 들고 다닌다.
 *
 * 암호가 맞으면 서버가 토큰 한 줄을 준다. 그것을 sessionStorage에 든다 —
 * 창을 닫으면 사라진다. localStorage에 담으면 다음에 열 때도 그대로 열려
 * 있어, 자물쇠를 건 뜻이 옅어진다.
 *
 * 분명히 적는다. 이것은 자물쇠지 인증이 아니다. 주소를 숨기고 암호 한 겹
 * 두는 정도이고, 여럿이 쓰게 될 때 제대로 된 로그인으로 바꿔야 한다.
 */

import axios from "../api/client";
import { 담기, 토큰 } from "./adminSession";

export { 토큰, on끊김 } from "./adminSession";

/** 관리자 끝점을 부를 때 얹는 머리. */
export function 머리(): Record<string, string> {
  const t = 토큰();
  return t ? { "X-Admin-Token": t } : {};
}

/** 암호를 걸어 놓았는지, 첫 암호가 있는지. */
export async function 자물쇠상태(): Promise<{ 걸림: boolean; 첫암호있나: boolean }> {
  const r = await axios.get("/admin/state");
  return { 걸림: !!r.data?.["걸림"], 첫암호있나: !!r.data?.["첫암호있나"] };
}

/** 암호를 보내고 토큰을 받는다. 맞지 않으면 던진다. */
export async function 들어가기(암호: string): Promise<void> {
  const r = await axios.post("/admin/login", { password: 암호 });
  const t = String(r.data?.token ?? "");
  if (!t) throw new Error("토큰을 받지 못했습니다.");
  담기(t);
}

/** 토큰을 걷는다. 서버 쪽도 함께 걷는다. */
export async function 나가기(): Promise<void> {
  const t = 토큰();
  담기("");
  if (!t) return;
  try {
    await axios.post("/admin/logout", {}, { headers: { "X-Admin-Token": t } });
  } catch {
    /* 서버에 못 알려도 이 기기에서는 이미 걷혔다. */
  }
}

/** 암호를 새로 정한다. 바꾸면 들어와 있던 자리가 모두 걷힌다. */
export async function 암호바꾸기(새암호: string): Promise<void> {
  await axios.put("/admin/password", { password: 새암호 }, { headers: 머리() });
  /* 서버가 토큰을 전부 걷었으므로 이 기기 것도 버린다. */
  담기("");
}
