import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { 날짜글, 걸린빛 } from "../../utils/adminFmt";
import { hour12 } from "../../utils/day";
import useAdminPeriod, { type 기간짐 } from "../../hooks/useAdminPeriod";
import useAdminBack from "../../hooks/useAdminBack";
import AdminPeriodBar from "./AdminPeriodBar";
import AdminPeriodFields from "./AdminPeriodFields";
import AdminFilterPopup from "./AdminFilterPopup";
import AdminGoRow from "./AdminGoRow";
import { EditField } from "./CardEditModal";

/**
 * 외부 API.
 *
 * 외부에 보내는 요청을 늘어놓는다. 읽기만 하는 자리다.
 *
 * **열쇠 값은 띄우지 않는다.** 꽂혀 있는지만 보인다. 서버가 아예 내놓지
 * 않는다(app/routers/admin.py의 /admin/apis).
 *
 * 맨 위에서 달을 넘기고 기간을 거른다(AdminPeriodBar). 호출 수도 마지막
 * 요청도 그 기간 안에서 본다.
 *
 * 묶음 둘이 표로 선다(.admin-tbl). 줄에 담긴 것이 셋뿐인데 카드를 쌓으면
 * 훑어 내리기보다 한 장씩 읽게 된다. 로그인 기록과 액션 기록과 같은 꼴이다.
 *
 * 두 표 모두 줄을 꾹 누르면 그 API를 호출한 기록만 모아 보는 쪽으로 간다
 * (AdminApiDetail.tsx). 톡 눌러 열게 두면 표를 훑다가 화면이 바뀐다.
 * 한 번도 안 부른 API도 들어갈 수 있다 — 들어가면 그 기간에 부른 적이
 * 없다고 적힌다. 들어가는 줄과 못 들어가는 줄이 한 표 안에 섞이면, 눌러
 * 보기 전에는 어느 쪽인지 알 길이 없다.
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
  /** 선택한 기간에 부른 횟수. 적힌 적이 없으면 0이다. */
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
  const location = useLocation();
  const 상세열기 = useAdminBack<{ 때: 기간짐 }>();
  /* 되돌아온 참이면 보던 기간을 그대로 이어받는다(hooks/useAdminBack.ts). */
  const 실린것 = (location.state as { 때?: 기간짐 } | null) ?? null;
  const 때 = useAdminPeriod(실린것?.때 ?? null);
  const [초안, set초안] = useState({ frm: "", to: "" });
  const [필터열림, set필터열림] = useState(false);
  const [목록, set목록] = useState<바깥[] | null>(null);
  const [탈, set탈] = useState(false);

  const 받기 = useCallback(() => {
    set탈(false);
    axios
      .get("/admin/apis", {
        headers: 머리(),
        params: { frm: 때.기간.frm, to: 때.기간.to },
      })
      .then((r) => set목록(r.data as 바깥[]))
      .catch(() => {
        set목록([]);
        set탈(true);
      });
  }, [때.기간.frm, 때.기간.to]);

  useEffect(받기, [받기]);

  const 필터열기 = () => {
    set초안({ frm: 때.거른기간?.frm ?? "", to: 때.거른기간?.to ?? "" });
    set필터열림(true);
  };

  const 적용 = () => {
    if (!때.기간걸기(초안.frm, 초안.to)) return;
    set필터열림(false);
  };

  const 상세로 = (a: 바깥) => {
    상세열기(
      `/admin/api-detail?key=${encodeURIComponent(a.key)}`,
      { 때: 때.담기() },
      { back: "외부 API" }
    );
  };

  const 부른것 = (목록 ?? []).filter((a) => a.last_day);

  return (
    <div className="admin-edit">
      <div className="cat-toolbar">
        <AdminPeriodBar 때={때} on필터={필터열기} />
      </div>

      {목록 === null ? (
        <div className="card admin-soon">
          <p className="page-empty">불러오는 중입니다.</p>
        </div>
      ) : 탈 ? (
        <div className="card admin-soon">
          <p className="page-empty">불러오지 못했습니다.</p>
        </div>
      ) : (
        <>
          <section className="admin-sec">
            <h3 className="admin-sec__head">사용하는 API</h3>
            <table className="admin-tbl">
              {/* 쓰임 칸은 「장소/가게 찾기」가 드는 폭이다. 76px이던 때는
                  그 글이 칸을 넘었다. */}
              <colgroup>
                <col />
                <col style={{ width: "96px" }} />
                <col style={{ width: "66px" }} />
                <col style={{ width: "46px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>쓰임</th>
                  <th>열쇠</th>
                  <th>호출</th>
                </tr>
              </thead>
              <tbody>
                {목록.map((a) => (
                  <AdminGoRow
                    key={a.key}
                    on상세={() => 상세로(a)}
                    className={꽂혔나(a) ? "" : "is-off"}
                  >
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
                    {/* 선택한 기간에 부른 횟수. 마지막 한 번만으로는 자주 쓰는
                        자리인지 어쩌다 한 번인지 갈리지 않는다. */}
                    <td>
                      <span
                        className={`admin-tbl__chip ${a.hits > 0 ? "tint-하늘" : "tint-잿빛"}`}
                      >
                        {a.hits.toLocaleString("ko-KR")}
                      </span>
                    </td>
                  </AdminGoRow>
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
                    <AdminGoRow key={a.key} on상세={() => 상세로(a)}>
                      <th className="admin-tbl__wrap">{a.name}</th>
                      {/* 날짜와 시각은 한 가지 사실이라 한 칸에 담는다. 날은
                          글로, 시각은 네모 딱지로 적는다. 시각은 12시간제다
                          (utils/day.ts의 hour12). 배치 카드의 딱지와 같은 꼴이다. */}
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
                    </AdminGoRow>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {필터열림 && (
        <AdminFilterPopup
          on초기화={() => set초안({ frm: "", to: "" })}
          on적용={적용}
          onClose={() => set필터열림(false)}
        >
          <AdminPeriodFields frm={초안.frm} to={초안.to} on바뀜={set초안} />

          <EditField label="" span={12}>
            <p className="admin-hint">날짜를 둘 다 비우면 달 단위로 돌아갑니다.</p>
          </EditField>
        </AdminFilterPopup>
      )}
    </div>
  );
}
