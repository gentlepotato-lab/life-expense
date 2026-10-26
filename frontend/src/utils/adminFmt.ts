/**
 * 관리자 사이트가 값을 적는 꼴.
 *
 * 날짜와 걸린 시간은 여러 쪽에 선다(액션 기록, 외부 API, 배치, 배치 이력).
 * 쪽마다 제 꼴로 적던 것을 여기 한 곳으로 모은다. 한 사이트 안에서 같은
 * 값이 쪽마다 다른 꼴로 적히면 같은 값으로 읽히지 않는다.
 */

import { formatDateLabel } from "./dateGroup";

/**
 * 날짜 한 줄. "2026-10-22" → "2026. 10. 22. (수)"
 *
 * 사용자 사이트와 같은 꼴로 적는다. 꼴을 여기서 짓지 않고 거기서 가져다
 * 쓰는 까닭은, 두 사이트가 날짜를 다르게 적으면 한 서비스로 읽히지 않기
 * 때문이다.
 */
export function 날짜글(날: string | null | undefined): string {
  if (!날) return "-";
  return formatDateLabel(날);
}

/**
 * 좁은 딱지에 담는 날짜. "2026-10-22" -> "10. 22. (목)"
 *
 * 기본 꼴(위의 날짜글)에서 해만 덜어 낸다. 딱지가 드는 자리가 좁아 해까지는
 * 들어가지 않는다. 해는 상세 이력 쪽이 날짜 칸에 온꼴로 적는다
 * (AdminBatchRuns.tsx).
 *
 * 꼴을 여기서 다시 짓지 않고 덜어 내기만 하는 까닭은, 요일을 세는 자리가
 * 둘이 되면 언젠가 둘이 어긋나기 때문이다.
 */
export function 짧은날짜글(날: string | null | undefined): string {
  if (!날) return "-";
  return 날짜글(날).replace(/^\d{4}\.\s*/, "");
}

/**
 * 걸린 시간의 딱지 빛깔.
 *
 * 1초를 넘기면 살구빛으로 가른다. 수만 적으면 180과 1800이 한 눈에
 * 같아 보여, 느려진 자리를 찾으려면 줄마다 읽어야 한다.
 */
export function 걸린빛(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "tint-잿빛";
  if (ms >= 1000) return "tint-살구";
  return "tint-청록";
}

/**
 * 보고 있는 기간. "2026-10-01", "2026-10-23" → "10. 1. ~ 10. 23."
 *
 * 사용자 사이트의 기간 상세가 적는 그 꼴이다(pages/PeriodDetail.tsx의
 * shortDate). 해와 요일까지 적던 꼴(formatRangeLabel)은 230px이 들어, 상세
 * 쪽의 한 줄에 되돌아가는 단추와 펼치개와 필터가 함께 서면 필터가 다음
 * 줄로 밀렸다. 이 꼴은 85px이다.
 *
 * 해가 다른 두 날을 묶을 때만 해를 적는다. 12월에서 1월로 넘어가는 기간을
 * 해 없이 적으면 어느 해 것인지 알 길이 없다.
 */
export function 기간글(frm: string, to: string): string {
  const 짧게 = (v: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    return m ? `${Number(m[2])}. ${Number(m[3])}.` : v;
  };
  const 해붙여 = (v: string) => `${v.slice(0, 4)}. ${짧게(v)}`;
  if (!frm || !to) return "";
  if (frm === to) return 짧게(frm);
  if (frm.slice(0, 4) !== to.slice(0, 4)) return `${해붙여(frm)} ~ ${해붙여(to)}`;
  return `${짧게(frm)} ~ ${짧게(to)}`;
}
