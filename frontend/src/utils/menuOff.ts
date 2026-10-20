/**
 * 꺼 놓은 메뉴를 서버에서 한 번 받는다.
 *
 * 받은 것은 menuRegistry에 얹는다. 화면마다 따로 받으면 메뉴를 그릴 때마다
 * 요청이 나간다. 설정(utils/prefs.ts)을 받는 방식 그대로다.
 *
 * 못 받아 오면 아무것도 얹지 않는다. 빈 목록은 "전부 켜짐"이고, 그것이 지금
 * 화면과 같은 상태다 — 메뉴가 통째로 사라지느니 전부 켜진 채로 두는 편이
 * 낫다.
 */

import axios from "../api/client";
import { putMenuOff } from "./menuRegistry";

let 받는중: Promise<void> | null = null;

export function loadMenuOff(): Promise<void> {
  if (!받는중) {
    받는중 = axios
      .get("/admin/prefs")
      .then((r) => {
        const 목록 = r.data?.menu_off;
        if (Array.isArray(목록)) putMenuOff(목록.map(String));
      })
      .catch(() => {
        /* 조용히 넘긴다. 전부 켜진 채로 둔다. */
      });
  }
  return 받는중;
}

/** 관리자 페이지에서 고치고 나면 다시 받는다. */
export function invalidateMenuOff(): void {
  받는중 = null;
}
