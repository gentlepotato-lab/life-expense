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
import NotifyHost from "./pages/components/NotifyHost";
import { loadPrefs, pref, takeHome } from "./utils/prefs";
import { applyTape } from "./utils/tapes";
import { applyMotion } from "./utils/motion";

/**
 * 앞머리 화면이 떠 있는 시간. 사라지는 데 걸리는 320ms는 여기에 포함하지 않는다.
 *
 * 차례가 이렇다(index.html).
 *   펜이 획을 긋는다      0 ~ 2.06초
 *   이름이 올라온다       1.76 ~ 2.18초
 *   형광펜이 지나간다     2.12 ~ 2.54초
 *
 * 다 쓰자마자 걷으면 쫓기듯 보인다. 마지막 움직임이 멎고도 0.36초를 그대로
 * 두었다가 걷는다 — 사라지는 320ms까지 더해 3.22초다.
 *
 * 2.60초이던 것을 늘린 것은 형광펜이 2.54초에야 끝나기 때문이다. 그대로 두면
 * 다 칠해진 로고를 0.06초밖에 못 보고 넘어가, 전에 "다 끝나기 전에 넘어간다"던
 * 그 느낌이 그대로 난다.
 */
const SPLASH_MS = 2900;
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

     마스킹 테이프와 움직임만은 받아 온 그 자리에서 갈아 끼운다 — 둘 다
     표시 하나라 다시 그릴 것이 없고, 다음에 열 때까지 기다릴 까닭도 없다.
     다른 기기에서 끄고 왔으면 이 기기도 그 자리에서 따라 멈춘다. */
  useEffect(() => {
    applyTape(pref("tape_style"));
    void loadPrefs().then(() => {
      applyTape(pref("tape_style"));
      applyMotion(pref("motion_on"));
    });
  }, []);

  return (
    // 화면은 루트에 선다. API가 모두 /api 아래로 들어가면서
    // 더 이상 /app/으로 비켜 서 있을 이유가 없어졌다.
    <BrowserRouter>
      {/* 머리말은 화면 바깥에서 한 번만 그린다.
          페이지마다 그리면 옮길 때 새로 만들어져 갈래 탭 알약이 튄다. */}
      <PageHead />

      {/* 알림 · 되묻기 · 이름 받기가 서는 자리. 머리말과 같은 까닭으로
          화면 바깥에 한 번만 둔다 — 화면을 옮겨도 떠 있던 알림이 살아 있어야
          한다. 뜬 것이 없는 동안에는 아무것도 그리지 않는다. */}
      <NotifyHost />

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
        {/* 씀씀이에서 펼치는 상세 — 씀씀이에 딸린 화면이다.
            화면 자체는 달력의 상세와 똑같은 것이라(고른 범위와 걸린 조건에
            드는 내역을 죽 늘어놓는 일) 같은 부품을 쓴다. 주소를 따로 두는
            까닭은 소속 때문이다 — 이름표도 돌아갈 곳도 아래 막대가 켜는
            묶음도 씀씀이 것이어야 한다. */}
        <Route path="/charts/detail" element={<CalendarDetail />} />
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
