import { useEffect, useRef, useState } from "react";
import axios from "../api/client";
import { say } from "../utils/notify";
import MegaphoneIcon from "./components/MegaphoneIcon";
import CollapseToggle, { CollapseAllButtons } from "./components/CollapseToggle";
import Collapse from "./components/Collapse";
import DateGroupHeader from "./components/DateGroupHeader";
import QuickActions from "./components/QuickActions";
import { formatDateLabel } from "../utils/dateGroup";

/**
 * 공지사항.
 *
 * 홈의 띠는 안 읽은 것 하나만 띄우고, 읽거나 밀면 사라진다. 그래서 지난
 * 공지를 되짚을 자리가 따로 있어야 한다. 그 자리가 여기다.
 *
 * 뜨는 기간이 지난 공지도 여기서는 읽을 수 있다. 꺼 둔 공지는 서버가
 * 내보내지 않는다(app/routers/notices.py의 /all).
 *
 * 짜임은 설정 탭의 목록 화면들과 같다. 줄을 눌러 접고 펴고, 위에 모두
 * 펼치기|접기를 둔다. 공지는 제목만 보고 넘기는 때가 많아 접은 채로 연다.
 */

type 공지 = {
  notice_id: number;
  title: string;
  body: string | null;
  start_on: string | null;
  end_on: string | null;
  created_on: string | null;
  unread: boolean;
};

/** 오늘 날짜를 'YYYY-MM-DD'로. 서버 시각대를 믿으면 자정에 하루 어긋난다. */
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * 공지 한 장.
 *
 * 머리말을 누르면 본문이 펼쳐진다. 제목이 칸을 넘으면 뒤쪽이 옅어지다
 * (...)로 이어진다 — 내역 카드의 메모가 끊기는 꼴 그대로다
 * (pages/components/MemoPad.tsx).
 *
 * 카드마다 훅을 하나씩 걸어야 하므로 부품으로 뗀다. 이름을 영어로 적는 것은
 * 한글 이름이면 react-hooks 규칙이 부품으로 알아보지 못하기 때문이다.
 */
function NoticeCard({
  공지: n,
  폈나,
  on접기,
  on뒤집기,
}: {
  공지: 공지;
  폈나: boolean;
  on접기: () => void;
  on뒤집기: () => void;
}) {
  /* 제목이 칸을 넘었나. 넘은 것에만 자락과 (...)을 얹는다. CSS만으로는
     넘쳤는지 알 수 없어 재 본다. */
  const 제목칸 = useRef<HTMLSpanElement | null>(null);
  const [잘렸나, set잘렸나] = useState(false);

  useEffect(() => {
    const 재기 = () => {
      const e = 제목칸.current;
      if (e) set잘렸나(e.scrollWidth > e.clientWidth + 1);
    };
    재기();
    /* 창 폭이 바뀌면 끊기는 자리도 바뀐다. */
    window.addEventListener("resize", 재기);
    return () => window.removeEventListener("resize", 재기);
    /* 접고 펴면 끊기는지가 달라진다. 펼친 동안에는 글이 흘러 넘치지 않으므로
       재면 늘 "안 끊김"이고, 그 값을 그대로 들고 접으면 자락도 (...)도 없이
       글이 뚝 잘렸다. */
  }, [n.title, n.unread, 폈나]);

  return (
    <section className={`card notice-card${폈나 ? " is-open" : ""}`}>
      {/* 머리말은 설정 탭의 것과 같은 짜임이다 — 삼각형이 왼쪽 끝에 서고
          그 옆에 알맹이가 온다(.set-group__head). 삼각형과 글 칸은 나란한
          형제다. 단추 안에 단추를 넣으면 안 되고, 전역 button 규칙이
          white-space를 nowrap으로 못 박아 긴 제목이 칸 밖으로 뻗었다. */}
      <div className="set-group__head notice-card__head">
        <CollapseToggle open={폈나} onToggle={on접기} label={n.title} />
        <button
          type="button"
          className="notice-card__btn"
          onClick={on접기}
          aria-expanded={폈나}
        >
          <span className="notice-band__tag">
            <MegaphoneIcon />
            공지
          </span>
          <span ref={제목칸} className="notice-card__title">
            {n.title}
            {/* 끊긴 끝 — 뒤쪽을 길게 걸쳐 옅어지다 (...)로 이어진다. 짧게
                덮으면 끝이 딱 떨어져 테이프를 붙여 놓은 것처럼 보인다. */}
            {잘렸나 && (
              <span className="notice-card__fade" aria-hidden="true">
                (...)
              </span>
            )}
          </span>
          {/* 안 읽음 딱지는 접혀 있을 때만. 펼치면 오른쪽 끝의 체크 상자가
              같은 것을 말하므로 둘이 겹친다. */}
          {n.unread && !폈나 && <span className="notice-card__new">안 읽음</span>}
        </button>
        {/* 읽음 표를 뒤집는 체크 상자. 읽은 것은 홈의 띠에 다시 뜨지 않으므로,
            다시 받아 보려면 여기서 되돌려야 한다. 펼쳤을 때만 선다 — 접힌
            목록에 줄마다 상자가 서면 목록이 아니라 설정 화면처럼 읽힌다.
            꼴은 앱이 쓰던 체크 상자 그대로다(.cp-toggle). */}
        {폈나 && (
          <label className="cp-toggle notice-card__mark">
            <input type="checkbox" checked={!n.unread} onChange={on뒤집기} />
            읽음
          </label>
        )}
      </div>

      {/* 접고 펴는 자리는 앱이 쓰는 부품에 맡긴다. 움직임을 끈 기기에서는
          저가 알아서 곧장 선다. */}
      <Collapse open={폈나}>
        <div className="notice-card__body">
          {n.body && <p className="notice-band__text">{n.body}</p>}
        </div>
      </Collapse>
    </section>
  );
}

export default function Notices() {
  const [목록, set목록] = useState<공지[] | null>(null);
  /* 접은 것을 든다. 설정 탭의 목록들과 같은 꼴이다. */
  const [접힘, set접힘] = useState<Set<string>>(new Set());

  /**
   * 읽음 표를 뒤집는다.
   *
   * 읽은 자리는 "여기까지"라는 금 하나뿐이라, 한 건만 안 읽음으로 돌리는
   * 길을 서버가 따로 낸다(/notices/unread). 읽음으로 바꾸는 것은 금을
   * 올리는 일이라 예전 길을 그대로 쓴다.
   *
   * 화면은 먼저 바꾼다. 서버가 받아들이는 것을 기다렸다 바꾸면 누른 뒤
   * 한 박자 멈춘 것처럼 보인다. 못 적었으면 되돌리고 알린다.
   */
  const 뒤집기 = async (n: 공지) => {
    const 다음 = !n.unread;
    set목록((v) => (v ?? []).map((x) => (x.notice_id === n.notice_id ? { ...x, unread: 다음 } : x)));
    try {
      if (다음) await axios.put("/notices/unread", { notice_id: n.notice_id });
      else await axios.put("/notices/read", { notice_id: n.notice_id });
      say.ok(다음 ? "안 읽음으로 바꿨습니다." : "읽음으로 바꿨습니다.");
    } catch {
      set목록((v) => (v ?? []).map((x) => (x.notice_id === n.notice_id ? { ...x, unread: n.unread } : x)));
      say.bad("바꾸지 못했습니다. 다시 시도해 주세요.");
    }
  };

  const 접기 = (열쇠: string) =>
    set접힘((v) => {
      const 다음 = new Set(v);
      if (다음.has(열쇠)) 다음.delete(열쇠);
      else 다음.add(열쇠);
      return 다음;
    });

  useEffect(() => {
    let 살아있나 = true;
    axios
      .get("/notices/all", { params: { today: ymd(new Date()) } })
      .then((r) => {
        if (!살아있나) return;
        const 들 = (r.data as 공지[]) ?? [];
        set목록(들);
        /* 모두 접은 채로 연다. 제목만 죽 훑고 볼 것만 펼치는 자리라,
           펼쳐 놓고 열면 스크롤만 길어진다. 안 읽은 것은 딱지로 갈린다. */
        set접힘(new Set(들.map((n) => String(n.notice_id))));
      })
      .catch(() => {
        if (살아있나) set목록([]);
      });
    return () => {
      살아있나 = false;
    };
  }, []);

  /* 등록한 날로 묶는다. 내역 화면이 날짜마다 단을 세우는 것과 같은 꼴이다
     (pages/Entries.tsx). 날짜를 카드 안에 딱지로 달았더니 같은 날 적은
     공지끼리 묶이지 않아, 몇 날에 걸쳐 온 것인지 한눈에 안 읽혔다.
     목록이 이미 새것부터이므로 나오는 차례를 그대로 쓴다. */
  const 날묶음 = (() => {
    const 묶음: { date: string; label: string; items: 공지[] }[] = [];
    for (const n of 목록 ?? []) {
      const 날 = n.created_on ?? "";
      const 끝 = 묶음[묶음.length - 1];
      if (끝 && 끝.date === 날) 끝.items.push(n);
      else 묶음.push({ date: 날, label: 날 ? formatDateLabel(날) : "날짜 없음", items: [n] });
    }
    return 묶음;
  })();

  return (
    <div className="page-wrap">
      {목록 !== null && 목록.length > 0 && (
        <div className="toolbar-wrap">
          <div className="toolbar">
            <div className="toolbar-btns">
              <CollapseAllButtons
                onExpandAll={() => set접힘(new Set())}
                onCollapseAll={() => set접힘(new Set(목록.map((n) => String(n.notice_id))))}
              />
            </div>
          </div>
        </div>
      )}

      {목록 === null ? (
        <p className="page-empty">불러오고 있습니다.</p>
      ) : 목록.length === 0 ? (
        <p className="page-empty">등록된 공지가 없습니다.</p>
      ) : (
        <div className="card-list">
          {날묶음.map((묶음) => (
            <section key={묶음.date || "날짜없음"} className="date-group">
              {/* 등록한 날은 카드 밖, 단 머리말이 말한다. 내역 화면이 쓰는
                  그 부품이다. 셈할 돈이 없으므로 합계는 접는다(hideSum).
                  접는 손잡이는 달지 않는다 — 카드마다 제 손잡이가 있어,
                  접는 자리가 둘이면 어느 것을 누른 것인지 헷갈린다. */}
              <DateGroupHeader
                label={묶음.label}
                summary={{ count: 묶음.items.length, inSum: 0, outSum: 0, net: 0 }}
                hideSum
              />
              {묶음.items.map((n) => (
                <NoticeCard
                  key={n.notice_id}
                  공지={n}
                  폈나={!접힘.has(String(n.notice_id))}
                  on접기={() => 접기(String(n.notice_id))}
                  on뒤집기={() => void 뒤집기(n)}
                />
              ))}
            </section>
          ))}
        </div>
      )}

      {/* 떠 있는 단추들. 맨 위로 단추도 이 안에 들어 있다. 다른 화면이
          모두 제 끝에 이것을 세운다(pages/Places.tsx 등). */}
      <QuickActions />
    </div>
  );
}
