import MonthNav from "./MonthNav";
import useMonthSpan from "../../hooks/useMonthSpan";
import { formatRangeLabel } from "../../utils/dateGroup";
import type useAdminPeriod from "../../hooks/useAdminPeriod";

/**
 * 「언제 것을 보는가」를 고르는 한 줄.
 *
 * 달 넘기개가 왼쪽, 필터가 오른쪽 끝이다. 조회 기록과 공지와 배치 이력과
 * 외부 API와 DB가 함께 쓴다.
 *
 * 거르기가 걸려 있으면 달 넘기개 자리에 고른 기간을 글로 적는다. 달 단위가
 * 아닌 기간을 보는 중이라 ‹ › 가 가리킬 달이 없다. 글꼴과 자리는 사용자
 * 사이트의 기간 상세와 같다(pages/CalendarDetail.tsx의 .cal-back__range).
 * 달 단위로 보는 동안에는 적지 않는다. 달 넘기개가 이미 어느 달인지 말하고
 * 있어, 그 옆에 날짜를 또 적으면 같은 말이 두 번 선다.
 *
 * 최근 며칠 알약은 걷었다. 달 단위가 기본이고 그 밖은 필터로 고르므로,
 * 가운데 자리가 하나 더 있을 까닭이 없다.
 *
 * 오른쪽 끝의 필터 앞자리는 부르는 쪽이 채운다. 모두 펼치기와 접기가 그
 * 자리에 선다.
 *
 * 상세 쪽에서는 왼쪽 끝에 되돌아가는 단추가 선다. 사용자 사이트의 기간
 * 상세와 같은 꼴, 같은 자리다(.cal-back).
 */
export default function AdminPeriodBar({
  때,
  on필터,
  뒤로,
  children,
}: {
  때: ReturnType<typeof useAdminPeriod>;
  on필터: () => void;
  /** 되돌아갈 쪽의 이름과 누를 때 할 일. 상세 쪽에서만 준다. */
  뒤로?: { 이름: string; on누름: () => void };
  children?: React.ReactNode;
}) {
  /* 넘겨 볼 수 있는 끝. 사용자 사이트의 네 화면과 같은 바닥을 쓴다. */
  const { min, max } = useMonthSpan();

  return (
    <>
      <div className="pm-toolbar-row admin-toolbar-row">
        {뒤로 && (
          <button
            type="button"
            className="filter-pill admin-back"
            aria-label={`${뒤로.이름}(으)로 돌아가기`}
            onClick={뒤로.on누름}
          >
            <span className="admin-back__arrow" aria-hidden="true">
              ‹
            </span>
            {뒤로.이름}
          </button>
        )}
        {때.거른기간 ? (
          <span className="admin-range">
            {formatRangeLabel(때.기간.frm, 때.기간.to)}
          </span>
        ) : (
          <MonthNav ym={때.ym} onChange={때.달바꾸기} min={min} max={max} />
        )}
        {/* 빈자리를 먹는 조각. 달 넘기개가 서든 안 서든 오른쪽 것들을
            끝까지 민다. */}
        <span className="admin-toolbar-row__gap" />
        {children}
        <button
          type="button"
          className={`filter-pill${때.거른기간 ? " on" : ""}`}
          aria-pressed={!!때.거른기간}
          title={때.거른기간 ? "필터가 걸려 있다. 눌러서 고친다." : "필터"}
          onClick={on필터}
        >
          필터
        </button>
      </div>

    </>
  );
}
