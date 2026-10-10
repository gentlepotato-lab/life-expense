import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { pref } from "./utils/prefs";
import { applyPalette } from "./utils/palettes";
import { applyTheme, currentStep, watchSystem, DEFAULT_MODE, DEFAULT_LIGHT, DEFAULT_DARK } from "./utils/theme";
import { applyMotion } from "./utils/motion";

/** 앞머리 화면이 꺼내 쓰는 빛깔. index.html의 열쇠 이름과 같아야 한다. */
const SPLASH_KEY = "life-expense:splash";

/**
 * 지금 정해진 빛깔을 앞머리 화면 몫으로 담아 둔다.
 *
 * 앞머리는 꾸러미가 닿기 전에 칠해진다 — 그때는 이 파일이 아직 돌지 않아
 * 벌도 밝기도 모른다. 그래서 열 때마다 정해진 값을 담아 두고, 다음에 열 때
 * index.html이 그것으로 먼저 칠하게 한다. 벌이나 밝기를 바꾸면 그 자리에서
 * 다시 담기므로 한 번 열고 나면 늘 지금 빛깔이다.
 *
 * 값은 방금 꽂아 둔 CSS 변수에서 그대로 읽는다. 표를 여기에 또 적으면
 * 언젠가 한쪽만 고쳐져 앞머리와 본 화면의 빛깔이 갈라진다.
 */
function 앞머리기억(): void {
  const s = getComputedStyle(document.documentElement);
  const 꺼내기 = (이름: string) => s.getPropertyValue(이름).trim();
  try {
    window.localStorage.setItem(
      SPLASH_KEY,
      JSON.stringify({
        bg: 꺼내기("--color-bg"),
        ink: 꺼내기("--art-ink"),
        aqua: 꺼내기("--art-aqua"),
        tint: 꺼내기("--art-tint"),
        name: 꺼내기("--color-text-tertiary"),
      })
    );
  } catch {
    /* 담아 둘 자리가 막혀 있으면 다음 번에 다시 해 본다. */
  }
}

/* 밝기와 빛깔은 첫 칠보다 먼저 정해져야 한다. 그리고 나서 갈아 끼우면 열
   때마다 화면이 한 번 바뀌는 것이 보인다. 담아 둔 값은 localStorage에 있어
   기다릴 것이 없다. 서버에서 받아 온 값은 App이 뒤따라 담고 다음에 열 때부터 쓴다.

   밝기가 먼저다. 어두운 칸이면 벌도 어두운 쪽 모습으로 끼워야 해서, 빛깔은
   어느 칸인지를 알고 나서야 정해진다. */
function 끼우기() {
  applyTheme(
    pref("theme_mode") || DEFAULT_MODE,
    pref("theme_light") || DEFAULT_LIGHT,
    pref("theme_dark") || DEFAULT_DARK
  );
  applyPalette(pref("palette"), currentStep().dark);
  /* 움직임도 첫 칠보다 먼저 정해져야 한다. 뒤에 끄면 미끄러지다 멈추는 것이
     보이고, 그것은 끈 것이 아니라 고장 난 것으로 읽힌다.
     앞머리 로고는 이보다 더 먼저 서야 해서 index.html이 따로 붙인다. */
  applyMotion(pref("motion_on"));
  앞머리기억();
}

끼우기();

/* 시스템을 고른 사람에게는 운영체제가 바뀌는 그 자리에서 따라 바뀌어야 한다. */
watchSystem(() => {
  if ((pref("theme_mode") || DEFAULT_MODE) === "system") 끼우기();
});

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
