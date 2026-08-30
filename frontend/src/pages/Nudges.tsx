import { useState } from "react";
import { useNavigate } from "react-router-dom";
import QuickActions from "./components/QuickActions";
import NudgeGroup from "./components/NudgeGroup";
import NudgeDetailPopup from "./components/NudgeDetailPopup";
import useNudges from "../hooks/useNudges";
import type { Nudge } from "../utils/nudges";
import { prefOn } from "../utils/prefs";

/**
 * 잔소리.
 *
 * 규칙을 저장하지 않는다 — 최근 세 달치를 다시 세서 한마디 한다. 그래서
 * 달을 넘기는 단추가 없다. 여기는 "지금"을 보는 화면이고, 지난 달을
 * 되짚는 것은 씀씀이가 맡는다.
 *
 * 세는 일은 종 단추와 나눠 쓴다(useNudges) — 화면과 팝업이 다른 말을
 * 하면 안 되기 때문이다.
 */
export default function Nudges() {
  const navigate = useNavigate();

  /* 씀씀이 · 달력과 같은 두 단추. 여기서는 Blur를 처음부터 켜 둔다 —
     가려 둔 갈래도 잔소리에는 들어가야 하고, 화면에서만 테이프로 덮는다. */
  const [blurOn, setBlurOn] = useState(() => prefOn("blur_default"));
  const [excludeOn, setExcludeOn] = useState(() => prefOn("exclude_default"));

  const { nudges, ready } = useNudges({ blurOn, excludeOn });
  const [picked, setPicked] = useState<Nudge | null>(null);

  /* 팝업은 뒤로 가기용 자리를 하나 밀어 두고 있다. 그냥 옮기면 그 자리를
     되감으면서 방금 연 화면에서 튕겨 나온다. 먼저 뒤로 가서 팝업을 닫고,
     그 되감기가 끝난 뒤에 옮긴다.
     귀 기울이는 일을 useEffect가 아니라 누르는 그 자리에서 붙인다 —
     팝업이 닫히면서 사라지는 바람에 정작 신호를 못 받는 일을 막는다. */
  const goAfterClose = (path: string) => {
    const onPop = () => {
      window.removeEventListener("popstate", onPop);
      window.setTimeout(() => navigate(path), 0);
    };
    window.addEventListener("popstate", onPop);
    window.history.back();
  };

  const mind = nudges.filter((n) => n.level !== "good");
  const well = nudges.filter((n) => n.level === "good");

  return (
    <div className="page-wrap">
      {/* 무엇을 셈에 넣을지 — 씀씀이 · 달력과 같은 자리, 같은 모양 */}
      <div className="cal-sources">
        <button
          type="button"
          className={`cal-source cal-source--blur${blurOn ? " on" : ""}`}
          aria-pressed={blurOn}
          onClick={() => setBlurOn((v) => !v)}
        >
          Blur
        </button>

        <button
          type="button"
          className={`cal-source cal-source--exclude${excludeOn ? " on" : ""}`}
          aria-pressed={excludeOn}
          onClick={() => setExcludeOn((v) => !v)}
        >
          Exclude
        </button>
      </div>

      <div className="chart-grid">
        {ready && mind.length === 0 && well.length === 0 && (
          <section className="chart-card">
            <div className="page-empty">잔소리할 게 없습니다.</div>
          </section>
        )}

        {well.length > 0 && (
          <section className="chart-card">
            <NudgeGroup title=";-)" list={well} onPick={setPicked} />
          </section>
        )}

        {mind.length > 0 && (
          <section className="chart-card">
            <NudgeGroup title=":-(" list={mind} onPick={setPicked} />
          </section>
        )}
      </div>

      {picked && (
        <NudgeDetailPopup
          nudge={picked}
          onClose={() => setPicked(null)}
          onGo={goAfterClose}
        />
      )}

      <QuickActions />
    </div>
  );
}
