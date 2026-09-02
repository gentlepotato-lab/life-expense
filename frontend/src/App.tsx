import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Write from "./pages/Write";
import Entries from "./pages/Entries";
import PendingEntries from "./pages/PendingEntries";
import ScheduledEntries from "./pages/ScheduledEntries";
import Categories from "./pages/Categories";
import PaymentMethods from "./pages/PaymentMethods";
import Counterparts from "./pages/Counterparts";
import Goals from "./pages/Goals";
import Me from "./pages/Me";
import Places from "./pages/Places";
import Calendar from "./pages/Calendar";
import CalendarDetail from "./pages/CalendarDetail";
import Home from "./pages/Home";
import Nudges from "./pages/Nudges";
import History from "./pages/History";
import Settings from "./pages/Settings";
/* 씀씀이만 따로 떼어 낸다 — 그림 그리는 짐(Recharts)이 무거워서
   이 화면에 들어갈 때만 받아 오게 한다. 다른 화면은 가벼운 그대로다. */
const Charts = lazy(() => import("./pages/Charts"));

import PageHead from "./pages/components/PageHead";
import TabBar from "./pages/components/TabBar";
import { loadPrefs, pref, takeHome } from "./utils/prefs";
import { applyTape } from "./utils/tapes";

/** 앞머리 화면이 떠 있는 시간. 사라지는 데 걸리는 320ms는 여기에 포함하지 않는다. */
const SPLASH_MS = 1500;
/** #splash의 opacity 전환 시간(index.html)과 맞춰 둘 것 */
const SPLASH_FADE_MS = 320;

/**
 * 앞머리 화면을 걷어 낸다.
 * index.html에 인라인으로 박아 둔 것이라, React가 붙은 뒤 여기서 치운다.
 *
 * 기다리는 시간은 "React가 붙은 때"가 아니라 "화면이 열린 때"부터 센다.
 * performance.now()가 곧 그 시각부터 흐른 밀리초라, 붙는 데 오래 걸린 날에도
 * 앞머리 화면이 보이는 시간은 늘 1초로 같다.
 */
function useSplashDismiss() {
  useEffect(() => {
    const el = document.getElementById("splash");
    if (!el) return;

    const rest = Math.max(0, SPLASH_MS - performance.now());
    const hide = window.setTimeout(() => el.classList.add("out"), rest);
    const drop = window.setTimeout(() => el.remove(), rest + SPLASH_FADE_MS);
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(drop);
    };
  }, []);
}

/**
 * 홈 자리. 돈쓴이에서 고른 첫 화면이 홈이 아니면 그리로 넘긴다.
 *
 * 앱을 새로 연 그때 한 번만 넘긴다 — 탭의 홈까지 가로채면 홈에 갈 길이 없다.
 */
function HomeGate() {
  const [to] = useState(takeHome);
  return to === "/" ? <Home /> : <Navigate to={to} replace />;
}

function App() {
  useSplashDismiss();

  /* 설정은 화면이 뜨기 전에 있어야 하므로 브라우저에 담아 둔 것으로 먼저 그리고,
     서버에서 받아 온 것은 다음에 열 때부터 쓴다.

     마스킹 테이프만은 받아 온 그 자리에서 갈아 끼운다 — 변수 하나라 다시
     그릴 것이 없고, 다음에 열 때까지 기다릴 까닭도 없다. */
  useEffect(() => {
    applyTape(pref("tape_style"));
    void loadPrefs().then(() => applyTape(pref("tape_style")));
  }, []);

  return (
    // 화면은 루트에 선다. API가 모두 /api 아래로 들어가면서
    // 더 이상 /app/으로 비켜 서 있을 이유가 없어졌다.
    <BrowserRouter>
      {/* 머리말은 화면 바깥에서 한 번만 그린다.
          페이지마다 그리면 옮길 때 새로 만들어져 갈래 탭 알약이 튄다. */}
      <PageHead />

      <Routes>
        {/* 홈: / — 들어가는 문만 낸 첫 화면 */}
        <Route path="/" element={<HomeGate />} />
        {/* 쓰기 페이지 */}
        <Route path="/write" element={<Write />} />
        {/* 내역 탭 첫 화면 — 셋 중 하나로 들어간다. */}
        <Route path="/history" element={<History />} />
        {/* 지출 내역 페이지 */}
        <Route path="/entries" element={<Entries />} />
        {/* 대기 내역 페이지 */}
        <Route path="/pending-entries" element={<PendingEntries />} />
        {/* 정기 내역 페이지 */}
        <Route path="/scheduled-entries" element={<ScheduledEntries />} />
        {/* 달력 페이지 */}
        <Route path="/calendar" element={<Calendar />} />
        {/* 달력에서 고른 기간의 상세 — 달력에 딸린 화면이다. */}
        <Route path="/calendar/detail" element={<CalendarDetail />} />
        {/* 설정 탭 첫 화면 */}
        <Route path="/settings" element={<Settings />} />
        {/* 분류 페이지 */}
        <Route path="/categories" element={<Categories />} />
        {/* 결제 수단 페이지 */}
        <Route path="/payment-methods" element={<PaymentMethods />} />
        {/* 함께한 상대 페이지 — 금액 쪼개기의 상대 목록 */}
        <Route path="/counterparts" element={<Counterparts />} />
        {/* 안쓴이 도전 — 분류별 목표 금액 */}
        <Route path="/goals" element={<Goals />} />
        {/* 돈쓴이 — 쓰는 사람과 앱 자신 */}
        <Route path="/me" element={<Me />} />
        {/* 어디 쓰나 — 적어 둔 장소와 가게 */}
        <Route path="/places" element={<Places />} />
        <Route
          path="/charts"
          element={
            <Suspense fallback={<div className="page-wrap" />}>
              <Charts />
            </Suspense>
          }
        />
        <Route path="/nudges" element={<Nudges />} />

        {/* 존재하지 않는 경로 → 홈으로 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* 화면 아래 이동 막대 — 어느 화면에서나 같은 자리에 있다. */}
      <TabBar />
    </BrowserRouter>
  );
}

export default App;
