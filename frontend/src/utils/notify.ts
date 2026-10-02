/**
 * 알림 · 되묻기 · 이름 받기를 앱의 것으로.
 *
 * 그동안은 alert · confirm · prompt를 그대로 썼다. 화면이 멈추고, 생김새가
 * 기기마다 다르고, 말투도 바꿀 수 없었다. 앱으로 내보낼 것을 생각하면
 * 그대로 둘 수 없는 자리다.
 *
 * 부르는 꼴을 일부러 예전 것과 닮게 두었다. 바꿀 곳이 백 군데가 넘으므로,
 * 한 줄씩 기계적으로 갈아 끼울 수 있어야 잘못 끼울 여지가 줄어든다.
 *
 *   alert("저장 완료-!! ;-)")        →  say.ok("저장 완료-!! ;-)")
 *   if (!window.confirm("지울까?"))   →  if (!(await ask({ ... })))
 *   window.prompt("이름?", now)      →  await askText({ ... })
 *
 * 그리는 일은 NotifyHost가 한다. 여기서는 그쪽으로 넘기기만 한다 —
 * 리액트 밖에서도 부를 수 있어야 해서 맥락(Context)을 쓰지 않았다.
 */

/** 알림의 결. 바탕은 하나고 왼쪽 점의 빛깔만 바뀐다. */
export type Tone = "ok" | "warn" | "bad";

export type AskOpts = {
  /** 팝업 제목. 하려는 일의 이름이다 — "중분류 제거" */
  title: string;
  /** 무슨 일이 일어나는지. 평문만 받는다 — 이름이 그대로 들어오므로 */
  body?: string;
  /** 붉게 적을 한 줄. "되돌릴 수 없습니다." 따위 */
  warn?: string;
  /** 하려던 것의 이름. 없으면 "확인" */
  go?: string;
  /** 되돌릴 수 없는 일인가. 켜면 오른쪽 단추가 붉어진다. */
  danger?: boolean;
};

export type TextOpts = {
  title: string;
  /** 칸 위에 붙는 이름 */
  label?: string;
  /** 처음 들어 있을 값 */
  value?: string;
  placeholder?: string;
  /** 하려던 것의 이름. 없으면 "확인" */
  go?: string;
};

type Handlers = {
  toast: (tone: Tone, text: string) => void;
  ask: (opts: AskOpts) => Promise<boolean>;
  askText: (opts: TextOpts) => Promise<string | null>;
};

let bound: Handlers | null = null;

/** NotifyHost가 뜨고 질 때 스스로를 매단다. 밖에서 부를 일은 없다. */
export function bindNotify(h: Handlers | null): void {
  bound = h;
}

/**
 * 알림 한 줄.
 *
 * 매단 것이 없으면 예전 길로 돌아간다. 말이 조용히 사라지는 것보다
 * 투박하게라도 뜨는 편이 낫다.
 */
function push(tone: Tone, text: string): void {
  if (bound) {
    bound.toast(tone, text);
    return;
  }
  window.alert(text);
}

export const say = {
  /** 끝났다 — 저장 · 제거 · 추가 · 전송 */
  ok: (text: string) => push("ok", text),
  /** 막혔다 — 빠진 칸 · 겹치는 이름 · 바뀐 것 없음 */
  warn: (text: string) => push("warn", text),
  /** 안 됐다 — 서버가 물린 것 · 뜻밖의 탈 */
  bad: (text: string) => push("bad", text),
};

/** 되묻는다. 누르면 true, 닫으면 false. */
export function ask(opts: AskOpts): Promise<boolean> {
  if (bound) return bound.ask(opts);
  const lines = [opts.title, opts.body, opts.warn].filter(Boolean).join("\n");
  return Promise.resolve(window.confirm(lines));
}

/** 한 줄을 받는다. 누르면 그 값, 닫으면 null. */
export function askText(opts: TextOpts): Promise<string | null> {
  if (bound) return bound.askText(opts);
  return Promise.resolve(window.prompt(opts.label || opts.title, opts.value ?? ""));
}
