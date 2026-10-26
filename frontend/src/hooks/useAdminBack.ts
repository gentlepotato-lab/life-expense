import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * 상세로 들어갔다 되돌아왔을 때 보던 것을 되살리는 자리.
 *
 * 목록 쪽은 상세로 넘어갈 때 보던 기간과 거르기를 함께 싣는다. 그런데 되돌아
 * 오면 그 쪽이 새로 서면서 기본값(이번 달, 사용자 사이트)으로 돌아갔다.
 * 사용자 사이트의 기간 상세는 이런 일이 없다 — 거기는 되돌아갈 쪽이 애초에
 * 주소에 조건을 달고 있다(pages/PeriodDetail.tsx).
 *
 * 되돌아갈 자리에 지금 보던 것을 남긴다. 브라우저의 방문 기록은 자리마다
 * 짐(state)을 하나씩 들 수 있으므로, 상세를 밀어 넣기 전에 지금 자리의 짐을
 * 갈아 끼운다. 뒤로 가기는 그 자리를 그 짐째로 되살린다.
 *
 * 밀어 넣는 것이 아니라 갈아 끼우는 것이라(replace) 방문 기록이 길어지지
 * 않는다. 뒤로 가기를 한 번 누르면 목록으로 돌아오는 것도 그대로다.
 */
export default function useAdminBack<T extends object>() {
  const navigate = useNavigate();
  const location = useLocation();

  /** 지금 자리에 짐을 남기고 상세로 넘어간다. */
  return useCallback(
    (상세주소: string, 짐: T, 더?: object) => {
      navigate(location.pathname + location.search, { replace: true, state: 짐 });
      navigate(상세주소, { state: { ...짐, ...더 } });
    },
    [navigate, location.pathname, location.search]
  );
}
