/**
 * 행동 기록. 모아서 보낸다.
 *
 * 어느 화면에 들어갔는지, 어떤 기능을 썼는지, 어느 요청이 물리거나 오래
 * 걸렸는지를 적는다. 보는 것은 관리자 페이지가 맡는다.
 *
 * 네 가지를 지킨다.
 *   모아서 보낸다. 5초마다 또는 스무 줄이 모이면 한 번. 하나씩 보내면
 *     요청이 배로 늘어난다.
 *   떠날 때도 보낸다. sendBeacon으로. 페이지를 닫으면 모인 것이 날아간다.
 *   실패를 삼킨다. 기록 때문에 화면이 멈추거나 오류가 뜨면 안 된다.
 *   제 요청은 세지 않는다. 기록을 보내는 요청까지 재면 끝없이 돈다.
 *
 * axios를 쓰지 않고 fetch로 보낸다. axios에는 재는 인터셉터가 달려 있어,
 * 거기로 보내면 제 요청을 제가 재게 된다.
 */

/** 적는 갈래. 서버가 받는 것과 같은 목록이다(app/routers/action_logs.py). */
export type 갈래 = "view" | "feature" | "error" | "api";

type 줄 = {
  kind: 갈래;
  name: string;
  path?: string;
  elapsed_ms?: number;
  status?: number;
  /* 바깥 요청에만 담는다. 주소는 물음표 앞까지다. 열쇠가 그 뒤에 붙는다. */
  method?: string;
  url?: string;
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

/**
 * 바깥에 물어본 것을 적는다.
 *
 * 브라우저가 바로 부르는 바깥만 여기로 온다. 지금은 카카오 지도 하나다.
 * 서버를 거치는 바깥은 서버가 저가 아니까 적을 일이 없다.
 *
 * feature 로 적지 않는 까닭은 대시보드의 기능별 사용 횟수가 그 갈래를 세기
 * 때문이다. 바깥에 묻는 일이 기능 목록에 섞이면 그 수가 흐려진다.
 *
 * 상태는 HTTP 의 수를 흉내 낸다. 카카오가 돌려주는 것은 OK 와 ZERO_RESULT 와
 * ERROR 뿐이라, 400 아래면 잘된 것으로 보는 관리자 쪽 잣대에 맞춰 옮긴다.
 *
 * 방식과 주소도 함께 적는다. 이름과 한 일만으로는 어느 자리로 보낸 요청인지
 * 알 수 없어, 느리거나 물린 줄을 찾아도 어디를 들여다봐야 할지 알 길이 없었다.
 *
 * **주소에서 열쇠만 걷는다.** 물음표 뒤를 통째로 자르던 때는 「무엇을
 * 찾았는가」(query)까지 함께 사라졌다. 이름에 열쇠나 비밀이 든 값만 빼고
 * 나머지는 그대로 둔다(주소다듬기). 받는 쪽에서도 한 번 더 걷지만
 * (app/routers/action_logs.py의 주소다듬기) 보내지 않는 것이 먼저다.
 * 떠난 뒤에는 지울 수 없다.
 */
export function 바깥적기(
  name: string,
  한일: string,
  elapsed_ms: number,
  status: number,
  method?: string,
  url?: string
): void {
  적기({ kind: "api", name, path: 한일, elapsed_ms, status, method, url: 주소다듬기(url) });
}

/**
 * 기록에 적을 주소.
 *
 * 열쇠가 든 값만 걷고 나머지 물음표 뒤는 그대로 둔다. 장소를 찾을 때 보낸
 * 주소에는 찾은 말이 `query`로 붙는데, 그것이 「무엇을 하려고 불렀나」보다
 * 자세하다.
 *
 * 이름에 key, secret, token, password, auth, sign 가운데 하나라도 든 값은
 * 뺀다. 카카오는 열쇠를 머리글로 보내 주소에는 없고, 서버가 부르는 자리는
 * serviceKey 가 붙는다(app/routers/holidays.py). 모르는 이름이 하나 새면
 * 그대로 쌓이므로, 받는 쪽에서도 같은 잣대로 한 번 더 걷는다.
 */
const 숨길이름 = ["key", "secret", "token", "password", "pw", "auth", "sign"];

export function 주소다듬기(url?: string): string | undefined {
  if (!url) return undefined;
  const 물음표 = url.indexOf("?");
  if (물음표 < 0) return url.slice(0, 300);
  const 앞 = url.slice(0, 물음표);
  const 남길것 = url
    .slice(물음표 + 1)
    .split("&")
    .filter((짝) => {
      const 이름 = 짝.split("=")[0].toLowerCase();
      return 이름 !== "" && !숨길이름.some((h) => 이름.includes(h));
    });
  return (남길것.length > 0 ? `${앞}?${남길것.join("&")}` : 앞).slice(0, 300);
}

/**
 * 바깥으로 나간 주소를 모아 쥐는 자리.
 *
 * 브라우저가 적는 자취(Resource Timing)는 칸이 250개뿐이고, 차면 그
 * 뒤로는 새 것을 버린다. 앱을 오래 열면 화면을 옮기고 그림을 받는
 * 동안 그 칸이 차 버려, 정작 찾고 싶은 요청이 자취에 남지 않는다. 앱으로
 * 깔고 쓰는 쪽에서 장소를 찾았을 때 주소가 안 잡힌 까닭이 그것이다.
 *
 * 그래서 칸이 차기를 기다리지 않고 나가는 족족 받는다. 우리 몫의
 * 자리는 서른이고, 오래된 것부터 밀려난다. 바깥 것만 받는다. 우리 서버로
 * 보내는 요청은 서버가 저가 안다.
 */
const 받은자취: string[] = [];
let 눈붙였나 = false;

function 자취눈(): void {
  if (눈붙였나) return;
  눈붙였나 = true;
  try {
    new PerformanceObserver((목록) => {
      for (const e of 목록.getEntries()) {
        if (e.name.startsWith(location.origin)) continue;
        받은자취.push(e.name);
        if (받은자취.length > 30) 받은자취.shift();
      }
    }).observe({ type: "resource", buffered: true });
  } catch {
    /* 못 보는 브라우저도 있다. 그때는 아래에서 자취를 바로 뒤진다. */
  }
}

/**
 * 바깥으로 나간 주소 하나를 집는다.
 *
 * SDK가 제 손으로 보내는 요청은 우리가 주소를 쥐고 있지 않다. 받은 것에서
 * 가장 나중 것을 집고, 거기 없으면 브라우저의 자취를 바로 뒤진다.
 *
 * 못 집으면 빈손으로 돌아간다. 그때는 부르는 쪽이 코드에 적은 주소로
 * 떨어진다. 기록 때문에 하던 일이 멈추어서는 안 된다.
 */
export function 바깥자취(조각: string): string | undefined {
  자취눈();
  for (let i = 받은자취.length - 1; i >= 0; i -= 1) {
    if (받은자취[i].includes(조각)) return 받은자취[i];
  }
  try {
    const 것들 = performance.getEntriesByType("resource");
    for (let i = 것들.length - 1; i >= 0; i -= 1) {
      if (것들[i].name.includes(조각)) return 것들[i].name;
    }
  } catch {
    /* 못 재는 브라우저도 있다. */
  }
  return undefined;
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
 * 넘어간다. keepalive가 그 자리를 거든다.
 */
export function 떠날때보내기(): void {
  /* 자취를 받는 눈도 여기서 함께 붙인다. 앱이 뜨고 바로 붙어야 그 뒤에
     나가는 요청을 하나도 빠뜨리지 않는다(바깥자취). */
  자취눈();
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
