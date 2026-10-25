import { useEffect, useRef, useState } from "react";
import axios from "../../api/client";
import MegaphoneIcon from "./MegaphoneIcon";

/**
 * 홈 맨 위에 떠 있는 공지 띠.
 *
 * 한 줄로 서 있다가 누르면 본문이 펼쳐진다. 좌우 어느 쪽으로든 밀면 이번
 * 판에서 감춘다.
 *
 * **밀어 감추는 것과 읽는 것은 다르다.** 미는 것은 "지금은 안 볼래"일 뿐이라
 * 창을 닫았다 열면 다시 뜬다. 읽음으로 적히는 것은 [읽음]을 눌렀을 때뿐이고,
 * 그때만 서버에 적혀 다른 기기에서도 뜨지 않는다. 밀기만으로 영영 못 보게
 * 하면 실수로 한 번 민 공지를 다시 찾을 길이 없다. 지난 공지는 공지사항
 * 화면에서 다시 읽는다(pages/Notices.tsx).
 *
 * 글 흐름에서 빼내 띄운다(position: absolute). 흐름 안에 두었더니 공지 하나에
 * 홈 카드가 55px, 펼치면 160px씩 내려앉았다. 띄우면 아래 카드가 한 치도
 * 움직이지 않는 대신 띠가 카드 한 장을 덮는데, 밀어 바로 치울 수 있으므로
 * 덮이는 쪽을 선택했다.
 *
 * **뜰 공지가 없으면 아무것도 그리지 않는다.** 빈 띠를 높이 0으로 두면 안
 * 된다. 홈은 손이 가장 자주 닿는 화면이라 한 픽셀이라도 밀리면 안 되고,
 * 공지를 쓰기 전까지는 지금 홈과 똑같아야 한다.
 *
 * 생김새는 홈의 카드(.home-card)와 같은 결을 쓴다. 띠만 다른 꼴로 서면
 * 홈에서 혼자 튄다.
 */

type 공지 = {
  notice_id: number;
  title: string;
  body: string | null;
};

/** 오늘 날짜를 'YYYY-MM-DD'로. 서버 시각대를 믿으면 자정에 하루 어긋난다. */
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * 이번 판에 밀어 감춘 공지 번호.
 *
 * sessionStorage에 담는다. 창을 닫으면 사라지므로 다음에 열면 다시 뜬다.
 * 그것이 "이번 판만 감춤"의 뜻이다. 관리자 토큰을 담는 자리와 같은 잣대다
 * (utils/adminSession.ts).
 */
const 감춘열쇠 = "life-expense:notice-hidden";

function 감춘것(): number[] {
  try {
    const 글 = window.sessionStorage.getItem(감춘열쇠);
    const 들 = 글 ? (JSON.parse(글) as unknown) : null;
    return Array.isArray(들) ? 들.filter((x): x is number => typeof x === "number") : [];
  } catch {
    /* 담는 자리를 막은 브라우저도 있다. 그때는 감춘 것이 없는 셈이다. */
    return [];
  }
}

function 감추기(id: number): void {
  try {
    const 다음 = [...new Set([...감춘것(), id])];
    window.sessionStorage.setItem(감춘열쇠, JSON.stringify(다음));
  } catch {
    /* 못 담아도 이번 그림에서는 사라진다. 다음에 열면 다시 뜰 뿐이다. */
  }
}

/** 밀어 날리는 잣대. 띠 폭의 이만큼을 넘기면 그쪽으로 보낸다. */
const 날릴참 = 0.35;

/** 날아가거나 제자리로 돌아오는 데 걸리는 참. */
const 날아가는참 = ".22s";

/** 움직임을 꺼 두었나. 돈쓴이의 화면 애니메이션 스위치가 html에 표를 단다. */
const 움직임꺼짐 = () => document.documentElement.dataset.motion === "off";

export default function NoticeBand() {
  const [공지들, set공지들] = useState<공지[]>([]);
  const [펼침, set펼침] = useState(false);
  /* 날아가는 중인가. 끝나면 목록에서 뺀다. */
  const [날림, set날림] = useState(false);
  const 띠칸 = useRef<HTMLElement | null>(null);
  /* 제목이 칸을 넘었나. 넘으면 뒤쪽이 옅어지다 (...)로 이어진다. 공지사항
     화면과 내역 카드의 메모가 끊기는 꼴 그대로다. */
  const 제목칸 = useRef<HTMLSpanElement | null>(null);
  const [잘렸나, set잘렸나] = useState(false);
  /* 접혀 있을 때의 키. 두 군데에 쓴다. 펼칠 때 윗변을 못 박는 자리와,
     뒤 장의 키를 앞 장에 맞추는 자리다. 뒤 장에 쓰려면 다시 그려야 하므로
     ref가 아니라 state로 든다. */
  const [접힌키, set접힌키] = useState(0);
  /* 끄는 동안의 값. 다시 그릴 거리가 아니므로 state로 두지 않는다.
     손끝을 따라 옮기는 일은 style로 직접 한다. */
  const 끌기 = useRef({ x: 0, y: 0, 잡았나: false, 가로인가: null as boolean | null, id: -1 });

  useEffect(() => {
    let 살아있나 = true;
    axios
      .get("/notices", { params: { today: ymd(new Date()) } })
      .then((r) => {
        if (!살아있나) return;
        /* 아직 안 읽은 것만 서버가 선택해 보낸다. 읽은 자리를 서버가 들고
           있어야 폰에서 읽은 것이 PC에서 또 뜨지 않는다. 이번 판에 밀어
           감춘 것은 여기서 뺀다. 그쪽은 서버가 모른다. */
        const 숨긴것 = new Set(감춘것());
        set공지들(((r.data as 공지[]) ?? []).filter((n) => !숨긴것.has(n.notice_id)));
      })
      .catch(() => {
        /* 못 받아 오면 띠를 그리지 않는다. 공지 때문에 홈이 비어 보이면 안 된다. */
      });
    return () => {
      살아있나 = false;
    };
  }, []);

  /* 제목이 끊겼는지 잰다. 띄운 공지가 바뀌면 다시 잰다. CSS만으로는
     넘쳤는지 알 수 없다. */
  useEffect(() => {
    const 재기 = () => {
      const e = 제목칸.current;
      if (e) set잘렸나(e.scrollWidth > e.clientWidth + 1);
    };
    재기();
    window.addEventListener("resize", 재기);
    return () => window.removeEventListener("resize", 재기);
    /* 펼치면 글이 흘러 넘치지 않아 늘 "안 끊김"으로 재진다. 접을 때 다시
       재야 자락과 (...)이 돌아온다. */
  }, [공지들, 펼침]);

  /* 접혀 있는 동안의 키를 재 둔다. 띠는 아랫변이 카드에 맞춰 붙박이라,
     펼쳐 제목이 여러 줄이 되면 위로 자라 떠 있는 단추들과 겹쳤다. 펼칠 때
     이 키로 윗변을 그 자리에 못 박아 아래로 자라게 한다. */
  useEffect(() => {
    if (펼침 || !띠칸.current) return;
    const 잰것 = 띠칸.current.offsetHeight;
    /* 같은 값이면 다시 그리지 않는다. 그러지 않으면 재고 그리기를 되풀이한다. */
    set접힌키((v) => (v === 잰것 ? v : 잰것));
  }, [펼침, 공지들, 잘렸나]);

  if (공지들.length === 0) return null;

  /* 여럿이면 가장 앞 차례 하나만 띄운다. 띠가 쌓이면 홈이 가린다. */
  const 지금것 = 공지들[0];
  const 더있나 = 공지들.length - 1;

  /**
   * 한 장을 목록에서 뺀다. 다음 장이 있으면 그 자리에 올라선다.
   *
   * 날아간 장에 걸어 준 transform 과 opacity 는 풀지 않는다. 풀면 그 장이
   * 제자리로 돌아와 멀쩡히 보이는데, 이 자리가 transitionend 에서 불리기
   * 때문에 React 가 그 장을 거두는 것은 다음 차례로 미뤄진다. 그 사이에
   * 브라우저가 한 번 그려, 민 공지가 깜빡 다시 떴다가 사라졌다.
   *
   * 풀어 줄 까닭도 없다. 장마다 key 가 공지 번호라, 맨 앞 장은 목록에서
   * 빠지면서 그 조각째 거둬진다. 다음 장은 저가 쓰던 다른 조각이다.
   */
  const 다음장 = () => {
    set공지들((v) => v.slice(1));
    set펼침(false);
    set날림(false);
  };

  const 읽음 = () => {
    /* 가장 큰 번호를 적는다. 여럿을 한 번에 읽은 것으로 본다. */
    const 가장큰것 = Math.max(...공지들.map((n) => n.notice_id));
    void axios.put("/notices/read", { notice_id: 가장큰것 }).catch(() => {
      /* 못 적어도 이번 판은 접는다. 다음에 열면 다시 뜬다. */
    });
    set공지들([]);
  };

  /* ── 미는 손짓 ─────────────────────────────────────────────
     세로로 끌면 손을 뗀다. 띠가 홈 맨 위에 서므로, 거기서 아래로 쓸어
     내리려던 손짓까지 띠가 먹으면 홈이 구르지 않는다. 처음 6px으로
     가로인지 세로인지 가른다. */
  const 잡기 = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    끌기.current = { x: e.clientX, y: e.clientY, 잡았나: true, 가로인가: null, id: e.pointerId };
  };

  const 끌리기 = (e: React.PointerEvent) => {
    const 손 = 끌기.current;
    const 칸 = 띠칸.current;
    if (!손.잡았나 || !칸 || e.pointerId !== 손.id) return;
    const dx = e.clientX - 손.x;
    const dy = e.clientY - 손.y;
    if (손.가로인가 === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      손.가로인가 = Math.abs(dx) > Math.abs(dy);
      if (!손.가로인가) {
        손.잡았나 = false;
        return;
      }
      /* 가로로 가는 것이 정해진 이 참에 미끄러짐을 끊는다. 남겨 두면 띠가
         손끝을 0.22s 늦게 따라온다. 손을 뗄 때 놓기가 도로 걸어 준다.
         잡을 때가 아니라 여기서 끊는 것은, 세로로 쓸고 만 손짓에까지
         끊어 놓으면 그 장이 앞자리로 올라올 때 쓸 미끄러짐까지 없어지기
         때문이다. */
      칸.style.transition = "none";
      칸.setPointerCapture(손.id);
    }
    const 폭 = 칸.offsetWidth || 1;
    칸.style.transform = `translateX(${dx}px)`;
    칸.style.opacity = String(Math.max(0, 1 - (Math.abs(dx) / 폭) * 1.4));
  };

  const 놓기 = (e: React.PointerEvent) => {
    const 손 = 끌기.current;
    const 칸 = 띠칸.current;
    if (!손.잡았나 || !칸 || e.pointerId !== 손.id) return;
    손.잡았나 = false;
    const dx = e.clientX - 손.x;
    const 폭 = 칸.offsetWidth || 1;
    if (손.가로인가 && Math.abs(dx) > 폭 * 날릴참) {
      감추기(지금것.notice_id);
      set날림(true);
      /* 움직임을 끈 기기에서는 곧장 치운다. transitionend가 오지 않으므로
         기다리면 띠가 반쯤 밀린 채로 굳는다(utils/motion.ts). */
      if (움직임꺼짐()) {
        다음장();
        return;
      }
      칸.style.transition = `transform ${날아가는참} var(--ease), opacity ${날아가는참} var(--ease)`;
      칸.style.transform = `translateX(${dx > 0 ? 120 : -120}%)`;
      칸.style.opacity = "0";
      return;
    }
    /* 못 넘기면 제자리로. 손을 뗀 자리에서 미끄러져 돌아와야 밀다 만 것이
       눈에 보인다. */
    칸.style.transition = `transform ${날아가는참} var(--ease), opacity ${날아가는참} var(--ease)`;
    칸.style.transform = "";
    칸.style.opacity = "";
  };

  /* 뒤 두 장까지만 겹쳐 세운다. 더 쌓으면 그림자가 뭉개져 몇 장인지도
     알 수 없고, 맨 앞 장을 밀 때 뒤가 들썩여 보인다. 몇 장 남았는지는
     +N 이 적는다. */
  const 보일것 = 공지들.slice(0, 3);

  return (
    /* 받치는 조각. 접힌 띠는 이 안에 제 자리로 서서 카드를 덮지 않고,
       펼친 본문만 띠 아래로 떠오른다. 공지를 밀어 없애면 이 자리는
       통째로 거둬진다.

       겹쳐 선 장들은 모두 이 조각을 기준으로 같은 자리에 뜨고, 뒤 장만
       위로 밀려 테가 비죽 보인다. 맨 앞 장을 밀어내면 뒤 장이 제 자리로
       미끄러져 올라온다. 넘기는 손맛이 거기서 난다.
       그리는 차례는 뒤 장부터다. 같은 자리에 겹치므로 나중에 그린 것이
       위에 선다. */
    <div className="notice-dock">
      {[...보일것].reverse().map((공지, 뒤에서) => {
        const 깊이 = 보일것.length - 1 - 뒤에서;
        const 맨앞 = 깊이 === 0;
        if (!맨앞) {
          /* 뒤 장은 테와 바탕만 보인다. 글은 눈에 보이지 않게 까는데,
             빈 조각으로 두면 키가 0이 되어 테가 실선 한 줄로만 보이기
             때문이다. visibility 로 감추면 자리는 그대로 남는다. */
          return (
            <section
              key={공지.notice_id}
              className="notice-band notice-band--behind"
              data-depth={깊이}
              aria-hidden="true"
              /* 키를 앞 장에서 잰 값으로 못 박는다. 글을 그대로 깔아도 단추와
                 글줄 계산이 미세하게 달라 2px쯤 어긋났고, 아랫변이 붙박이라
                 그만큼 윗변이 위로 올라가 층계처럼 보였다. */
              style={접힌키 ? { height: `${접힌키}px` } : undefined}
            >
              <div className="notice-band__top">
                {/* 앞 장과 같은 단추로 깔아야 키가 한 픽셀도 다르지 않다.
                    span으로 두었더니 전역 button 규칙이 주는 글씨 크기를
                    못 받아 2.6px 높아졌고, 아랫변이 붙박이라 그만큼 윗변이
                    위로 올라가 층계처럼 보였다. */}
                <button type="button" className="notice-band__head" disabled tabIndex={-1}>
                  <span className="notice-band__tag">
                    <MegaphoneIcon />
                    공지
                  </span>
                  <span className="notice-band__title">{공지.title}</span>
                </button>
              </div>
            </section>
          );
        }
        return (
          <section
            key={공지.notice_id}
            ref={띠칸}
            className={`notice-band${펼침 ? " is-open" : ""}`}
            data-depth={0}
            aria-label="공지사항"
            /* 펼치면 윗변을 접혀 있던 자리에 못 박는다. 받침 조각이 카드
               윗변에 있으므로 그보다 (아래 틈 3px + 접힌 키)만큼 위다. */
            style={
              펼침 && 접힌키
                ? { top: `${-(3 + 접힌키)}px`, bottom: "auto" }
                : undefined
            }
            onPointerDown={잡기}
            onPointerMove={끌리기}
            onPointerUp={놓기}
            onPointerCancel={놓기}
            onTransitionEnd={(e) => {
              /* transform 하나만 센다. opacity도 함께 걸려 있어 둘 다 받으면
                 한 번 민 것에 두 장이 날아가고, 화살표의 움직임까지 올라오면
                 펼치기만 해도 띠가 사라진다. */
              if (!날림 || e.propertyName !== "transform" || e.target !== 띠칸.current) return;
              다음장();
            }}
          >
            {/* 윗줄. 머리말 단추와 [읽음]이 나란히 선다. 단추 안에 단추를
                넣을 수 없어 형제로 뗀다. */}
            <div className="notice-band__top">
              <button
                type="button"
                className="notice-band__head"
                onClick={() => set펼침((v) => !v)}
                aria-expanded={펼침}
              >
                <span className="notice-band__tag">
                  <MegaphoneIcon />
                  공지
                </span>
                <span ref={제목칸} className="notice-band__title">
                  {공지.title}
                  {잘렸나 && (
                    <span className="notice-band__fade" aria-hidden="true">
                      (...)
                    </span>
                  )}
                </span>
                {더있나 > 0 && <span className="notice-band__more">+{더있나}</span>}
                <span className="notice-band__arrow" aria-hidden="true" />
              </button>

              {/* 펼쳤을 때만 선다. 접힌 띠에 단추가 서면 미는 자리가 좁아진다. */}
              {펼침 && (
                <button type="button" className="ui-btn small notice-band__mark" onClick={읽음}>
                  읽음
                </button>
              )}
            </div>

            {펼침 && (
              <div className="notice-band__body">
                {공지.body && <p className="notice-band__text">{공지.body}</p>}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
