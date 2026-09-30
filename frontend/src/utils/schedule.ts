/**
 * 정기 내역의 주기 · 시작 · 끝을 다루는 셈과 이름표.
 *
 * 카드와 등록 팝업과 편집 팝업, 세 곳이 같은 말을 써야 한다. 한 곳에만
 * 적어 두고 세 곳이 꺼내 쓴다 — 나누어 적으면 "격월"과 "2개월"처럼 같은
 * 것을 다르게 부르는 일이 생긴다.
 *
 * 연월은 'YYYYMM' 여섯 자다. 글자로 담아도 대소 비교가 곧 시간 순서라
 * 셈이 간단하다. backend/app/routers/scheduled_entries.py와 같은 꼴이다.
 */

/** 화면에 이름표가 있는 주기만 쓴다. DB의 CHECK와 같은 목록이다. */
export const INTERVAL_OPTIONS = [
  { value: "1", label: "매월" },
  { value: "2", label: "격월" },
  { value: "3", label: "분기" },
  { value: "6", label: "반년" },
  { value: "12", label: "매년" },
] as const;

/** 예정일이 쉬는 날에 걸렸을 때. 서버의 holiday_handling과 같은 값이다. */
export const HOLIDAY_OPTIONS = [
  { value: "before", label: "휴일 전" },
  { value: "on", label: "당일" },
  { value: "after", label: "휴일 후" },
] as const;

/** 2 → "격월". 모르는 값이면 "매월"로 떨어진다. */
export function intervalLabel(n: number | string | null | undefined): string {
  const key = String(n ?? 1);
  return INTERVAL_OPTIONS.find((o) => o.value === key)?.label ?? "매월";
}

/** '202601' → "2026년 1월". 고르개와 팝업에서 쓴다. */
export function ymLong(ym: string): string {
  return `${Number(ym.slice(0, 4))}년 ${Number(ym.slice(4))}월`;
}

/** 오늘의 'YYYYMM'. */
export function ymNow(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 'YYYYMM'에서 n달 뒤. 음수면 앞이다. */
export function ymStep(ym: string, n: number): string {
  const t = Number(ym.slice(0, 4)) * 12 + (Number(ym.slice(4)) - 1) + n;
  return `${String(Math.floor(t / 12)).padStart(4, "0")}${String((t % 12) + 1).padStart(2, "0")}`;
}
