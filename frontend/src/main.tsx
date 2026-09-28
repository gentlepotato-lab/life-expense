import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { pref } from "./utils/prefs";
import { applyPalette } from "./utils/palettes";
import { applyTheme, currentStep, watchSystem, DEFAULT_MODE, DEFAULT_LIGHT, DEFAULT_DARK } from "./utils/theme";

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
}

끼우기();

/* 시스템을 고른 사람에게는 운영체제가 바뀌는 그 자리에서 따라 바뀌어야 한다. */
watchSystem(() => {
  if ((pref("theme_mode") || DEFAULT_MODE) === "system") 끼우기();
});

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
