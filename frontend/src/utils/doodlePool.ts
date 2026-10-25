/**
 * 쪽지에 들 것들. 서버에서 받아 온다.
 *
 * 안내 줄 쪽지와 앞머리 화면이 번갈아 띄우는 그림과 인사말이다. 관리자
 * 페이지에서 켜고 끌 수 있어야 해서 코드 상수에서 테이블로
 * 옮겼다(backend/sql/2026-10-20_admin_page.sql).
 *
 * **못 받아 오면 코드에 있는 것을 쓴다.** 서버가 죽어도 쪽지는 돌아야
 * 한다. 그래서 기본값을 여기 그대로 들고 있고, 받아 온 것이 오면 그때
 * 갈아 끼운다. 받기 전과 못 받았을 때가 지금 화면과 똑같다.
 *
 * 확률은 PenMark가 맡는다. 여기서는 켜진 것을 차례대로 돌려줄 뿐이다.
 * 갈래로 나누지 않고 한 줄로 늘어놓아야 1/전체가 된다.
 */

import axios from "../api/client";

/** 그림 자국 여덟 가지. 화면이 이 이름으로 어느 그림을 그릴지 선택한다. */
export const 기본꼴들 = ["별", "동그라미", "네모", "세모", "다이아", "하트", "초승달", "돼지꼬리"] as const;

/** 인사말. 새로 연 첫 바퀴에 들고, 그 뒤로도 뽑기에 끼어든다. */
export const 기본인사 = "안녕하세요-! ;-)";

export type 자국꼴 = string;

/** 서버가 보내 온 한 줄. */
type 들온것 = { item_key: string; kind: string; label: string };

/** 지금 쓰는 것. 받기 전에는 코드에 있는 것 그대로다. */
let 꼴목록: string[] = [...기본꼴들];
let 인사목록: string[] = [기본인사];

const 듣는이 = new Set<() => void>();

/** 지금 켜져 있는 그림 자국의 이름들. */
export function 자국들(): string[] {
  return 꼴목록;
}

/** 지금 켜져 있는 인사말들. */
export function 인사들(): string[] {
  return 인사목록;
}

/** 목록이 바뀌면 알린다. 쪽지를 다시 뽑게 한다. */
export function onDoodlePool(f: () => void): () => void {
  듣는이.add(f);
  return () => {
    듣는이.delete(f);
  };
}

let 받는중: Promise<void> | null = null;

/**
 * 한 번 받아 이 모듈에 얹는다.
 *
 * 켜진 것이 하나도 없으면 얹지 않는다. 그림도 인사도 없으면 쪽지가 빈
 * 채로 돌게 되는데, 그러느니 코드에 있는 것을 쓰는 편이 낫다.
 */
export function loadDoodlePool(): Promise<void> {
  if (!받는중) {
    받는중 = axios
      .get("/doodle-items")
      .then((r) => {
        const 온것 = r.data as 들온것[];
        if (!Array.isArray(온것) || 온것.length === 0) return;
        const 그림 = 온것.filter((x) => x.kind === "mark").map((x) => x.label);
        const 인사 = 온것.filter((x) => x.kind === "hello").map((x) => x.label);
        if (그림.length === 0 && 인사.length === 0) return;
        꼴목록 = 그림;
        인사목록 = 인사;
        듣는이.forEach((f) => f());
      })
      .catch(() => {
        /* 조용히 넘긴다. 코드에 있는 것을 그대로 쓴다. */
      });
  }
  return 받는중;
}

/** 관리자 페이지에서 고치고 나면 다시 받는다. */
export function invalidateDoodlePool(): void {
  받는중 = null;
}
