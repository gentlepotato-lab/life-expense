import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { pref } from "./utils/prefs";
import { applyPalette } from "./utils/palettes";

/* 빛깔은 첫 칠보다 먼저 정해져야 한다 — 그리고 나서 갈아 끼우면 열 때마다
   색이 한 번 바뀌는 것이 보인다. 담아 둔 값은 localStorage에 있어 기다릴
   것이 없다. 서버에서 받아 온 값은 App이 뒤따라 담고 다음에 열 때부터 쓴다. */
applyPalette(pref("palette"));

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
