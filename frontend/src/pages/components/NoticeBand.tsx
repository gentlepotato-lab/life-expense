import { useEffect, useState } from "react";
import axios from "../../api/client";

/**
 * 홈 맨 위에 서는 공지 띠.
 *
 * 한 줄로 서 있다가 누르면 본문이 펼쳐진다. 읽고 나면 접히고 다시 뜨지
 * 않는다 — 어디까지 읽었는지를 서버가 들고 있기 때문이다. 브라우저에 담으면
 * 기기마다 달라져서 폰에서 읽은 것이 PC에서 또 뜬다.
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

export default function NoticeBand() {
  const [공지들, set공지들] = useState<공지[]>([]);
  const [펼침, set펼침] = useState(false);

  useEffect(() => {
    let 살아있나 = true;
    axios
      .get("/notices", { params: { today: ymd(new Date()) } })
      .then((r) => {
        if (!살아있나) return;
        /* 아직 안 읽은 것만 서버가 골라 보낸다. 읽은 자리를 서버가 들고
           있어야 폰에서 읽은 것이 PC에서 또 뜨지 않는다. */
        set공지들((r.data as 공지[]) ?? []);
      })
      .catch(() => {
        /* 못 받아 오면 띠를 그리지 않는다. 공지 때문에 홈이 비어 보이면 안 된다. */
      });
    return () => {
      살아있나 = false;
    };
  }, []);

  if (공지들.length === 0) return null;

  /* 여럿이면 가장 앞 차례 하나만 띄운다. 띠가 쌓이면 홈이 밀린다. */
  const 지금것 = 공지들[0];
  const 더있나 = 공지들.length - 1;

  const 읽음 = () => {
    /* 가장 큰 번호를 적는다. 여럿을 한 번에 읽은 것으로 본다. */
    const 가장큰것 = Math.max(...공지들.map((n) => n.notice_id));
    void axios.put("/notices/read", { notice_id: 가장큰것 }).catch(() => {
      /* 못 적어도 이번 판은 접는다. 다음에 열면 다시 뜬다. */
    });
    set공지들([]);
  };

  return (
    <section className={`notice-band${펼침 ? " is-open" : ""}`} aria-label="공지사항">
      <button
        type="button"
        className="notice-band__head"
        onClick={() => set펼침((v) => !v)}
        aria-expanded={펼침}
      >
        <span className="notice-band__tag">공지</span>
        <span className="notice-band__title">{지금것.title}</span>
        {더있나 > 0 && <span className="notice-band__more">+{더있나}</span>}
        <span className="notice-band__arrow" aria-hidden="true" />
      </button>

      {펼침 && (
        <div className="notice-band__body">
          {지금것.body && <p className="notice-band__text">{지금것.body}</p>}
          <button type="button" className="ui-btn small" onClick={읽음}>
            읽음
          </button>
        </div>
      )}
    </section>
  );
}
