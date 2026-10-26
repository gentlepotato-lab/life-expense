import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { PAGE_TITLE } from "../../utils/pageTitles";
import { 관리자쪽이름 } from "../../utils/adminTabs";
import { formatDateLabel } from "../../utils/dateGroup";
import useAdminFold from "../../hooks/useAdminFold";
import useAdminPeriod, { type 기간짐 } from "../../hooks/useAdminPeriod";
import AdminPeriodBar from "./AdminPeriodBar";
import AdminPeriodFields from "./AdminPeriodFields";
import AdminMoreRow from "./AdminMoreRow";
import AdminFilterPopup from "./AdminFilterPopup";
import DateGroupHeader from "./DateGroupHeader";
import Collapse from "./Collapse";
import { CollapseAllButtons } from "./CollapseToggle";
import { EditField } from "./CardEditModal";
import AdminMoreAll from "./AdminMoreAll";
import {
  건수글,
  구분이름,
  구분빛,
  값딱지,
  줄이름,
  줄경로,
  길인가,
  먼저펼칠줄,
  스르륵한도,
  한번에받을수,
  받을수천장,
} from "./adminLogBits";

/**
 * 액션 상세.
 *
 * 이름 하나만 모아 본다. 액션 기록 쪽에서 줄을 꾹 누르면 그 줄의 이름을 들고
 * 들어온다(AdminLogs.tsx).
 *
 * 기간과 거르기는 들어올 때 그대로 실려 오고, 여기서 다시 고칠 수도 있다.
 * 되돌아가는 단추는 바로 앞 쪽으로 돌아가므로, 거기서 보던 기간이 그대로
 * 남아 있다. 사용자 사이트의 기간 상세와 같은 잣대다
 * (pages/PeriodDetail.tsx).
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

export default function AdminLogDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [찾기] = useSearchParams();
  const 이름 = 찾기.get("name") || "";

  /* 앞 쪽에서 실려 온 기간. 주소만으로 들어왔으면 이번 달부터 본다. */
  const 실린것 = (location.state as { 때?: 기간짐; back?: string } | null) ?? null;
  const 때 = useAdminPeriod(실린것?.때 ?? null);
  const 돌아갈곳 = 실린것?.back ?? "액션 기록";

  const [초안, set초안] = useState({ frm: "", to: "" });
  const [필터열림, set필터열림] = useState(false);
  const [목록, set목록] = useState<기록[] | null>(null);
  /* 그 기간에 그 이름으로 쌓인 전체 수와 날마다 쌓인 수. 받는 줄은 날마다
     한도까지다(AdminLogs.tsx). */
  const [전체, set전체] = useState(0);
  const [날수, set날수] = useState<Record<string, number>>({});
  /* 날마다 서버에 달라고 한 줄 수. 액션 기록과 같은 잣대다. */
  const [날한도, set날한도] = useState<Record<string, number>>({});
  const [탈, set탈] = useState(false);
  const [접은날, set접은날] = useState<Set<string>>(new Set());
  /* 긴 날의 나머지를 펼치고 접는 자리. 한 번 펼친 날은 줄을 세운 채
     접었다 폈다 하므로 스르륵 닫힌다(hooks/useAdminFold.ts). */
  const 펼침 = useAdminFold();

  const 받기 = useCallback(() => {
    if (!이름) {
      set목록([]);
      return;
    }
    set탈(false);
    axios
      .get("/admin/logs", {
        headers: 머리(),
        params: { frm: 때.기간.frm, to: 때.기간.to, name: 이름, limit: 한번에받을수 },
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
  }, [때.기간.frm, 때.기간.to, 이름]);

  useEffect(받기, [받기]);

  /** 그 날 것을 한 묶음 더 받는다. 하루만 다시 묻는다(AdminLogs.tsx). */
  const 날더받기 = useCallback(
    (날: string) => {
      const 다음 = Math.min((날한도[날] ?? 한번에받을수) + 한번에받을수, 받을수천장);
      axios
        .get("/admin/logs", {
          headers: 머리(),
          params: { frm: 날, to: 날, name: 이름, limit: 다음 },
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
    [날한도, 이름]
  );

  /** 그 날을 처음 묶음까지만 남긴다. */
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
    set초안({ frm: 때.거른기간?.frm ?? "", to: 때.거른기간?.to ?? "" });
    set필터열림(true);
  };

  const 적용 = () => {
    if (!때.기간걸기(초안.frm, 초안.to)) return;
    set필터열림(false);
  };

  const 날묶음 = (() => {
    const 묶음: { date: string; label: string; items: 기록[] }[] = [];
    for (const r of 목록 ?? []) {
      const 끝 = 묶음[묶음.length - 1];
      if (끝 && 끝.date === r.on_day) 끝.items.push(r);
      else 묶음.push({ date: r.on_day, label: formatDateLabel(r.on_day), items: [r] });
    }
    return 묶음;
  })();

  /* 띄우는 이름. 조회는 길이 이름이라 그 길이 가리키는 화면 이름으로 적는다.
     표 안의 이름 칸과 같은 조각을 쓴다(adminLogBits.tsx의 줄이름). */
  const 적을이름 = 관리자쪽이름(이름) ?? PAGE_TITLE[이름] ?? 이름;
  const 센것 = 목록?.length ?? 0;

  return (
    <div className="admin-edit">
      <div className="cat-toolbar">
        <AdminPeriodBar
          때={때}
          on필터={필터열기}
          뒤로={{ 이름: 돌아갈곳, on누름: () => navigate(-1) }}
        >
          {날묶음.length > 0 && (
            <CollapseAllButtons
              onExpandAll={() => set접은날(new Set())}
              onCollapseAll={() => set접은날(new Set(날묶음.map((g) => g.date)))}
            />
          )}
        </AdminPeriodBar>
      </div>

      {/* 무엇을 보고 있는지 적는 줄. 이름은 주소에만 실려 있어 적지 않으면
          어느 이름의 기록인지 알 길이 없다. */}
      <div className="pm-toolbar-row admin-toolbar-row">
        <span className={`admin-span__tag${이름.startsWith("/") ? " admin-mono" : ""}`}>
          {적을이름}
        </span>
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
      ) : 날묶음.length === 0 ? (
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
                    {/* 액션 기록과 같은 다섯 칸이다(AdminLogs.tsx). 줄을 꾹
                        눌러 들어온 자리라 두 표의 칸이 다르면 같은 줄을 다른
                        줄로 읽게 된다. */}
                    <colgroup>
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
                        <tr
                          key={r.log_id}
                          className={
                            스르륵 && i >= 먼저펼칠줄
                              ? `admin-tbl__extra${다폈나 ? "" : " is-folded"}`
                              : undefined
                          }
                        >
                          <th className="admin-mono">{r.at_time}</th>
                          <td>
                            <span className={`admin-tbl__tag ${구분빛[r.kind] ?? "tint-잿빛"}`}>
                              {구분이름[r.kind] ?? r.kind}
                            </span>
                          </td>
                          {/* 이름과 경로. 액션 기록과 같은 조각으로 적는다
                              (adminLogBits.tsx). 쏠림은 둘 다 왼쪽이다. */}
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
                          <td>{값딱지(r)}</td>
                        </tr>
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
                  {/* 그 날 것을 더 받는 띠(AdminMoreAll.tsx). */}
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
          on초기화={() => set초안({ frm: "", to: "" })}
          on적용={적용}
          onClose={() => set필터열림(false)}
        >
          <AdminPeriodFields
            frm={초안.frm}
            to={초안.to}
            on바뀜={(값) => set초안(값)}
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
