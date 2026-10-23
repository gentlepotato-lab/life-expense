import { useCallback, useMemo, useState } from "react";
import { say } from "../utils/notify";

/**
 * 관리자 사이트가 「언제 것을 보는가」를 쥐는 자리.
 *
 * 대시보드가 혼자 쥐고 있던 것을 여기로 옮긴다. 액션 기록과 공지와 배치
 * 이력과 외부 API와 DB가 같은 꼴로 달을 넘기고 같은 꼴로 거른다. 쪽마다
 * 따로 적었더니 어떤 쪽은 달을 넘기고 어떤 쪽은 날짜만 받아, 같은 사이트인데
 * 보는 법이 쪽마다 달랐다.
 *
 * 쥐는 것은 둘이다. 보고 있는 달(ym)과 거르기로 걸린 기간이다. 기간이
 * 걸리면 달은 보지 않는다.
 *
 * 최근 며칠 알약이 있던 자리는 걷었다. 달 단위가 기본이고 그 밖은 필터로
 * 고르므로, 같은 일을 하는 자리가 둘일 까닭이 없다.
 *
 * 상세 쪽으로 넘어갈 때는 이 셋을 그대로 실어 보내고(담기), 돌아올 때도
 * 그대로 받는다(처음). 사용자 사이트의 기간 상세가 거르기를 싣고 다니는
 * 것과 같은 잣대다(pages/CalendarDetail.tsx).
 */

export type 기간 = { frm: string; to: string };

/** 상세 쪽으로 실어 보내는 짐. 돌아올 때 그대로 되돌린다. */
export type 기간짐 = { ym: string; range: 기간 | null };

/** YYYY-MM-DD로 적는다. 서버가 날짜만 받는다. */
export const 날적기 = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

/** 이번 달 'YYYY-MM'. */
export function 이번달(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 그 달의 첫날과 끝날. 끝날이 오늘보다 뒤면 오늘까지만 본다. */
export function 달기간(ym: string): 기간 {
  const [y, m] = ym.split("-").map(Number);
  const 첫날 = new Date(y, m - 1, 1);
  const 끝날 = new Date(y, m, 0);
  const 오늘 = new Date();
  오늘.setHours(0, 0, 0, 0);
  return { frm: 날적기(첫날), to: 날적기(끝날 > 오늘 ? 오늘 : 끝날) };
}

export default function useAdminPeriod(처음?: 기간짐 | null) {
  const [ym, setYm] = useState(처음?.ym ?? 이번달());
  /* 거르기로 걸린 기간. 달 단위로는 못 보는 자리를 보려고 거르는 것이므로,
     걸리면 달은 보지 않는다. */
  const [거른기간, set거른기간] = useState<기간 | null>(처음?.range ?? null);

  const 기간 = useMemo(
    () => 거른기간 ?? 달기간(ym),
    [거른기간, ym]
  );

  /** 달을 넘긴다. 거르기는 풀린다. */
  const 달바꾸기 = useCallback((v: string) => {
    set거른기간(null);
    setYm(v);
  }, []);

  /**
   * 거르기로 받은 날짜 둘을 건다.
   *
   * 둘 다 비면 거르기를 풀고 달 단위로 돌아간다. 하나만 넣은 것은 받지
   * 않는다. 어디까지인지 모르는 기간으로는 물을 수 없다.
   */
  const 기간걸기 = useCallback((frm: string, to: string): boolean => {
    if (!frm && !to) {
      set거른기간(null);
      return true;
    }
    if (!frm || !to) {
      say.warn("시작일과 종료일을 모두 입력해 주세요.");
      return false;
    }
    if (frm > to) {
      say.warn("끝 날짜가 시작 날짜보다 앞섭니다.");
      return false;
    }
    set거른기간({ frm, to });
    return true;
  }, []);

  /** 상세 쪽으로 실어 보낼 짐. */
  const 담기 = useCallback(
    (): 기간짐 => ({ ym, range: 거른기간 }),
    [ym, 거른기간]
  );

  return { ym, 거른기간, 기간, 달바꾸기, 기간걸기, 담기 };
}
