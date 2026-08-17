/**
 * Axios 오류에서 사용자에게 보여 줄 문구를 뽑는다.
 *
 * 기존 코드는 `catch(err: any)` 로 받아 `err.response?.data?.detail` 을 읽어 왔는데,
 * 새 코드에서 `any` 를 늘리지 않기 위해 이 한 곳에서만 형태를 좁힌다.
 */
export function apiErrorMessage(err: unknown, fallback = "오류가 발생했습니다."): string {
  const e = err as {
    response?: { data?: { detail?: string } };
    message?: string;
  };
  return e?.response?.data?.detail || e?.message || fallback;
}
