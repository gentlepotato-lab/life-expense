import { useEffect, useState } from "react";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { 날짜글, 걸린빛 } from "../../utils/adminFmt";
import { hour12 } from "../../utils/day";

/**
 * 외부 API.
 *
 * 바깥에 묻는 자리를 늘어놓는다. 읽기만 하는 자리다.
 *
 * **열쇠 값은 띄우지 않는다.** 꽂혀 있는지만 보인다. 서버가 아예 내놓지
 * 않는다(app/routers/admin.py의 /admin/apis).
 *
 * 묶음 둘이 표로 선다(.admin-tbl). 줄에 담긴 것이 셋뿐인데 카드를 쌓으면
 * 훑어 내리기보다 한 장씩 읽게 된다. 로그인 기록과 조회 기록과 같은 꼴이다.
 *
 * 호출한 기록은 두 곳에서 쌓인다. 브라우저가 바로 부르는 자리는 화면이 적어
 * 보내고(utils/track.ts의 바깥적기), 서버가 부르는 자리는 서버가 적는다
 * (app/routers/action_logs.py의 바깥적기). 둘이 같은 갈래로 같은 표에 쌓여
 * 여기서 한자리에 센다.
 */

type 바깥 = {
  key: string;
  name: string;
  use: string;
  /** 열쇠가 꽂힌 자리. 「서버」 아니면 「브라우저」다. */
  where: string;
  /** 브라우저에 꽂힌 것은 서버가 볼 수 없어 null 로 온다. */
  ready: boolean | null;
  last_day: string | null;
  last_time: string | null;
  last_ok: boolean | null;
  /** 마지막으로 부를 때 걸린 시간. 배치가 부른 자리는 잰 것이 없어 null 이다. */
  last_ms: number | null;
  /** 30일 동안 부른 횟수. 적힌 적이 없으면 0이다. */
  hits: number;
};

/**
 * 브라우저에 꽂힌 열쇠.
 *
 * frontend/.env 에 있어 서버가 볼 수 없다. 여기서는 Vite 가 빌드할 때 값을
 * 박아 넣으므로, 꽂혔는지만 보고 참거짓으로 바꾼다. 값 자체는 쓰지 않는다.
 * 이름을 글자로 적어야 Vite 가 알아보므로 한 줄씩 적는다.
 */
const 브라우저열쇠: Record<string, boolean> = {
  kakao: !!import.meta.env.VITE_KAKAO_MAP_KEY,
};

/** 열쇠가 꽂혀 있나. 서버 것은 서버가, 브라우저 것은 여기서 본다. */
function 꽂혔나(a: 바깥): boolean {
  return a.ready ?? !!브라우저열쇠[a.key];
}

/**
 * 쓰임마다 다른 빛깔.
 *
 * 아직 안 쓰는 자리는 잿빛으로 물러선다. 쓰는 자리와 같은 빛이면 목록이
 * 고르게 펴져, 지금 도는 것이 둘뿐인 것이 눈에 안 잡힌다.
 */
function 쓰임빛(a: 바깥): string {
  if (a.use === "아직 안 씀") return "tint-잿빛";
  return 꽂혔나(a) ? "tint-보라" : "tint-분홍";
}

export default function AdminApis() {
  const [목록, set목록] = useState<바깥[] | null>(null);
  const [탈, set탈] = useState(false);

  useEffect(() => {
    let 살아있나 = true;
    axios
      .get("/admin/apis", { headers: 머리() })
      .then((r) => {
        if (살아있나) set목록(r.data as 바깥[]);
      })
      .catch(() => {
        if (살아있나) set탈(true);
      });
    return () => {
      살아있나 = false;
    };
  }, []);

  if (탈) {
    return (
      <div className="card admin-soon">
        <p className="page-empty">불러오지 못했습니다.</p>
      </div>
    );
  }

  if (!목록) {
    return (
      <div className="card admin-soon">
        <p className="page-empty">불러오는 중입니다.</p>
      </div>
    );
  }

  const 부른것 = 목록.filter((a) => a.last_day);

  return (
    <div className="admin-edit">
      <section className="admin-sec">
        <h3 className="admin-sec__head">사용하는 API</h3>
        <table className="admin-tbl">
          <colgroup>
            <col />
            <col style={{ width: "76px" }} />
            <col style={{ width: "72px" }} />
            <col style={{ width: "54px" }} />
          </colgroup>
          <thead>
            <tr>
              <th>이름</th>
              <th>쓰임</th>
              <th>열쇠</th>
              <th>30일</th>
            </tr>
          </thead>
          <tbody>
            {목록.map((a) => (
              <tr key={a.key} className={꽂혔나(a) ? "" : "is-off"}>
                <th className="admin-tbl__wrap">{a.name}</th>
                <td>
                  <span className={`admin-tbl__tag ${쓰임빛(a)}`}>{a.use}</span>
                </td>
                {/* 열쇠가 어디 꽂혀 있나. 꽂힌 자리를 그대로 적고, 없으면
                    그 자리에 「없음」을 적는다. 꽂힌 줄에까지 「꽂힘」을
                    달면 목록이 딱지밭이 된다. */}
                <td>
                  {꽂혔나(a) ? (
                    <span className="admin-tbl__tag tint-풀빛">{a.where}</span>
                  ) : (
                    <span className="admin-tbl__tag tint-잿빛">없음</span>
                  )}
                </td>
                {/* 30일 동안 부른 횟수. 마지막 한 번만으로는 자주 쓰는
                    자리인지 어쩌다 한 번인지 갈리지 않는다. */}
                <td>
                  <span className={`admin-tbl__chip ${a.hits > 0 ? "tint-하늘" : "tint-잿빛"}`}>
                    {a.hits.toLocaleString("ko-KR")}회
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin-sec">
        <h3 className="admin-sec__head">마지막 요청</h3>
        {부른것.length === 0 ? (
          <p className="page-empty">아직 쌓인 것이 없습니다.</p>
        ) : (
          <table className="admin-tbl">
            <colgroup>
              <col />
              {/* 날짜와 시각이 함께 드는 칸이다. 「2026. 10. 22. (목)」에
                  「8:06 p.m.」 딱지까지 선다. */}
              <col style={{ width: "198px" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="admin-tbl__wrap">이름</th>
                <th>마지막 요청</th>
              </tr>
            </thead>
            <tbody>
              {부른것.map((a) => (
                <tr key={a.key}>
                  <th className="admin-tbl__wrap">{a.name}</th>
                  {/* 날짜와 시각은 한 가지 사실이라 한 칸에 담는다. 날은
                      글로, 시각은 네모 딱지로 적는다. 시각은 12시간제다
                      (utils/day.ts의 hour12) — 배치 카드의 딱지와 같은 꼴이다. */}
                  <td>
                    <span className="admin-tbl__pair">
                      <span>{날짜글(a.last_day)}</span>
                      <span
                        className={`admin-tbl__chip ${
                          a.last_ok === false ? "tint-분홍" : 걸린빛(a.last_ms)
                        }`}
                      >
                        {hour12(a.last_time ?? "")}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 어디까지 알 수 있는지 적는다. 적지 않으면 「NAVER 지도는 한 번도
          안 불렀나」로 읽힌다. */}
      <p className="admin-hint">호출한 기록은 90일까지 남습니다.</p>
    </div>
  );
}
