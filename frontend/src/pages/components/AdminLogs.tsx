import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { formatDateLabel } from "../../utils/dateGroup";
import useAdminFold from "../../hooks/useAdminFold";
import useAdminPeriod, { type 기간짐 } from "../../hooks/useAdminPeriod";
import useAdminBack from "../../hooks/useAdminBack";
import AdminPeriodBar from "./AdminPeriodBar";
import AdminPeriodFields from "./AdminPeriodFields";
import AdminMoreRow from "./AdminMoreRow";
import AdminGoRow from "./AdminGoRow";
import AdminFilterPopup from "./AdminFilterPopup";
import DateGroupHeader from "./DateGroupHeader";
import Collapse from "./Collapse";
import { CollapseAllButtons } from "./CollapseToggle";
import SingleSelect from "./SingleSelect";
import { EditField, EditDivider } from "./CardEditModal";
import AdminSitePick, { type 사이트 } from "./AdminSitePick";
import AdminMoreAll from "./AdminMoreAll";
import { 건수글, 한번에받을수, 받을수천장 } from "./adminLogBits";
import {
  구분이름,
  구분빛,
  값딱지,
  줄이름,
  줄경로,
  길인가,
  먼저펼칠줄,
  스르륵한도,
} from "./adminLogBits";

/**
 * 액션 기록.
 *
 * 대시보드는 묶어서만 보여 준다. 그래서 "그 요청이 언제 몇 ms였는지"를 볼
 * 자리가 없었다. 여기가 그 자리다.
 *
 * 맨 위에서 달을 넘기고 기간을 거른다(AdminPeriodBar). 아래는 날짜로 묶은
 * 표이고, 단 머리말을 눌러 접고 편다. 사용자 사이트의 내역 화면과 같은
 * 결이다.
 *
 * 하루에 쌓인 줄이 많아 먼저 몇 줄만 펼친다. 나머지는 표 아래 (...)를 눌러
 * 편다(AdminMoreRow).
 *
 * 줄을 꾹 누르면 그 이름의 기록만 모아 보는 쪽으로 간다. 톡 눌러 열게 두면
 * 표를 훑다가 화면이 바뀐다. 기간과 거르기는 그대로 실려 가고, 되돌아오면
 * 그대로 되돌아온다(AdminLogDetail.tsx).
 *
 * 묵은 기록은 달마다 지워진다(app/scheduler/cleanup_job.py). 아무리 거슬러
 * 올라가도 90일 치뿐이다.
 */

/** 서버가 내놓는 것. 줄과 함께 날마다 쌓인 수가 온다. */
type 받은것 = {
  total: number;
  limit: number;
  days: Record<string, number>;
  rows: 기록[];
};

type 기록 = {
  log_id: number;
  kind: string;
  name: string;
  path: string | null;
  elapsed_ms: number | null;
  status: number | null;
  on_day: string;
  at_time: string;
};

/** 상세로 갔다 되돌아올 때 되살릴 것. */
type 짐 = { 때: 기간짐; 구분: string; 사이트: 사이트 };

export default function AdminLogs() {
  const location = useLocation();
  const 상세열기 = useAdminBack<짐>();
  /* 되돌아온 참이면 보던 것을 그대로 이어받는다(hooks/useAdminBack.ts). */
  const 실린것 = (location.state as 짐 | null) ?? null;
  const 때 = useAdminPeriod(실린것?.때 ?? null);
  const [구분, set구분] = useState(실린것?.구분 ?? "");
  /* 어느 사이트의 기록을 볼지. 기본은 사용자 사이트다 — 쌓인 줄의 삼분의 이가
     관리자 사이트를 드나든 것이라, 섞어 두면 사용자 쪽이 묻힌다
     (AdminSitePick.tsx). */
  const [사이트, set사이트] = useState<사이트>(실린것?.사이트 ?? "user");
  /* 팝업 안에서 고치는 중인 조건. [적용]을 누르지 않고 닫으면 버린다.
     사용자 화면의 거르기와 같다(pages/Entries.tsx). */
  const [초안, set초안] = useState({ 구분: "", frm: "", to: "" });
  const [필터열림, set필터열림] = useState(false);
  const [목록, set목록] = useState<기록[] | null>(null);
  /* 그 기간에 쌓인 전체 수와 날마다 쌓인 수. 받는 줄은 날마다 한도(200)까지라,
     받은 수를 그대로 띄우면 한도에 걸린 날은 늘 「200건」이라 그것이 전부인
     줄 읽힌다. */
  const [전체, set전체] = useState(0);
  const [날수, set날수] = useState<Record<string, number>>({});
  /* 날마다 서버에 달라고 한 줄 수. 그 날 띠의 [200건 더]를 누를 때마다 그
     날만 200씩 늘린다. 기간이나 거르기가 바뀌면 통째로 비운다 — 다른 것을
     보는데 앞서 늘려 둔 수가 따라오면, 바꾼 자리마다 수백 줄을 받게 된다. */
  const [날한도, set날한도] = useState<Record<string, number>>({});
  const [탈, set탈] = useState(false);
  /* 접은 날과, 나머지까지 펼친 날. 기본은 모두 펼침이되 앞 몇 줄만이다. */
  const [접은날, set접은날] = useState<Set<string>>(new Set());
  /* 긴 날의 나머지를 펼치고 접는 자리. 한 번 펼친 날은 줄을 세운 채
     접었다 폈다 하므로 스르륵 닫힌다(hooks/useAdminFold.ts). */
  const 펼침 = useAdminFold();

  /* 거르기는 서버가 한다. 90일 치가 수천 줄이라 받고 골라내면 손전화가
     한 번에 그 전부를 쥐게 된다. */
  const 받기 = useCallback(() => {
    set탈(false);
    axios
      .get("/admin/logs", {
        headers: 머리(),
        params: {
          frm: 때.기간.frm,
          to: 때.기간.to,
          site: 사이트,
          limit: 한번에받을수,
          ...(구분 ? { kind: 구분 } : {}),
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
  }, [때.기간.frm, 때.기간.to, 구분, 사이트]);

  useEffect(받기, [받기]);

  /**
   * 그 날 것을 한 묶음 더 받는다.
   *
   * 하루만 다시 묻는다(frm과 to를 같은 날로). 기간 전체를 다시 받으면 다른
   * 날까지 함께 와서, 한 날을 더 보려다 수천 줄을 쥐게 된다. 받은 줄은 그
   * 날 자리에만 갈아 끼운다.
   */
  const 날더받기 = useCallback(
    (날: string) => {
      const 다음 = Math.min((날한도[날] ?? 한번에받을수) + 한번에받을수, 받을수천장);
      axios
        .get("/admin/logs", {
          headers: 머리(),
          params: {
            frm: 날,
            to: 날,
            site: 사이트,
            limit: 다음,
            ...(구분 ? { kind: 구분 } : {}),
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
    [날한도, 사이트, 구분]
  );

  /** 그 날을 처음 묶음까지만 남긴다. 이미 쥐고 있으므로 다시 묻지 않는다. */
  const 날접기 = useCallback((날: string) => {
    set날한도((v) => ({ ...v, [날]: 한번에받을수 }));
    set목록((이전) => {
      if (이전 === null) return 이전;
      let 센것 = 0;
      return 이전.filter((x) => {
        if (x.on_day !== 날) return true;
        센것 += 1;
        return 센것 <= 한번에받을수;
      });
    });
  }, []);

  const 필터열기 = () => {
    set초안({ 구분, frm: 때.거른기간?.frm ?? "", to: 때.거른기간?.to ?? "" });
    set필터열림(true);
  };

  const 적용 = () => {
    if (!때.기간걸기(초안.frm, 초안.to)) return;
    set구분(초안.구분);
    set필터열림(false);
  };

  /* 날로 묶는다. 서버가 이미 새것부터 보내므로 나오는 차례를 그대로 쓴다. */
  const 날묶음 = (() => {
    const 묶음: { date: string; label: string; items: 기록[] }[] = [];
    for (const r of 목록 ?? []) {
      const 끝 = 묶음[묶음.length - 1];
      if (끝 && 끝.date === r.on_day) 끝.items.push(r);
      else 묶음.push({ date: r.on_day, label: formatDateLabel(r.on_day), items: [r] });
    }
    return 묶음;
  })();

  const 상세로 = (r: 기록) => {
    상세열기(
      `/admin/log-detail?name=${encodeURIComponent(r.name)}`,
      { 때: 때.담기(), 구분, 사이트 },
      { back: "액션 기록" }
    );
  };

  const 센것 = 목록?.length ?? 0;

  return (
    <div className="admin-edit">
      <div className="cat-toolbar">
        <AdminPeriodBar 때={때} on필터={필터열기}>
          {날묶음.length > 0 && (
            <CollapseAllButtons
              onExpandAll={() => set접은날(new Set())}
              onCollapseAll={() => set접은날(new Set(날묶음.map((g) => g.date)))}
            />
          )}
        </AdminPeriodBar>
      </div>

      {/* 어느 사이트를 보고 있는지. 기간 줄에 함께 세우면 412px 화면에서
          필터가 다음 줄로 밀린다 — 넘기개 157px에 펼치개 88px, 필터 45px이
          이미 서 있다. 상세 쪽이 무엇을 보고 있는지 적는 그 줄과 같은 자리,
          같은 꼴이다(AdminLogDetail.tsx). */}
      <div className="pm-toolbar-row admin-toolbar-row">
        <AdminSitePick 값={사이트} on바뀜={set사이트} />
        <span className="admin-toolbar-row__gap" />
        {목록 && <span className="admin-span__tag">{건수글(전체, 센것)}</span>}
      </div>

      {목록 === null ? (
        <div className="card admin-soon">
          <p className="page-empty">불러오는 중입니다.</p>
        </div>
      ) : 탈 ? (
        <div className="card admin-soon">
          <p className="page-empty">기록을 불러오지 못했습니다.</p>
        </div>
      ) : 목록.length === 0 ? (
        <div className="card admin-soon">
          <p className="page-empty">조회된 기록이 없습니다.</p>
        </div>
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
                  센글={건수글(날수[묶음.date] ?? 묶음.items.length, 묶음.items.length)}
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
                      {/* 시각과 구분과 값은 글이 정해져 있어 폭을 못 박고,
                          남는 폭은 이름과 경로가 반씩 나눠 쓴다. 상세 쪽도
                          같은 다섯 칸이다(AdminLogDetail.tsx). */}
                      <col style={{ width: "76px" }} />
                      <col style={{ width: "46px" }} />
                      <col />
                      <col />
                      <col style={{ width: "70px" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>시각</th>
                        <th>구분</th>
                        <th className="admin-tbl__wrap">이름</th>
                        <th className="admin-tbl__wrap">경로</th>
                        <th>값</th>
                      </tr>
                    </thead>
                    <tbody>
                      {보일것.map((r, i) => (
                        <AdminGoRow
                          key={r.log_id}
                          on상세={() => 상세로(r)}
                          /* 먼저 펼친 줄 뒤에 오는 것들. 접힐 때 스르륵
                             닫히도록 이름을 단다. */
                          className={
                            스르륵 && i >= 먼저펼칠줄
                              ? `admin-tbl__extra${다폈나 ? "" : " is-folded"}`
                              : ""
                          }
                        >
                          <th className="admin-mono">{r.at_time}</th>
                          <td>
                            <span className={`admin-tbl__tag ${구분빛[r.kind] ?? "tint-잿빛"}`}>
                              {구분이름[r.kind] ?? r.kind}
                            </span>
                          </td>
                          {/* 이름과 경로를 따로 적는다. 조회는 「대시보드」와
                              `/admin/dash`처럼 가리키는 것이 같고, 외부는
                              「카카오 지도」와 「지도 띄우기」처럼 다르다.
                              한 칸에 하나만 적던 때는 그 둘이 줄마다 바뀌어
                              무엇을 보고 있는지 칸 이름으로는 알 수 없었다.

                              길은 글자 수를 세며 읽는 글이라 고른 폭 글꼴로
                              적는다. 쏠림은 둘 다 왼쪽이다(index.css의
                              .admin-tbl__left) — 한 칸에 글꼴 두 가지가
                              섞여 드는데 고른 폭만 가운데로 모이면 줄마다
                              쏠림이 달라진다. */}
                          <td
                            className={`admin-tbl__wrap admin-tbl__left${
                              길인가(줄이름(r)) ? " admin-mono" : ""
                            }`}
                          >
                            {줄이름(r)}
                          </td>
                          <td
                            className={`admin-tbl__wrap admin-tbl__left${
                              길인가(줄경로(r)) ? " admin-mono" : ""
                            }`}
                          >
                            {줄경로(r)}
                          </td>
                          {/* 값은 요청과 외부에만 붙는다. 실패한 줄은 상태가,
                              멀쩡히 끝난 줄은 걸린 시간이 알맹이다. */}
                          <td>{값딱지(r)}</td>
                        </AdminGoRow>
                      ))}
                      {묶음.items.length > 먼저펼칠줄 && (
                        <AdminMoreRow
                          칸수={5}
                          남은수={묶음.items.length - 먼저펼칠줄}
                          폈나={다폈나}
                          on바꾸기={() => 펼침.바꾸기(묶음.date)}
                        />
                      )}
                    </tbody>
                  </table>
                  {/* 그 날 것을 더 받는 띠. 표 안의 (...)는 이미 받아 둔 줄을
                      펼치고, 이것은 서버에서 그 날 것을 한 묶음 더 받는다
                      (AdminMoreAll.tsx). */}
                  <AdminMoreAll
                    받은수={묶음.items.length}
                    전체={날수[묶음.date] ?? 묶음.items.length}
                    한도={한번에받을수}
                    천장={받을수천장}
                    on더={() => 날더받기(묶음.date)}
                    on접기={() => 날접기(묶음.date)}
                  />
                </Collapse>
              </section>
            );
          })}
        </div>
      )}

      {필터열림 && (
        <AdminFilterPopup
          on초기화={() => set초안({ 구분: "", frm: "", to: "" })}
          on적용={적용}
          onClose={() => set필터열림(false)}
        >
          <EditField label="구분" span={12}>
            <SingleSelect
              noun="구분"
              options={[
                { value: "", label: "(전체)" },
                { value: "view", label: "조회" },
                { value: "feature", label: "기능" },
                { value: "error", label: "요청" },
                { value: "api", label: "외부" },
              ]}
              selected={초안.구분}
              onChange={(v) => set초안({ ...초안, 구분: v })}
              placeholder="(전체)"
            />
          </EditField>

          <EditDivider />

          <AdminPeriodFields
            frm={초안.frm}
            to={초안.to}
            on바뀜={(값) => set초안({ ...초안, ...값 })}
          />

          <EditField label="" span={12}>
            <p className="admin-hint">
              날짜를 둘 다 비우면 달 단위로 돌아갑니다. 새것부터 200줄까지
              보여 줍니다.
            </p>
          </EditField>
        </AdminFilterPopup>
      )}
    </div>
  );
}
