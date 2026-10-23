/**
 * 조회 기록과 그 상세가 함께 쓰는 조각들.
 *
 * 두 쪽이 같은 표를 그린다. 구분 딱지도, 값 딱지도, 먼저 펼칠 줄 수도 같아야
 * 한 쪽에서 다른 쪽으로 넘어가도 같은 표로 읽힌다. 쪽마다 적었더니 빛깔
 * 하나를 고칠 때 한 쪽만 고치게 됐다.
 */

/** 구분마다의 이름. 서버가 쥔 값은 영문 한 낱말이다. */
export const 구분이름: Record<string, string> = {
  view: "조회",
  feature: "기능",
  error: "요청",
  api: "외부",
};

/**
 * 구분마다의 딱지 빛깔.
 *
 * 값이 다르면 음영도 달라야 한 눈에 갈린다. 넷을 모두 보라로 두었더니
 * 「조회」와 「요청」이 같은 것처럼 읽혔다.
 */
export const 구분빛: Record<string, string> = {
  view: "tint-하늘",
  feature: "tint-풀빛",
  error: "tint-살구",
  api: "tint-보라",
};

/**
 * 긴 표에서 먼저 펼칠 줄 수.
 *
 * 하루에 수백 줄이 쌓이는 날이 있다. 한꺼번에 깔면 굴려 내려가는 동안 어디쯤
 * 인지 놓친다. 나머지는 표 아래 (...)로 편다(AdminMoreRow.tsx).
 */
export const 먼저펼칠줄 = 12;

/**
 * 스르륵 접히게 할 수 있는 나머지 줄 수.
 *
 * 접히는 동안은 줄마다 안쪽 여백과 글줄 키가 함께 줄어든다. 표 하나가
 * 통째로 다시 재어지므로 줄이 많을수록 비싸다. 재어 보니 열일곱 줄은 한 초에
 * 쉰세 틀, 백여든여덟 줄은 스물두 틀이었다. 뒤엣것은 부드럽다고 할 수 없다.
 *
 * 이보다 많은 줄은 스르륵 없이 한 번에 펼치고 접는다. 접힌 동안 줄을 아예
 * 세우지 않으므로 쪽이 뜨는 품도 그만큼 적다.
 */
export const 스르륵한도 = 40;

type 값있는줄 = {
  kind: string;
  elapsed_ms: number | null;
  status: number | null;
};

/**
 * 줄 끝에 붙는 값.
 *
 * 실패한 줄은 상태가, 1초를 넘긴 줄은 걸린 시간이 알맹이다. 멀쩡히 끝난
 * 줄에는 걸린 시간만 옅게 적고, 조회와 기능에는 적을 것이 없다.
 */
export function 값딱지(r: 값있는줄) {
  if (r.kind !== "error" && r.kind !== "api") return "-";
  if (r.status !== null && r.status >= 400) {
    return <span className="admin-tbl__chip tint-분홍">{r.status}</span>;
  }
  if (r.elapsed_ms === null) return "-";
  const 느리나 = r.elapsed_ms >= 1000;
  return (
    <span className={`admin-tbl__chip admin-mono ${느리나 ? "tint-살구" : "tint-잿빛"}`}>
      {r.elapsed_ms.toLocaleString("ko-KR")}ms
    </span>
  );
}
