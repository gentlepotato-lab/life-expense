/**
 * 하루를 다루는 잔셈.
 *
 * 달력(DayGrid) · 날짜 고르개(DayPicker) · 쓰기 슬라이드가 함께 쓴다.
 * 컴포넌트 파일에 같이 두었더니 Fast Refresh가 걸려 따로 뺐다 — 한 파일이
 * 컴포넌트와 함수를 함께 내보내면 고칠 때마다 화면이 통째로 다시 뜬다.
 *
 * 연월만 다루는 셈(ymLong · ymStep 따위)은 schedule.ts에 있다. 이쪽은
 * 날짜까지 내려가는 것만 둔다.
 */

/** 달력이 펼쳐 보이는 달 */
export type View = { y: number; m: number };

/**
 * 'YYYY-MM-DD' → '2026. 10. 1.' — 딱지와 칸에 적는 꼴이다.
 *
 * 마지막 점을 찍는다. 날짜 단 머리말(dateGroup) · 지도 팝업 · 달력 속지가
 * 모두 점으로 끝내므로, 여기만 빼면 같은 날이 화면마다 다르게 적힌다.
 */
export function dateLabel(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return v;
  return `${Number(m[1])}. ${Number(m[2])}. ${Number(m[3])}.`;
}

/** 오늘을 'YYYY-MM-DD'로. 기기의 시각을 그대로 쓴다. */
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** 어느 달을 펼쳐 보일 것인가. 고른 날이 없으면 이번 달이다. */
export function viewOf(v: string | null | undefined): View {
  const m = v ? /^(\d{4})-(\d{2})-/.exec(v) : null;
  if (m) return { y: Number(m[1]), m: Number(m[2]) };
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

/** 'YYYYMM' — 연월 격자와 주고받는 꼴이다. */
export function ymOfView(v: View): string {
  return `${v.y}${String(v.m).padStart(2, "0")}`;
}
