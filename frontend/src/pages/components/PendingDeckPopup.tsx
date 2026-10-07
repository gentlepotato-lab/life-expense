import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import useBackClose from "../../hooks/useBackClose";
import usePending, { invalidatePending, type PendingCardRow } from "../../hooks/usePending";
import { invalidateNudges } from "../../hooks/useNudges";
import { say } from "../../utils/notify";
import { PAGE_ICON } from "./MenuIcons";

/**
 * 대기 내역을 한 장씩 넘겨 보며 보내는 팝업.
 *
 * 대기는 쌓이기만 하고 잔소리에서만 세어 주었다. 보내려면 내역 탭으로 들어가
 * 목록을 훑어야 했다. 어느 화면에서나 모래시계를 눌러 한 장씩 보고 바로
 * 보낸다.
 *
 * 고치는 일은 여기서 하지 않는다. 폼을 한 벌 더 만들면 대기 내역의 편집
 * 팝업과 두 곳이 되고, 그러면 반드시 한쪽만 고쳐지는 날이 온다. 고칠 것이
 * 있으면 발의 단추로 대기 내역에 간다.
 */

/** 테이프를 걷는 데 드는 거리. 목록의 잣대와 같다. */
const REVEAL = 12;

/** 장을 넘기는 데 드는 거리. 테이프와 같은 12px로 두었더니 메모를 굴리거나
    단추를 누르려다 손이 조금만 흔들려도 장이 넘어갔다. 한 뼘은 끌어야 한다. */
const SWIPE = 56;

/**
 * 끝에서 더 끌 때 따라오는 거리의 상한.
 *
 * 처음에는 손의 28%만 따라오게 두었는데, 비율만 두었더니 상한이 없었다. 한 뼘
 * 반(260px)을 밀면 카드가 73px 빠져 폭의 4분의 1이 옆으로 나갔다. 그만큼
 * 나가면 "벽"이 아니라 "넘어가다 만 것"으로 보인다. 마지막 장은 뒤에 깔린
 * 장도 없어서 그 자리로 팝업의 빈 바닥이 드러났다.
 *
 * 18px은 카드 폭의 6%다. 기울었다가 되돌아오는 것으로 읽히고, 드러나는
 * 빈자리도 눈에 띄지 않는다.
 */
const 끝상한 = 18;

/**
 * 끝에서 더 끌 때 따라오는 거리.
 *
 * 처음 한 뼘까지는 비율로 끌던 때와 거의 같아 손에 붙는 느낌이 그대로다
 * (40px을 밀면 12px). 그 뒤로는 아무리 밀어도 상한에서 멈춘다.
 */
function 끝끌기(v: number): number {
  return Math.sign(v) * 끝상한 * (1 - Math.exp(-Math.abs(v) / 끝상한));
}

export default function PendingDeckPopup({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);
  const { rows, ready } = usePending(reloadKey);

  /* 몇째 장을 보고 있는지. 보내면 그 장이 빠지므로 자리는 그대로 두고
     다음 장이 올라온다 — 마지막 장이었으면 그 앞 장이 올라온다. */
  const [at, setAt] = useState(0);
  const [sending, setSending] = useState(false);
  /* 가려 둔 금액을 끄는 동안만 드러낸다. 손을 떼면 다시 덮인다. */
  const [reveal, setReveal] = useState(false);
  /* 어느 쪽으로 넘겼는지. 들어오는 장이 그 반대쪽에서 밀려 들어온다. */
  const [dir, setDir] = useState<1 | -1>(1);

  useBackClose(true, onClose);

  const 남은 = rows.length;
  const 지금: PendingCardRow | undefined = rows[Math.min(at, 남은 - 1)];

  /* 다 보내고 나면 닫는다. 빈 팝업을 남겨 둘 까닭이 없다. */
  useEffect(() => {
    if (ready && 남은 === 0 && reloadKey > 0) onClose();
  }, [ready, 남은, reloadKey, onClose]);

  /* 마지막 장에서 더 넘기지 않는다. 처음으로 돌아가면 다 본 줄 알았는데
     같은 장이 또 나와, 어디까지 봤는지 알 수 없어진다. */
  const next = useCallback(() => {
    /* 자리를 바꾸는 updater 안에서 다른 상태를 건드리면 그 값이 이번 그림에
       반영되지 않는다 — 넘기는 쪽이 늘 오른쪽으로만 보이던 까닭이다.
       지금 자리를 보고 밖에서 둘을 함께 정한다. */
    setAt((i) => {
      if (i >= 남은 - 1) return i;
      return i + 1;
    });
    setDir(1);
  }, [남은]);

  const prev = useCallback(() => {
    setAt((i) => (i <= 0 ? i : i - 1));
    setDir(-1);
  }, []);

  const send = useCallback(async () => {
    if (!지금 || sending) return;
    setSending(true);
    try {
      await api.post(`/pending-entries/send/${지금.entry_id}`);
      say.ok("전송 완료-!! ;-)");
      invalidatePending();
      invalidateNudges();
      /* 보낸 장이 빠지면 뒤가 당겨 온다. 자리가 끝을 넘지 않게 당겨 둔다 —
         마지막 장을 보냈으면 그 앞 장으로 간다. 처음으로 되돌리지 않는다. */
      setAt((i) => Math.max(0, Math.min(i, 남은 - 2)));
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      say.bad("전송하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  }, [지금, sending, 남은]);

  /* 가로로 끄는 몸짓이 둘이다 — 금액 드러내기와 장 넘기기.
     금액 위에서 시작한 끌기는 넘기지 않는다. 겹치면 테이프를 걷으려다
     장이 넘어가 버린다.

     끄는 동안 카드가 손을 따라간다. 떼고 나서야 움직이면 넘긴 것인지
     아닌지가 손에 안 잡혀, 될 때까지 몇 번이고 다시 밀게 된다. */
  const 끌기 = useRef<{ x: number; 금액: boolean; id: number } | null>(null);
  const [민거리, set민거리] = useState(0);
  const [끄는중, set끄는중] = useState(false);

  /* 메모는 세로로 굴리는 자리다. 거기서 시작한 끌기까지 카드를 끌면 두
     몸짓이 한 자리에서 다툰다 — 굴리려다 장이 밀리고, 밀려다 글이 굴러간다.

     다만 굴릴 것이 없는 메모(짧거나 비어 있는 것)까지 비켜 두면 카드의 절반이
     밀리지 않는 죽은 자리가 된다. 지금 이 메모가 실제로 굴러가는지를 보고
     그때만 비켜 준다. */
  const 메모누름 = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight > el.clientHeight + 1) e.stopPropagation();
  };

  const 누름 = (e: React.PointerEvent, 금액 = false) => {
    if (금액) {
      /* 금액 위에서 시작한 누름은 더미까지 올라가지 않는다. 올라가면 더미가
         금액이 아니라고 덮어써, 테이프를 걷으려다 장이 넘어간다. */
      e.stopPropagation();
      끌기.current = { x: e.clientX, 금액: true, id: e.pointerId };
      return;
    }
    /* 손가락을 이 자리에 묶어 둔다. 끄는 동안 카드가 다시 그려져도 뗀 것을
       놓치지 않는다 — 놓치면 한 번 민 것이 두 번으로 세어진다. */
    e.currentTarget.setPointerCapture(e.pointerId);
    끌기.current = { x: e.clientX, 금액: false, id: e.pointerId };
    set끄는중(true);
  };

  const 움직임 = (e: React.PointerEvent) => {
    const d = 끌기.current;
    if (!d || d.id !== e.pointerId) return;
    const v = e.clientX - d.x;
    if (d.금액) {
      if (Math.abs(v) > REVEAL) setReveal(true);
      return;
    }
    /* 왼쪽 끝에서 더 오른쪽으로, 오른쪽 끝에서 더 왼쪽으로는 덜 따라온다. */
    const 끝 = (v < 0 && at >= 남은 - 1) || (v > 0 && at <= 0);
    set민거리(끝 ? 끝끌기(v) : v);
  };

  const 뗌 = (e: React.PointerEvent) => {
    const d = 끌기.current;
    끌기.current = null;
    setReveal(false);
    if (!d) return;
    if (d.금액) return;
    set끄는중(false);
    set민거리(0);
    const v = e.clientX - d.x;
    if (Math.abs(v) < SWIPE) return;
    /* 왼쪽으로 밀면 다음 장, 오른쪽으로 밀면 앞 장 — 종이를 넘기는 쪽이다. */
    if (v < 0) next();
    else prev();
  };

  /* 뒤에 비치는 장. 지금 장 뒤에 아직 몇 장이 남았는지를 그린다 —
     전체 수를 보면 마지막 장인데도 뒤에 넉 장이 깔려 있어, 다 본 줄
     모르고 계속 밀게 된다. 다섯 장(지금 것 + 넉 장)을 넘지 않는다.
     스무 장이 겹치면 더미가 아니라 얼룩으로 보인다. */
  const 뒤에 = Math.max(남은 - 1 - at, 0);
  const 겹수 = Math.min(뒤에, 4);
  const 겹 = Array.from({ length: 겹수 }, (_, i) => i + 1).reverse();

  /* 더미를 가운데로 민다.

     카드는 오른쪽 18px을 쌓인 장에 늘 내준다. 그래서 겹이 없는 장에서는
     카드가 왼쪽으로 18px 치우쳐 보였다. 쌓인 장은 오른쪽으로 겹수 × 4px만큼
     뻗으니, 남는 자리(18 − 겹수 × 4)를 반씩 나눠 양쪽에 두면 몇 장이 쌓여
     있든 더미가 한가운데 선다.

     카드 폭은 건드리지 않는다 — 폭이 함께 바뀌면 넘길 때마다 글이 다시
     접혀 카드 속이 들썩인다. */
  const 치우침 = (18 - 겹수 * 4) / 2;

  return (
    <div className="popup-overlay pd-ov" onClick={onClose}>
      <div
        className="popup-panel popup-panel--framed pd-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="대기 내역"
      >
        {/* 머리말도 발도 잔소리 팝업과 같은 부품을 쓴다. 새 틀을 만들면
            한 식구로 보이지 않는다. 더하는 것은 몇째 장인지 하나뿐이다. */}
        <header className="popup-head">
          <h3 className="popup-head__title">대기 내역</h3>
          {남은 > 0 && (
            <span className="pd-count">
              {Math.min(at + 1, 남은)} / {남은}
            </span>
          )}
        </header>

        {!ready && <div className="pd-none">세어 보는 중입니다.</div>}
        {ready && 남은 === 0 && <div className="pd-none">대기 중인 내역이 없습니다.</div>}

        {ready && 지금 && (
          <>
            <div className="pd-body">
              <div
                className="pd-stack"
                style={{ transform: `translateX(${치우침}px)` }}
                onPointerDown={(e) => 누름(e)}
                onPointerMove={움직임}
                onPointerUp={뗌}
                onPointerCancel={뗌}
              >
                {겹.map((i) => (
                  <span
                    key={i}
                    className="pd-leaf"
                    aria-hidden="true"
                    /* 오른쪽으로 비껴 쌓는다 — 옆으로 넘기는 몸짓과 같은
                       방향이라, 다음 장이 그쪽에 있다는 것이 그림으로 읽힌다.
                       카드가 오른쪽에 18px을 비워 두고 그 안에서 겹친다. */
                    style={{
                      top: i * 3,
                      bottom: i * 3,
                      left: i * 4,
                      right: 18 - i * 4,
                      zIndex: 9 - i,
                      opacity: 1 - i * 0.17,
                    }}
                  />
                ))}

                <article
                  /* 장이 바뀌면 다시 그려지며 들어오는 결이 한 번 돈다. */
                  key={지금.entry_id}
                  className={`pd-card pd-card--${dir > 0 ? "next" : "prev"}${
                    끄는중 ? " pd-card--dragging" : ""
                  }${지금.inout === 1 ? " pd-card--in" : ""}`}
                  style={
                    민거리 === 0
                      ? undefined
                      : { transform: `translate3d(${Math.round(민거리)}px, 0, 0)` }
                  }
                >
                  <span className="ws-tag ws-tag--now pd-when">{지금.date}</span>
                  <div className="pd-cat">
                    <span>{지금.cat || "—"}</span>
                  </div>
                  {/* 가림은 목록과 한 꼴이다 — masked · revealed를 그대로 입어
                      돈쓴이에서 고른 테이프가 여기에도 그대로 붙는다. */}
                  <div
                    className={`pd-amt ${지금.blur && !reveal ? "masked" : "revealed"}`}
                    onPointerDown={(e) => 지금.blur && 누름(e, true)}
                  >
                    {지금.amount.toLocaleString("ko-KR")}
                  </div>
                  <div className="pd-meta">
                    {지금.place && <span className="pd-chip pd-chip--place">📍 {지금.place}</span>}
                    {지금.pay && <span className="pd-chip">{지금.pay}</span>}
                    {지금.gross !== null && (
                      <span className="pd-chip">
                        N빵(돌려받음) {(지금.gross - 지금.amount).toLocaleString("ko-KR")}
                      </span>
                    )}
                  </div>
                  <div
                    className={`pd-memo${지금.memo ? "" : " pd-memo--none"}`}
                    onPointerDown={메모누름}
                  >
                    {지금.memo || "메모가 없습니다."}
                  </div>
                </article>
              </div>

              {/* 넘길 수 있다는 것은 글로 적지 않는다 — 화살표 둘과 가운데
                  점들이 "양쪽으로 미는 것"을 그대로 보여 준다. */}
              <div className="pd-swipe" aria-hidden="true">
                <svg viewBox="0 0 76 12" fill="none" stroke="currentColor" strokeWidth={1.6}
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 2 4 6l5 4M67 2l5 4-5 4" />
                  <path d="M22 6h.01M30 6h.01M38 6h.01M46 6h.01M54 6h.01" />
                </svg>
              </div>
              <p className="pd-tip">수정은 대기 내역에서 합니다.</p>
            </div>

            <div className="pd-act">
              <button
                type="button"
                className="ui-btn"
                onClick={next}
                disabled={at >= 남은 - 1}
              >
                건너뛰기
              </button>
              <button type="button" className="ui-btn primary" onClick={send} disabled={sending}>
                전송
              </button>
            </div>
          </>
        )}

        {/* 발은 잔소리 팝업과 같은 차례다 — 왼쪽이 그 화면으로, 오른쪽이 닫기. */}
        <div className="btn-row popup-foot">
          <button
            type="button"
            className="ui-btn nudge-detail__go"
            onClick={() => {
              onClose();
              window.setTimeout(() => navigate("/pending-entries"), 0);
            }}
            aria-label="대기 내역 화면으로 가기"
            title="대기 내역"
          >
            <span className="nudge-detail__go-icon" aria-hidden="true">
              {PAGE_ICON["/pending-entries"]}
            </span>
            <span className="nudge-detail__go-arrow" aria-hidden="true">
              <svg
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 16h13M17 11l5 5-5 5" />
              </svg>
            </span>
          </button>
          <button type="button" className="ui-btn nudge-detail__close" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
