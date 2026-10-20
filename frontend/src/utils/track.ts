/**
 * 행동 기록 — 모아서 보낸다.
 *
 * 어느 화면에 들어갔는지, 어떤 기능을 썼는지, 어느 요청이 물리거나 오래
 * 걸렸는지를 적는다. 보는 것은 관리자 페이지가 맡는다.
 *
 * 네 가지를 지킨다.
 *   모아서 보낸다 — 5초마다 또는 스무 줄이 모이면 한 번. 하나씩 보내면
 *     요청이 배로 늘어난다.
 *   떠날 때도 보낸다 — sendBeacon으로. 페이지를 닫으면 모인 것이 날아간다.
 *   실패를 삼킨다 — 기록 때문에 화면이 멈추거나 오류가 뜨면 안 된다.
 *   제 요청은 세지 않는다 — 기록을 보내는 요청까지 재면 끝없이 돈다.
 *
 * axios를 쓰지 않고 fetch로 보낸다. axios에는 재는 인터셉터가 달려 있어,
 * 거기로 보내면 제 요청을 제가 재게 된다.
 */

/** 적는 갈래. 서버가 받는 것과 같은 목록이다(app/routers/action_logs.py). */
export type 갈래 = "view" | "feature" | "error";

type 줄 = {
  kind: 갈래;
  name: string;
  path?: string;
  elapsed_ms?: number;
  status?: number;
};

/** 모였다 나갈 줄들. */
const 모인것: 줄[] = [];

/** 이만큼 모이면 기다리지 않고 보낸다. */
const 한번에 = 20;

/** 덜 모였어도 이 틈이 지나면 보낸다. */
const 기다림 = 5000;

/** 이보다 오래 걸린 요청을 느린 것으로 본다. */
export const 느린참 = 1000;

const 보낼곳 = "/api/action-logs";

let 타이머: number | null = null;

function 비우기(): 줄[] {
  const 나갈것 = 모인것.splice(0, 모인것.length);
  if (타이머 !== null) {
    window.clearTimeout(타이머);
    타이머 = null;
  }
  return 나갈것;
}

/** 지금 모인 것을 보낸다. 실패해도 아무 일도 일어나지 않는다. */
function 보내기(): void {
  const 나갈것 = 비우기();
  if (나갈것.length === 0) return;
  try {
    void fetch(보낼곳, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: 나갈것 }),
      /* 화면을 떠나는 중에도 끝까지 가게 한다. */
      keepalive: true,
    }).catch(() => {
      /* 조용히 넘긴다. */
    });
  } catch {
    /* 조용히 넘긴다. */
  }
}

/**
 * 한 줄 적는다.
 *
 * 부르는 쪽은 결과를 기다리지 않는다. 모았다가 나중에 한 번에 나간다.
 */
export function 적기(줄: 줄): void {
  try {
    모인것.push(줄);
    if (모인것.length >= 한번에) {
      보내기();
      return;
    }
    if (타이머 === null) {
      타이머 = window.setTimeout(보내기, 기다림);
    }
  } catch {
    /* 조용히 넘긴다. */
  }
}

/** 화면에 들어갔다고 적는다. */
export function 화면적기(path: string): void {
  적기({ kind: "view", name: path, path });
}

/** 기능을 썼다고 적는다. */
export function 기능적기(name: string): void {
  적기({ kind: "feature", name });
}

/** 물린 요청이나 오래 걸린 요청을 적는다. */
export function 요청적기(name: string, path: string, elapsed_ms: number, status?: number): void {
  적기({ kind: "error", name, path, elapsed_ms, status });
}

/**
 * 떠날 때 모인 것을 보낸다.
 *
 * pagehide는 탭을 닫거나 다른 앱으로 넘어갈 때 온다. visibilitychange는
 * 손전화에서 홈 단추를 눌렀을 때 오는데, 그쪽이 더 자주 마지막 기회다.
 *
 * sendBeacon은 페이지가 사라진 뒤에도 보내 준다. 쓸 수 없으면 fetch로
 * 넘어간다 — keepalive가 그 자리를 거든다.
 */
export function 떠날때보내기(): void {
  const 걸기 = () => {
    const 나갈것 = 비우기();
    if (나갈것.length === 0) return;
    const 짐 = JSON.stringify({ rows: 나갈것 });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(보낼곳, new Blob([짐], { type: "application/json" }));
        return;
      }
    } catch {
      /* 아래 fetch로 넘어간다. */
    }
    try {
      void fetch(보낼곳, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: 짐,
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* 조용히 넘긴다. */
    }
  };

  window.addEventListener("pagehide", 걸기);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") 걸기();
  });
}
