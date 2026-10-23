import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useLongPress from "../../hooks/useLongPress";
import usePeel from "../../hooks/usePeel";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { say } from "../../utils/notify";
import { 짧은날짜글 } from "../../utils/adminFmt";
import { hour12 } from "../../utils/day";
import AdminBatchPopup, { type 초안 } from "./AdminBatchPopup";

/**
 * 배치.
 *
 * 저 혼자 도는 일 셋을 늘어놓고, 도는 때를 고친다.
 *
 * 카드 꼴은 정기 내역과 같다(pages/ScheduledEntries.tsx). 클래스까지 같은
 * 것을 쓴다. 첫 줄에 이름과 마지막 결과, 둘째 줄에 「언제 | 몇 시」 딱지와
 * 상세 이력으로 들어가는 단추, 셋째 줄 오른쪽 끝에 마지막 실행과 다음 실행
 * 딱지가 나란히 선다. 거기도 정기적으로 되풀이되는 것을 늘어놓는 자리라,
 * 같은 꼴로 읽히는 편이 맞다.
 *
 * 뜯거나 꾹 누르면 편집 팝업이 열린다. 내역 카드와 같은 두 손짓이다
 * (hooks/usePeel.ts, hooks/useLongPress.ts). 톡 눌러 열게 두면 목록을
 * 훑다가 팝업이 뜬다.
 *
 * 때는 표가 쥐고, 고치면 그 자리에서 다시 걸린다
 * (app/scheduler/registry.py의 reschedule).
 */

type 일 = {
  key: string;
  name: string;
  kind: string;
  day_of_month: number | null;
  hour: number | null;
  minute: number | null;
  is_active: number;
  next_day: string | null;
  next_time: string | null;
  last_day: string | null;
  last_time: string | null;
  last_ok: boolean | null;
  last_note: string;
};

/** 두 자리로. 9시를 「9:5」로 적으면 시각으로 안 읽힌다. */
const 두자리 = (n: number | null) => String(n ?? 0).padStart(2, "0");

/** 얼마나 자주 도는가. 딱지 앞칸에 적는다. */
function 주기글(j: 일): string {
  if (j.kind === "minute") return "매분";
  if (j.kind === "daily") return "매일";
  return `매달 ${j.day_of_month ?? 1}일`;
}

/**
 * 몇 시에 도는가. 매분 도는 일에는 적을 것이 없다.
 *
 * 12시간제로 적는다. 정기 내역 카드의 같은 자리와 같은 꼴이다
 * (.schedule-card__when-time). 고치는 칸은 24시간제 그대로 둔다.
 */
function 시각글(j: 일): string {
  if (j.kind === "minute") return "";
  return hour12(`${두자리(j.hour)}:${두자리(j.minute)}`);
}

/** 오른쪽으로 들어가는 표. 글만 두면 눌러 보라는 것인지 안 읽힌다. */
const 들어가기 = (
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
    <path
      d="M6 4l4 4-4 4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * 배치 한 장.
 *
 * 카드마다 훅을 하나씩 걸어야 하므로 부품으로 뗀다. map() 안에서는 훅을
 * 부를 수 없다. 이름을 영어로 적는 것은 한글 이름이면 react-hooks 규칙이
 * 부품으로 알아보지 못하기 때문이다.
 */
function BatchCard({
  일: j,
  on열기,
  on이력,
}: {
  일: 일;
  on열기: () => void;
  on이력: () => void;
}) {
  const { pressing, handlers } = useLongPress(on열기);
  const peel = usePeel(on열기);

  return (
    <div
      className={`card card--entry schedule-card card--pressable${pressing ? " pressing" : ""}`}
      title="꾹 눌러서 편집"
      {...handlers}
    >
      {/* 왼쪽 위에 끼운 책갈피와, 뜯을 때 비는 자리와 접혀 넘어오는 조각.
          내역 카드와 같은 겹을 같은 차례로 세운다(pages/ScheduledEntries.tsx).
          책갈피 빛깔만 이 쪽 잉크를 쓴다 — 수입도 지출도 아닌 자리라
          풀빛이나 벽돌빛이 설 까닭이 없다. */}
      <div className="inout-bar" />
      <span className="peel-patch" aria-hidden="true" />
      <span className="peel-flap" aria-hidden="true">
        <span className="peel-flap__face" />
      </span>
      <span className="peel-grip" data-no-longpress aria-hidden="true" {...peel} />
      <span className="peel-tip" aria-hidden="true">
        뜯으면 편집 팝업이 뜹니다.
      </span>

      <div className="schedule-card__body">
        {/* 1행: 이름과 마지막 결과. 정기 내역의 분류와 금액이 서던 자리다. */}
        <div className="entry-ln entry-ln--head">
          <span className="cat-display">
            <span className="cat-text">{j.name}</span>
          </span>
          <span className="admin-batch__note">{j.last_note || "-"}</span>
        </div>

        {/* 2행: 언제 도는지와 상세 이력으로 들어가는 단추. 날과 시각은 한
            가지 사실이라 한 딱지에 담는다. 정기 내역도 그렇게 담는다. */}
        <div className="entry-ln">
          <span className="schedule-card__when">
            <span className="schedule-card__when-day">{주기글(j)}</span>
            {시각글(j) && (
              <>
                <span className="schedule-card__when-cut" aria-hidden="true" />
                <span className="schedule-card__when-time">{시각글(j)}</span>
              </>
            )}
          </span>
          <span className="admin-batch__gap" />
          {/* 카드에는 마지막 한 줄만 선다. 며칠째 실패하는 중인지는 이력 쪽에서
              본다. 단추에서 시작한 누름은 꾹 누르기가 받지 않는다
              (hooks/useLongPress.ts). */}
          <button type="button" className="admin-go" onClick={on이력}>
            이력
            {들어가기}
          </button>
        </div>

        {/* 3행: 마지막 실행과 다음 실행. 둘이 같은 결의 사실이라 한 줄
            오른쪽 끝에 나란히 세운다. 폭이 모자라면 아래로 접힌다 — 글을
            잘라 내느니 한 줄을 더 쓰는 쪽이 낫다. 날짜에서 해만 덜어 내고
            시각은 12시간제로 적는다(utils/day.ts의 hour12). 정기 내역 카드가
            시각을 적는 꼴과 같다. */}
        <div className="entry-ln admin-batch__runs">
          <span
            className={`admin-tbl__chip ${j.last_ok === false ? "tint-분홍" : "tint-잿빛"}`}
          >
            {j.last_day
              ? `마지막 실행 ${짧은날짜글(j.last_day)} ${hour12(j.last_time ?? "")}`
              : "아직 실행된 적이 없습니다."}
          </span>
          {j.next_day && (
            <span className="admin-tbl__chip tint-보라">
              다음 실행 {짧은날짜글(j.next_day)} {hour12(j.next_time ?? "")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminBatch() {
  const navigate = useNavigate();
  const [목록, set목록] = useState<일[] | null>(null);
  const [탈, set탈] = useState(false);
  /* 고치는 중인 일. 없으면 팝업을 그리지 않는다. */
  const [고칠것, set고칠것] = useState<일 | null>(null);
  const [초안, set초안] = useState<초안 | null>(null);

  const 받기 = useCallback(() => {
    axios
      .get("/admin/batch", { headers: 머리() })
      .then((r) => set목록(r.data as 일[]))
      .catch(() => {
        set목록([]);
        set탈(true);
      });
  }, []);

  useEffect(받기, [받기]);

  const 열기 = (j: 일) => {
    set고칠것(j);
    /* 시각은 "HH:MM" 한 글로 쥔다. 정기 내역의 편집 칸과 같은 꼴이다. */
    set초안({
      kind: j.kind,
      day_of_month: j.day_of_month ?? 20,
      time: `${두자리(j.hour)}:${두자리(j.minute)}`,
    });
  };

  const 저장 = async () => {
    if (!고칠것 || !초안) return;
    if (초안.kind !== "minute" && !/^\d{2}:\d{2}$/.test(초안.time)) {
      say.warn("시간을 입력해 주세요.");
      return;
    }
    const [시, 분] = 초안.time.split(":").map(Number);
    try {
      await axios.put(
        `/admin/batch/${고칠것.key}`,
        {
          kind: 초안.kind,
          ...(초안.kind === "minute" ? {} : { hour: 시, minute: 분 }),
          ...(초안.kind === "monthly" ? { day_of_month: 초안.day_of_month } : {}),
        },
        { headers: 머리() },
      );
      say.ok("저장 완료-!! ;-)");
      set고칠것(null);
      set초안(null);
      받기();
    } catch {
      say.bad("저장하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  return (
    <div className="admin-edit">
      {목록 === null ? (
        <div className="card admin-soon">
          <p className="page-empty">불러오는 중입니다.</p>
        </div>
      ) : 탈 ? (
        <div className="card admin-soon">
          <p className="page-empty">작업을 불러오지 못했습니다.</p>
        </div>
      ) : 목록.length === 0 ? (
        <div className="card admin-soon">
          <p className="page-empty">등록한 작업이 없습니다.</p>
        </div>
      ) : (
        목록.map((j) => (
          <BatchCard
            key={j.key}
            일={j}
            on열기={() => 열기(j)}
            on이력={() =>
              navigate(`/admin/batch-runs?key=${j.key}`, {
                state: { back: "배치" },
              })
            }
          />
        ))
      )}

      {고칠것 && 초안 && (
        <AdminBatchPopup
          이름={고칠것.name}
          값={초안}
          on바뀜={set초안}
          on저장={() => void 저장()}
          onClose={() => {
            set고칠것(null);
            set초안(null);
          }}
        />
      )}
    </div>
  );
}
