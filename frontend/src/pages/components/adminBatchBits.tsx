/**
 * 배치 이력과 그 판이 함께 쓰는 조각들.
 *
 * 표에 선 줄과 그 줄을 눌러 뜨는 판이 같은 것을 적는다(AdminBatchRuns.tsx,
 * AdminBatchRunsPopup.tsx). 기호도 걸린 시간 적는 꼴도 두 자리에서 같아야,
 * 눌러 판을 열었을 때 다른 줄을 보는 것처럼 읽히지 않는다. 액션 기록과 그
 * 상세가 조각을 나눠 쓰는 것과 같다(adminLogBits.tsx).
 */

/** 일이 한 바퀴 돈 기록. 서버가 내놓는 꼴 그대로다. */
export type 바퀴 = {
  job_key: string;
  name: string;
  on_day: string;
  at_time: string;
  ok: boolean;
  note: string;
  /** 걸린 시간(밀리초). 재기 전에 돈 바퀴는 null 이다. */
  ms: number | null;
};

/** 잘됐나 아닌가. 글로 적는 대신 기호로 적는다. */
export const 결과표 = {
  됐다: (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d="M3.5 8.5l3 3 6-6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  탈났다: (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d="M4 4l8 8M12 4l-8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  ),
};

/** 걸린 시간 한 줄. 재지 않은 바퀴는 줄표로 둔다. */
export const 걸린글 = (ms: number | null) =>
  ms === null ? "-" : `${ms.toLocaleString("ko-KR")}ms`;

/**
 * 딱지에 적는 횟수.
 *
 * 서버는 날마다 새것부터 한도(200줄)까지만 내놓는다. 받은 수를 그대로 적으면
 * 한도에 걸린 날은 늘 「200회」라, 그것이 그날 돈 전부인 것처럼 읽힌다. 전체와
 * 받은 수가 다를 때만 둘을 함께 적는다.
 *
 * 액션 기록의 건수글과 같은 꼴이다(adminLogBits.tsx). 거기는 쌓인 줄을 세므로
 * 「건」이고 여기는 일이 돈 바퀴를 세므로 「회」다.
 */
export function 횟수글(전체: number, 받은수: number): string {
  const 적기 = (n: number) => n.toLocaleString("ko-KR");
  if (전체 > 받은수) return `${적기(전체)}회 중 ${적기(받은수)}회`;
  return `${적기(받은수)}회`;
}
