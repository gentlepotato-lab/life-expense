import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { formatDateLabel } from "../../utils/dateGroup";
import { 걸린빛 } from "../../utils/adminFmt";
import useAdminFold from "../../hooks/useAdminFold";
import useAdminPeriod, { type 기간짐 } from "../../hooks/useAdminPeriod";
import AdminPeriodBar from "./AdminPeriodBar";
import AdminPeriodFields from "./AdminPeriodFields";
import AdminMoreRow from "./AdminMoreRow";
import AdminMoreAll from "./AdminMoreAll";
import AdminFilterPopup from "./AdminFilterPopup";
import DateGroupHeader from "./DateGroupHeader";
import Collapse from "./Collapse";
import { CollapseAllButtons } from "./CollapseToggle";
import { EditField } from "./CardEditModal";
import AdminBatchRunsPopup from "./AdminBatchRunsPopup";
import { 결과표, 걸린글, 횟수글, type 바퀴 } from "./adminBatchBits";
import { 먼저펼칠줄, 스르륵한도, 한번에받을수, 받을수천장 } from "./adminLogBits";

/**
 * 배치 이력.
 *
 * 일이 실행된 기록을 한 줄씩 늘어놓는다. 배치 쪽 카드에는 마지막 한 줄만 서므로,
 * 며칠째 실패하는 중인지 요즘 느려지는 중인지는 거기서 알 수 없다. 카드의
 * [이력] 단추로 들어온다(AdminBatch.tsx).
 *
 * 짜임은 로그인 기록과 같다(AdminLoginLog.tsx). 날짜가 표 밖 단 머리말에
 * 서고, 그 머리말을 눌러 접고 편다. 날짜를 칸으로 두면 하루에 천 줄이 넘는
 * 일(정기 내역 보내기)에서 같은 날이 줄마다 되풀이된다.
 *
 * 열쇠를 들고 들어오면 그 일만 본다. 없으면 모두 섞어 보되 어느 일인지를
 * 칸으로 적는다.
 *
 * 맨 위에서 달을 넘기고 기간을 거른다(AdminPeriodBar). 기간은 들어올 때
 * 실려 오고, 되돌아가는 단추는 바로 앞 쪽으로 돌아간다.
 *
 * 하루에 쌓인 바퀴가 많아 먼저 몇 줄만 펼친다. 매분 도는 일은 하루에 천
 * 줄이 넘는다. 나머지는 표 아래 (...)를 눌러 편다(AdminMoreRow.tsx).
 */

/** 서버가 내놓는 꼴. 액션 기록과 같다(admin.py의 admin_batch_runs). */
type 받은것 = {
  total: number;
  limit: number;
  days: Record<string, number>;
  rows: 바퀴[];
};

export default function AdminBatchRuns() {
  const navigate = useNavigate();
  const location = useLocation();
  const [찾기] = useSearchParams();
  const 열쇠 = 찾기.get("key") || "";

  const 실린것 =
    (location.state as { 때?: 기간짐; back?: string; 이름?: string } | null) ?? null;
  const 때 = useAdminPeriod(실린것?.때 ?? null);
  const 돌아갈곳 = 실린것?.back ?? "배치";

  const [초안, set초안] = useState({ frm: "", to: "" });
  const [필터열림, set필터열림] = useState(false);
  const [목록, set목록] = useState<바퀴[] | null>(null);
  /* 기간에 쌓인 전체 수와 날마다 쌓인 수. 서버가 날마다 한도까지만 내놓으므로
     받은 줄만 세면 그날 몇 바퀴를 돌았는지 알 수 없다. */
  const [전체, set전체] = useState(0);
  const [날수, set날수] = useState<Record<string, number>>({});
  /* 날마다 지금 몇 줄까지 받아 두었나. 더 받기를 누른 날만 들어 있다. */
  const [날한도, set날한도] = useState<Record<string, number>>({});
  const [탈, set탈] = useState(false);
  /* 접은 날과, 나머지까지 펼친 날. 기본은 모두 펼침이되 앞 몇 줄만이다. */
  const [접은날, set접은날] = useState<Set<string>>(new Set());
  /* 긴 날의 나머지를 펼치고 접는 자리. 한 번 펼친 날은 줄을 세운 채
     접었다 폈다 하므로 스르륵 닫힌다(hooks/useAdminFold.ts). */
  const 펼침 = useAdminFold();
  /* 0건만 쌓이는 날이 많아 기본은 숨김이다. 매분 도는 일(정기 내역 보내기)은
     하루 천 줄 가운데 몇 줄만 무언가를 보낸다. 나머지는 돌았다는 것 말고는
     적을 것이 없는데, 그 몇 줄을 찾으려면 천 줄을 굴려 내려가야 했다.

     거르는 일은 서버가 한다(admin.py의 include_zero). 서버가 새것부터
     200줄만 내놓으므로, 받아 놓고 여기서 거르면 그 200줄이 모두 0건인 날에는
     아무것도 남지 않는다. 거르고 나서 200줄을 세야 한다. */
  const [영건보기, set영건보기] = useState(false);
  /* 탈난 바퀴만 보기. 며칠째 실패하는 중인지를 볼 때 쓴다. 켜면 0건은
     저절로 빠지므로(0건은 잘 끝난 바퀴가 남기는 글이다) 옆 네모는 잠근다.
     눌러도 아무 일이 없는 네모를 그대로 두면 고장으로 읽힌다. */
  const [실패만, set실패만] = useState(false);
  /* 기호를 눌러 연 바퀴. 남긴 글을 판으로 보여 준다. */
  const [고른바퀴, set고른바퀴] = useState<바퀴 | null>(null);

  const 받기 = useCallback(() => {
    set탈(false);
    axios
      .get("/admin/batch/runs", {
        headers: 머리(),
        params: {
          frm: 때.기간.frm,
          to: 때.기간.to,
          include_zero: 영건보기,
          only_failed: 실패만,
          limit: 한번에받을수,
          ...(열쇠 ? { key: 열쇠 } : {}),
        },
      })
      .then((r) => {
        const 온것 = r.data as 받은것;
        set목록(온것.rows);
        set전체(온것.total);
        set날수(온것.days);
        set날한도({});
      })
      .catch(() => {
        set목록([]);
        set전체(0);
        set날수({});
        set탈(true);
      });
  }, [때.기간.frm, 때.기간.to, 열쇠, 영건보기, 실패만]);

  useEffect(받기, [받기]);

  /**
   * 그 날 것을 다시 받는다. 받을 줄 수를 손으로 쥐여 준다.
   *
   * 하루만 다시 묻는다(frm과 to를 같은 날로). 기간 전체를 다시 받으면 다른
   * 날까지 함께 와서, 한 날을 더 보려다 수천 줄을 쥐게 된다. 받은 줄은 그
   * 날 자리에만 갈아 끼운다. 액션 기록과 같은 꼴이다(AdminLogs.tsx).
   *
   * 접을 때도 다시 받는다. 거기는 쥐고 있는 줄을 앞에서부터 잘라 남기는데,
   * 여기는 한 날을 두 번 길어 왔으므로(0건과 그 밖) 앞에서부터 자르면 뒤에
   * 선 「1건」이 함께 잘린다. 거르는 잣대는 서버만 쥐고 있다.
   */
  const 날받기 = useCallback(
    (날: string, 다음: number) => {
      axios
        .get("/admin/batch/runs", {
          headers: 머리(),
          params: {
            frm: 날,
            to: 날,
            include_zero: 영건보기,
            only_failed: 실패만,
            limit: 다음,
            ...(열쇠 ? { key: 열쇠 } : {}),
          },
        })
        .then((r) => {
          const 온것 = r.data as 받은것;
          set날한도((v) => ({ ...v, [날]: 다음 }));
          set목록((이전) =>
            이전 === null
              ? 온것.rows
              : [
                  ...이전.filter((x) => x.on_day > 날),
                  ...온것.rows,
                  ...이전.filter((x) => x.on_day < 날),
                ]
          );
        })
        .catch(() => set탈(true));
    },
    [열쇠, 영건보기, 실패만]
  );

  const 필터열기 = () => {
    set초안({ frm: 때.거른기간?.frm ?? "", to: 때.거른기간?.to ?? "" });
    set필터열림(true);
  };

  const 적용 = () => {
    if (!때.기간걸기(초안.frm, 초안.to)) return;
    set필터열림(false);
  };

  /** 무엇이든 거르고 있나. 비었을 때 할 말이 갈린다. */
  const 거르는중 = 실패만 || !영건보기;

  /* 날로 묶는다. 서버가 이미 새것부터 보내므로 나오는 차례를 그대로 쓴다. */
  const 날묶음 = (() => {
    const 묶음: { date: string; label: string; items: 바퀴[] }[] = [];
    for (const r of 목록 ?? []) {
      const 끝 = 묶음[묶음.length - 1];
      if (끝 && 끝.date === r.on_day) 끝.items.push(r);
      else 묶음.push({ date: r.on_day, label: formatDateLabel(r.on_day), items: [r] });
    }
    return 묶음;
  })();

  /* 열쇠를 들고 들어왔으면 어느 일인지 위에 적는다. 줄마다 적으면 같은
     이름이 되풀이된다.

     카드에서 들어왔으면 그 카드가 이름을 실어 준다(AdminBatch.tsx). 주소를
     바로 쳐서 들어온 때에만 받은 줄에서 꺼내는데, 0건을 숨겨 한 줄도 안
     남으면 꺼낼 데가 없다. 그래서 한 번 안 이름은 들고 있는다. 딱지가
     사라지면 그 옆에 선 네모가 왼쪽으로 밀린다. */
  const [안이름, set안이름] = useState(실린것?.이름 ?? "");
  useEffect(() => {
    const 이름 = 목록?.[0]?.name;
    if (이름 && 이름 !== 안이름) set안이름(이름);
  }, [목록, 안이름]);
  const 일이름 = 열쇠 ? 안이름 : "";

  return (
    <div className="admin-edit">
      <div className="cat-toolbar">
        <AdminPeriodBar
          때={때}
          on필터={필터열기}
          뒤로={{
            이름: 돌아갈곳,
            on누름: () =>
              실린것 ? navigate(-1) : navigate("/admin/batch", { replace: true }),
          }}
        >
          {날묶음.length > 0 && (
            <CollapseAllButtons
              onExpandAll={() => set접은날(new Set())}
              onCollapseAll={() => set접은날(new Set(날묶음.map((g) => g.date)))}
            />
          )}
        </AdminPeriodBar>
      </div>

      {/* 어느 일을 보고 있는지와, 0건을 보일지. 열쇠는 주소에만 실려 있어
          이름은 여기서 적는다. 줄마다 적으면 같은 이름이 되풀이된다. */}
      {목록 !== null && (
        <div className="pm-toolbar-row admin-toolbar-row">
          {일이름 && <span className="admin-span__tag">{일이름}</span>}
          {/* 이름 딱지 바로 옆이다. 감춘 항목 보기와 같은 네모, 같은 꼴이다
              (분류, 결제 수단, 정기 내역의 .cp-toggle). 켜짐과 꺼짐에 적는
              말이 같아 줄이 흔들리지 않는다. */}
          <label className={`cp-toggle${실패만 ? " readonly" : ""}`}>
            <input
              type="checkbox"
              checked={영건보기}
              disabled={실패만}
              onChange={(e) => set영건보기(e.target.checked)}
            />
            0건도 보기
          </label>
          <label className="cp-toggle">
            <input
              type="checkbox"
              checked={실패만}
              onChange={(e) => set실패만(e.target.checked)}
            />
            실패만 보기
          </label>
          <span className="admin-toolbar-row__gap" />
          {/* 서버가 날마다 한도까지만 내놓으므로 받은 수와 쌓인 수가 다를 수
              있다. 다를 때만 둘을 함께 적는다. 숨기고 있으면 0건을 뺀 수다. */}
          <span className="admin-span__tag">{횟수글(전체, 목록.length)}</span>
        </div>
      )}

      {/* 할 말은 카드에 담지 않는다. 이 쪽에 선 것은 표뿐이라 카드가 하나만
          떠 있으면 어디서 온 그릇인지 알 수 없다. 사용자 사이트의 목록 화면이
          하는 대로 글줄만 둔다(.page-empty). */}
      {목록 === null ? (
        <p className="page-empty">불러오는 중입니다.</p>
      ) : 탈 ? (
        <p className="page-empty">기록을 불러오지 못했습니다.</p>
      ) : 날묶음.length === 0 ? (
        /* 거르는 중이면 돌기는 돌았는데 남은 줄이 없는 것일 수 있다. 그때
           「아직 실행된 적이 없습니다」로 적으면 한 번도 안 돈 것처럼 읽힌다.
           0건을 숨기는 것도 거르는 것이므로 기본 상태가 이미 거르는 중이다. */
        <p className="page-empty">
          {거르는중 ? "조건에 맞는 기록이 없습니다." : "아직 실행된 적이 없습니다."}
        </p>
      ) : (
        <div className="admin-days-list">
          {날묶음.map((묶음) => {
            const 폈나 = !접은날.has(묶음.date);
            const 다폈나 = 펼침.폈나(묶음.date);
            /* 나머지가 많으면 스르륵 없이 한 번에 펼치고 접는다. 줄마다
               키를 어르는 일이라 많으면 뚝뚝 끊긴다(adminLogBits.tsx). */
            const 스르륵 = 묶음.items.length - 먼저펼칠줄 <= 스르륵한도;
            const 세울것 = 스르륵 ? 펼침.담겼나(묶음.date) : 다폈나;
            const 보일것 = 세울것 ? 묶음.items : 묶음.items.slice(0, 먼저펼칠줄);
            return (
              <section key={묶음.date} className="date-group">
                {/* 날짜는 표 밖, 단 머리말이 말한다. 셀 돈이 없으므로
                    합계는 접는다(hideSum). */}
                <DateGroupHeader
                  label={묶음.label}
                  summary={{ count: 묶음.items.length, inSum: 0, outSum: 0, net: 0 }}
                  센글={횟수글(날수[묶음.date] ?? 묶음.items.length, 묶음.items.length)}
                  hideSum
                  open={폈나}
                  onToggle={() =>
                    set접은날((v) => {
                      const 다음 = new Set(v);
                      if (다음.has(묶음.date)) 다음.delete(묶음.date);
                      else 다음.add(묶음.date);
                      return 다음;
                    })
                  }
                />
                <Collapse open={폈나}>
                  <table className="admin-tbl">
                    <colgroup>
                      {/* 시각과 결과와 걸린 시간은 글이 정해져 있어 못 박고,
                          남는 폭은 한 줄이 쓴다. */}
                      <col style={{ width: "78px" }} />
                      <col style={{ width: "36px" }} />
                      <col style={{ width: "78px" }} />
                      <col />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>시각</th>
                        <th className="admin-tbl__mark" />
                        <th>걸린 시간</th>
                        <th>{열쇠 ? "결과" : "작업"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {보일것.map((r, i) => (
                        <tr
                          key={`${r.on_day}-${r.at_time}-${i}`}
                          className={`${r.ok ? "" : "is-off"}${
                            스르륵 && i >= 먼저펼칠줄
                              ? ` admin-tbl__extra${다폈나 ? "" : " is-folded"}`
                              : ""
                          }`.trim()}
                        >
                          <th className="admin-mono">{r.at_time}</th>
                          {/* 기호를 누르면 그 바퀴가 남긴 글이 판으로 뜬다.
                              표의 결과 칸은 좁아 탈난 글이 잘린다. 감싼
                              조각(span)은 그대로 둔다. 접힐 때 키를 줄이는
                              쪽이 그것을 짚고 있다. */}
                          <td
                            className={`admin-tbl__mark admin-tbl__mark--${r.ok ? "open" : "bad"}`}
                          >
                            <span>
                              <button
                                type="button"
                                className="admin-tbl__mark-btn"
                                title={`${r.at_time} 실행 결과`}
                                aria-label={`${r.at_time} 실행 결과 보기`}
                                onClick={() => set고른바퀴(r)}
                              >
                                {r.ok ? 결과표.됐다 : 결과표.탈났다}
                              </button>
                            </span>
                          </td>
                          {/* 재어 적은 값이라 네모 딱지다. 1초를 넘기면
                              빛깔이 갈린다(utils/adminFmt.ts). */}
                          <td>
                            <span className={`admin-tbl__chip ${걸린빛(r.ms)}`}>
                              {걸린글(r.ms)}
                            </span>
                          </td>
                          {/* 열쇠를 들고 왔으면 남긴 글을, 아니면 어느
                              일이었는지를 적는다. */}
                          <td className="admin-tbl__wrap">{열쇠 ? r.note || "-" : r.name}</td>
                        </tr>
                      ))}
                      {묶음.items.length > 먼저펼칠줄 && (
                        <AdminMoreRow
                          칸수={4}
                          남은수={묶음.items.length - 먼저펼칠줄}
                          폈나={다폈나}
                          on바꾸기={() => 펼침.바꾸기(묶음.date)}
                        />
                      )}
                    </tbody>
                  </table>

                  {/* 표 안의 (...)는 이미 받아 둔 줄을 펼치는 자리이고, 이쪽은
                      아직 받지 않은 줄을 받아 오는 자리다(AdminMoreAll.tsx). */}
                  <AdminMoreAll
                    받은수={묶음.items.length}
                    전체={날수[묶음.date] ?? 묶음.items.length}
                    한도={한번에받을수}
                    천장={받을수천장}
                    펼쳤나={(날한도[묶음.date] ?? 한번에받을수) > 한번에받을수}
                    on더={() =>
                      날받기(
                        묶음.date,
                        Math.min((날한도[묶음.date] ?? 한번에받을수) + 한번에받을수, 받을수천장)
                      )
                    }
                    on접기={() => 날받기(묶음.date, 한번에받을수)}
                  />
                </Collapse>
              </section>
            );
          })}
        </div>
      )}

      {고른바퀴 && (
        <AdminBatchRunsPopup 바퀴={고른바퀴} onClose={() => set고른바퀴(null)} />
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
