/**
 * 빛깔 예시 그림을 다시 찍는다.
 *
 *   node tools/palette-shots.mjs
 *
 * 돈쓴이의 빛깔 예시 팝업이 보여 주는 그림(public/palette)을 만든다. 화면이
 * 조금이라도 달라지면 예시도 따라 달라져야 하므로, 손으로 그리지 않고 살아
 * 있는 화면을 그대로 찍는다. 규칙은 docs/palette-shots.md에 적어 두었다.
 *
 * 앞서 해 둘 것 둘.
 *   1. 앱이 돌고 있어야 한다.        lab.ps1 build
 *   2. 크롬이 9222를 열고 있어야 한다.
 *      chrome --remote-debugging-port=9222
 *
 * 가림에 대하여.
 *   금액과 이름은 여기서 흐려 구워 낸다. 화면 위에 CSS로 덮는 것이 아니라
 *   흐려진 채로 찍히므로 원본은 파일 어디에도 남지 않는다. 덮기만 하면
 *   개발자 도구로 한 줄 지워 원본을 꺼낼 수 있다.
 *   앱이 가진 Blur는 분류마다 걸리는 것이라 예시를 다 덮지 못한다. 그래서
 *   예시에는 예시만의 가림을 따로 건다.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "public", "palette");
const BASE = process.env.PAL_BASE || "http://expense.life.localhost";
const W = 460;
const H = 700;

/** 벌 여섯. src/utils/palettes.ts의 key와 같아야 한다. */
const PALETTES = ["jjok", "hwangto", "meok", "sut", "podo", "crayon", "bada"];

/** 밝기 여섯. src/utils/theme.ts의 STEPS와 같아야 한다.
    예전에는 밝은 쪽 한 벌과 어두운 쪽 한 벌만 찍었다. 벌을 견주는 데에는
    어긋남이 없었지만, `새벽빛`을 쓰는 사람이 `달빛` 사진을 보게 되어 팝업 속
    그림과 그 뒤에 비치는 제 화면의 바탕이 달랐다. 여섯을 다 찍어 둔다. */
const 밝기 = [
  { key: "paper", mode: "light" },
  { key: "now", mode: "light" },
  { key: "hanji", mode: "light" },
  { key: "mist", mode: "light" },
  { key: "dawn", mode: "dark" },
  { key: "moon", mode: "dark" },
  { key: "dusk", mode: "dark" },
];

/** 네 화면. 파일 이름은 components/PalettePopup.tsx의 SHOTS와 같아야 한다. */
const 모든화면 = [
  { file: "home", url: "/" },
  { file: "entries", url: "/entries" },
  { file: "charts", url: "/charts" },
  { file: "calendar", url: "/calendar" },
];

/* 한 화면만 다시 찍고 싶을 때 쓴다.
     PAL_ONLY=charts node tools/palette-shots.mjs
   가림 목록에 빠진 칸을 메웠을 때처럼 한 화면만 어긋난 경우를 위한 것이다.
   쉼표로 여럿도 된다. 비워 두면 넷을 다 찍는다. 다시 찍히지 않은 화면은
   있던 파일이 그대로 남으므로, 같은 브라우저와 같은 화면 상태에서 이어
   찍어야 한 벌로 보인다. */
const 고른화면 = (process.env.PAL_ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
const SHOTS = 고른화면.length
  ? 모든화면.filter((s) => 고른화면.includes(s.file))
  : 모든화면;
if (!SHOTS.length) throw new Error(`PAL_ONLY="${process.env.PAL_ONLY}"에 맞는 화면이 없다`);

/* 얼마나 썼는지. 한 글자도 읽히면 안 되므로 더 세게 흐린다.

   건수(`18건`)는 여기 넣지 않는다 — 얼마를 썼는지가 아니라 몇 번 썼는지라
   신상이 아니고, 다른 화면에서도 드러나 있다. */
const 금액 = [
  ".amount-text", ".amount-split", ".date-group__sum", ".cal__net",
  ".cal-sum__in", ".cal-sum__out", ".chart-tile__value", ".card-perf__value",
  ".wh-row__val", ".wh-sum__won", ".cal__day-net", ".goal-row__won",
  ".me-stat__num", ".nudge__meta", ".place-row__won", ".cal__amt",
  ".recharts-cartesian-axis-tick-value", ".recharts-label",
  /* 카드 실적 판을 펼쳐 둔 채로 찍히게 되면서 드러난 셋. 띠 아래 눈금 금액,
     돌려받고 남은 내 몫, 실적에서 뺀 금액이다. */
  ".card-perf__mark", ".card-perf__sub--mine", ".card-perf__sub--x",
];

/* 누구와 어디서. 사람과 자리의 이름, 그리고 손수 지은 구분 이름. */
const 이름 = [
  ".place-text", ".card-title", ".card-sub", ".memo-pad", ".memo-text",
  ".cp-name", ".cp-row__name", ".pm-name", ".cat-name", ".wh-row__name",
  ".me-id__name", ".me-id__mail", ".me-id__bio", ".nudge__text",
  ".chart-legend__name", ".place-row__name", ".place-row__sub",
  ".pay-method-text", ".card-perf__name",
  /* 구분 이름. 손수 지은 것이 섞여 있어 이것도 가린다. */
  ".cat-display", ".cat-text", ".cat3-text",
];

const 가림 = [
  "::-webkit-scrollbar{width:0;height:0}",
  `${금액.join(",")}{filter:blur(5px)!important}`,
  `${이름.join(",")}{filter:blur(3.4px)!important}`,
].join("\n");

async function attach(url) {
  const t = await (
    await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(url)}`, { method: "PUT" })
  ).json();
  const ws = await new Promise((r) => {
    const w = new WebSocket(t.webSocketDebuggerUrl);
    w.onopen = () => r(w);
  });
  let id = 0;
  const send = (method, params) =>
    new Promise((res) => {
      const mid = ++id;
      const on = (e) => {
        const x = JSON.parse(e.data);
        if (x.id === mid) {
          ws.removeEventListener("message", on);
          res(x.result);
        }
      };
      ws.addEventListener("message", on);
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  const ev = (expression, 기다릴까) =>
    send("Runtime.evaluate", {
      expression, returnByValue: true, awaitPromise: !!기다릴까,
    }).then((r) => r.result.value);
  await send("Runtime.enable");
  await send("Page.enable");
  /* 팝업이 300px 남짓으로 보여 주므로 1.5배면 넉넉하다. 2배로 찍으면 스물네
     장이 3.6MB가 되어 저장소와 첫 열림이 무거워진다. */
  await send("Emulation.setDeviceMetricsOverride", {
    width: W, height: H, deviceScaleFactor: 1.5, mobile: false,
  });

  /* 뜨기를 기다린다. 기다리지 않으면 아래 localStorage 쓰기가 아직
     about:blank인 자리에 떨어져 사라지고, 되읽기하면 옛 빛깔로 뜬다. */
  await new Promise((res) => {
    const 시한 = setTimeout(res, 9000);
    const on = (e) => {
      if (JSON.parse(e.data).method === "Page.loadEventFired") {
        clearTimeout(시한);
        ws.removeEventListener("message", on);
        res();
      }
    };
    ws.addEventListener("message", on);
  });

  return { ws, send, ev };
}

const 쉬다 = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });

/* 로고를 미리 물들이던 단계는 걷었다. 이제 로고는 코드 안에서 그려지고
   (components/LogoMark.tsx) 벌의 색을 CSS 변수로 받으므로, 찍을 때 따로
   만들어 둘 그림 파일이 없다. 그 파일을 받아 오느라 늦어 바다 벌의 첫 화면이
   로고 없이 찍혔던 적이 있다 — 받아 올 것이 없으니 그 경주도 없어졌다. */

for (const 밝 of 밝기) {
for (const key of PALETTES) {
  for (const shot of SHOTS) {
    const c = await attach(BASE + shot.url);

    /* 벌은 문서가 열리기 직전에 심는다.
       그냥 담아 두고 다시 열면 안 된다. 앱이 뜨면서 서버 설정을 받아 와
       localStorage를 통째로 덮어쓰는데(utils/prefs.ts의 putPrefs), 그것이
       우리가 담은 값보다 늦게 오면 되읽기 때는 서버 값으로 떠 버린다.
       아래 스크립트는 페이지의 어떤 코드보다 먼저 돌아 그 경주를 없앤다. */
    await c.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `(() => {
        const k = "life-expense:prefs";
        const p = JSON.parse(localStorage.getItem(k) || "{}");
        p.palette = ${JSON.stringify(key)};
        p.theme_mode = ${JSON.stringify(밝.mode)};
        p.theme_light = ${JSON.stringify(밝.mode === "light" ? 밝.key : "now")};
        p.theme_dark = ${JSON.stringify(밝.mode === "dark" ? 밝.key : "moon")};
        localStorage.setItem(k, JSON.stringify(p));
      })();`,
    });
    await c.send("Page.reload", { ignoreCache: false });
    /* 씀씀이는 그림을 다 그릴 때까지 기다려야 한다. */
    await 쉬다(shot.file === "charts" ? 5000 : 4000);

    /* 제 벌로 떴는지 확인한다. 틀린 채로 찍히면 예시가 거짓말을 하게 된다.
       한 번 더 열어 보고 그래도 아니면 멈춘다 — 조용히 넘어가지 않는다. */
    const 본다 = () => c.ev(
      `document.documentElement.dataset.palette + "/" + document.documentElement.dataset.step`
    );
    const 바라는것 = `${key}/${밝.key}`;
    let 붙은것 = await 본다();
    if (붙은것 !== 바라는것) {
      await c.send("Page.reload", { ignoreCache: true });
      await 쉬다(shot.file === "charts" ? 5000 : 4000);
      붙은것 = await 본다();
    }
    if (붙은것 !== 바라는것) {
      throw new Error(`${바라는것}/${shot.file}: 화면에 붙은 것이 "${붙은것}"이다`);
    }

    /* 지출 내역에는 들어온 돈이 한 줄이라도 보여야 한다. 나간 돈만 찍히면
       붉은 숫자만 남아, 들어옴 빛깔이 아주 다른 벌끼리도 예시가 똑같아 보인다.

       밀어서 맞추지는 않는다. 밀면 제목과 갈래 탭이 위로 사라져 화면으로
       읽히지 않는다. 대신 들어온 돈이 첫 화면에 들어오는 달까지 뒤로 넘긴다.
       들어온 돈은 드물어 그 달의 마지막 날 가까이에 있어야 위로 올라온다. */
    if (shot.file === "entries") {
      const 달 = await c.ev(`(async () => {
        const 보이나 = () => [...document.querySelectorAll(".card--entry > .in-bar")]
          .some((b) => b.getBoundingClientRect().bottom < innerHeight - 70);
        const 뒤로 = () => {
          const b = [...document.querySelectorAll("button")]
            .find((x) => x.textContent.trim() === "‹");
          if (b) b.click();
          return !!b;
        };
        const 이름 = () => (document.querySelector(".month-nav__label, .month-label")
          || {}).textContent || "";
        for (let i = 0; i < 12; i++) {
          if (보이나()) return "찾음 " + 이름().trim();
          if (!뒤로()) break;
          await new Promise((r) => setTimeout(r, 900));
        }
        return "못 찾음";
      })()`, true);
      console.log("  들어온 돈:", 달);
      await 쉬다(900);
    }

    await c.ev(`(() => {
      const e = document.createElement("style");
      e.textContent = ${JSON.stringify(가림)};
      document.head.appendChild(e);
      return 1;
    })()`);
    await 쉬다(1000);

    /* clip과 captureBeyondViewport를 쓰면 보임창이 늘어나며 ResponsiveContainer가
       다시 그려져 막대가 빈 채로 찍힌다. 보임창 크기가 곧 그림 크기라 그냥 찍는다. */
    /* WebP로 굽는다. 흐려 둔 화면은 결이 부드러워 아주 잘 눌린다 —
       PNG로는 한 장에 110KB였던 것이 20KB 안쪽이 된다.
       스물네 장을 미리 받아 두는데, 무거우면 정작 볼 한 장이 대역을 나눠
       쓰느라 늦게 온다. 한 번 재어 보니 872ms가 5188ms로 늘었다. */
    const s = await c.send("Page.captureScreenshot", { format: "webp", quality: 82 });
    const file = path.join(OUT, `${key}_${shot.file}_${밝.key}.webp`);
    fs.writeFileSync(file, Buffer.from(s.data, "base64"));
    console.log(path.relative(process.cwd(), file));
    c.ws.close();
  }
}
}

/* 담아 둔 빛깔을 원래대로 돌려놓는다. 안 그러면 다음에 브라우저를 열 때
   마지막으로 찍은 벌이 그대로 남는다. */
const c = await attach(BASE + "/");
await c.ev(`(() => {
  const k = "life-expense:prefs";
  const p = JSON.parse(localStorage.getItem(k) || "{}");
  delete p.palette;
  delete p.theme_mode;
  delete p.theme_light;
  delete p.theme_dark;
  localStorage.setItem(k, JSON.stringify(p));
  return 1;
})()`);
c.ws.close();
console.log(`${밝기.length * PALETTES.length * SHOTS.length}장 완료`);
process.exit(0);
