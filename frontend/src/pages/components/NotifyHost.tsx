import { useCallback, useEffect, useRef, useState } from "react";
import useBackClose from "../../hooks/useBackClose";
import { bindNotify, type AskOpts, type TextOpts, type Tone } from "../../utils/notify";

/**
 * 알림 · 되묻기 · 이름 받기를 그리는 자리.
 *
 * App에 한 번만 매단다. 아무것도 뜨지 않은 동안에는 아무것도 그리지 않는다.
 *
 * 되묻기와 이름 받기는 앱이 이미 쓰는 팝업 부품을 그대로 쓴다
 * (.popup-overlay · .popup-panel--framed · .popup-head · .btn-row.popup-foot).
 * 새 틀을 만들면 다른 팝업과 한 식구로 보이지 않는다.
 */

type Note = { id: number; tone: Tone; text: string };

/** 결마다 머무는 시간. 안 된 일은 더 오래 둔다 — 놓치면 안 되는 말이다. */
const STAY: Record<Tone, number> = { ok: 2200, warn: 2800, bad: 4000 };

/** 한꺼번에 쌓이는 수. 넘치면 오래된 것부터 걷는다. */
const MAX = 3;

export default function NotifyHost() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [ask, setAsk] = useState<{ opts: AskOpts; done: (ok: boolean) => void } | null>(null);
  const [text, setText] = useState<{ opts: TextOpts; done: (v: string | null) => void } | null>(null);
  const [draft, setDraft] = useState("");

  const seq = useRef(0);
  const timers = useRef(new Map<number, number>());

  const drop = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t !== undefined) {
      window.clearTimeout(t);
      timers.current.delete(id);
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const toast = useCallback(
    (tone: Tone, body: string) => {
      setNotes((prev) => {
        /* 같은 말이 이미 떠 있으면 새로 쌓지 않고 그것의 시간만 늘린다.
           "저장 완료-!! ;-)"는 여덟 자리에서 부르므로 연달아 뜨기 쉽다. */
        const same = prev.find((n) => n.text === body && n.tone === tone);
        const id = same ? same.id : (seq.current += 1);

        const old = timers.current.get(id);
        if (old !== undefined) window.clearTimeout(old);
        timers.current.set(id, window.setTimeout(() => drop(id), STAY[tone]));

        if (same) return prev;
        const next = [...prev, { id, tone, text: body }];
        return next.length > MAX ? next.slice(next.length - MAX) : next;
      });
    },
    [drop]
  );

  useEffect(() => {
    bindNotify({
      toast,
      ask: (opts) => new Promise<boolean>((done) => setAsk({ opts, done })),
      askText: (opts) =>
        new Promise<string | null>((done) => {
          setDraft(opts.value ?? "");
          setText({ opts, done });
        }),
    });
    return () => bindNotify(null);
  }, [toast]);

  /* 떠 있는 시계는 떠날 때 모두 거둔다. */
  const timerBag = timers.current;
  useEffect(() => () => timerBag.forEach((t) => window.clearTimeout(t)), [timerBag]);

  /* 알림이 설 자리. 갈래 탭 바로 밑이다.

     갈래 탭이 있는 화면은 머리말이 135에서 끝나므로 143에 선다. 갈래 탭이 없는
     화면은 머리말이 92에서 끝나지만 거기 맞추면 화면을 옮길 때마다 알림이
     오르내려, 눈이 늘 같은 데를 보지 못한다. 그래서 낮은 쪽을 143으로 올려 맞춘다.

     제목 밑에 한 줄이 들어서면서 둘 다 18px씩 깊어졌다(74 → 92, 117 → 135).
     여기 값도 125에서 143으로 그만큼 따라 내린다 — 그러지 않으면 갈래 탭이 선
     여덟 화면에서만 알림이 머리말에 가린다.

     그래도 재는 까닭은 머리말이 더 길어질 수 있어서다 — 제목이 접히거나 갈래가
     늘면 143으로는 가린다. 둘 가운데 깊은 쪽을 쓴다. */
  const 기본자리 = 143;
  const [머리밑, set머리밑] = useState<number | null>(null);
  useEffect(() => {
    if (notes.length === 0) return;
    const measure = () => {
      const head = document.querySelector(".page-head");
      if (!head) return set머리밑(null);
      const 바닥 = Math.round(head.getBoundingClientRect().bottom) + 8;
      set머리밑(Math.max(기본자리, 바닥));
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [notes.length]);

  const closeAsk = useCallback(() => {
    setAsk((cur) => {
      cur?.done(false);
      return null;
    });
  }, []);

  const closeText = useCallback(() => {
    setText((cur) => {
      cur?.done(null);
      return null;
    });
  }, []);

  /* 뒤로 가기 · Esc로도 닫힌다 — 다른 팝업과 같은 잣대다.
     되묻기가 먼저 걸리도록 둘을 따로 건다. */
  useBackClose(!!ask, closeAsk);
  useBackClose(!!text, closeText);

  return (
    <>
      {notes.length > 0 && (
        <div
          className="notebox"
          role="status"
          aria-live="polite"
          style={머리밑 === null ? undefined : { top: 머리밑 }}
        >
          {notes.map((n) => (
            <div key={n.id} className={`note note--${n.tone}`} onClick={() => drop(n.id)}>
              <span className="note__dot" />
              <span className="note__text">{n.text}</span>
            </div>
          ))}
        </div>
      )}

      {ask && (
        <div className="popup-overlay ask-overlay" onClick={closeAsk}>
          <div
            className="popup-panel popup-panel--framed"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={ask.opts.title}
          >
            <header className="popup-head">
              <h3 className="popup-head__title">{ask.opts.title}</h3>
            </header>

            <div className="popup-body">
              {ask.opts.body && <p className="ask-text">{ask.opts.body}</p>}
              {ask.opts.warn && <p className="ask-warn">{ask.opts.warn}</p>}
            </div>

            {/* 다른 팝업과 같은 차례 — 닫기가 왼쪽, 하려던 것이 오른쪽 */}
            <div className="btn-row popup-foot popup-foot--tight">
              <button className="ui-btn" onClick={closeAsk}>
                닫기
              </button>
              <button
                className={`ui-btn ${ask.opts.danger ? "go-danger" : "primary"}`}
                onClick={() => {
                  ask.done(true);
                  setAsk(null);
                }}
              >
                {ask.opts.go || "확인"}
              </button>
            </div>
          </div>
        </div>
      )}

      {text && (
        <div className="popup-overlay ask-overlay" onClick={closeText}>
          <form
            className="popup-panel popup-panel--framed"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              const v = draft.trim();
              if (!v) return;
              text.done(v);
              setText(null);
            }}
            aria-label={text.opts.title}
          >
            <header className="popup-head">
              <h3 className="popup-head__title">{text.opts.title}</h3>
            </header>

            <div className="popup-body">
              <div className="edit-field">
                {text.opts.label && <label className="edit-field__label">{text.opts.label}</label>}
                <div className="edit-field__control">
                  <input
                    autoFocus
                    value={draft}
                    placeholder={text.opts.placeholder}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="btn-row popup-foot popup-foot--tight">
              <button type="button" className="ui-btn" onClick={closeText}>
                닫기
              </button>
              <button type="submit" className="ui-btn primary" disabled={!draft.trim()}>
                {text.opts.go || "확인"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
