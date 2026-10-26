/**
 * 서버에서 줄을 더 받아 오는 띠. 날짜 단을 모두 지나 맨 아래에 선다.
 *
 * 표 안의 (...)는 이미 받아 둔 줄을 펼치는 자리이고(AdminMoreRow.tsx), 이쪽은
 * 아직 받지 않은 줄을 받아 오는 자리다. 쌓인 것이 한도를 넘으면 서버가 새것부터
 * 200줄만 내놓기 때문에, 그 아래를 보려면 더 달라고 해야 한다.
 *
 * 띠와 자국은 표 안의 것과 같되 글은 다르다. 표의 마지막 (...) 바로 아래에
 * 서므로 둘 다 (...)로 두면 어느 것이 서버에서 더 받아 오는 자리인지 눌러
 * 보기 전에는 알 수 없다. 이쪽은 받아 올 수를 그대로 적는다.
 */
export default function AdminMoreAll({
  받은수,
  전체,
  한도,
  천장,
  펼쳤나,
  on더,
  on접기,
}: {
  받은수: number;
  전체: number;
  /** 한 번에 더 받는 줄 수. 처음 받는 수이기도 하다. */
  한도: number;
  /** 더는 못 받는 자리. 여기 닿으면 (...)를 세우지 않는다. */
  천장: number;
  /**
   * 더 받아 펼친 날인가. 안 주면 받은 줄이 한도를 넘었는지로 가린다.
   *
   * 배치 이력은 한 날의 줄을 두 번 긷는다(0건과 그 밖). 그래서 더 받지
   * 않아도 받은 줄이 한도를 넘을 수 있어, 넘었다는 것만으로는 펼친 날인지
   * 알 수 없다. 그쪽은 제가 아는 것을 짚어 준다.
   */
  펼쳤나?: boolean;
  on더: () => void;
  on접기: () => void;
}) {
  const 더있나 = 전체 > 받은수 && 받은수 < 천장;
  const 폈나 = 펼쳤나 ?? 받은수 > 한도;
  if (!더있나 && !폈나) return null;

  const 더받을수 = Math.min(한도, 전체 - 받은수, 천장 - 받은수);

  return (
    <div className={`admin-more-all${폈나 ? " is-open" : ""}`}>
      {더있나 && (
        <button
          type="button"
          className="admin-more-all__btn"
          aria-label={`${더받을수.toLocaleString("ko-KR")}건 더 받기`}
          onClick={on더}
        >
          {더받을수.toLocaleString("ko-KR")}건 더
        </button>
      )}
      {폈나 && (
        <button
          type="button"
          className="admin-more-all__btn"
          aria-label={`처음 ${한도.toLocaleString("ko-KR")}건만 보기`}
          onClick={on접기}
        >
          접기
        </button>
      )}
    </div>
  );
}
