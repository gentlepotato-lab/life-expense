import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Write from "./pages/Write";
import Entries from "./pages/Entries";
import PendingEntries from "./pages/PendingEntries";
import ScheduledEntries from "./pages/ScheduledEntries";
import Categories from "./pages/Categories";
import PaymentMethods from "./pages/PaymentMethods";
import Counterparts from "./pages/Counterparts";
import Calendar from "./pages/Calendar";
import CalendarDetail from "./pages/CalendarDetail";
import Home from "./pages/Home";
import Blank from "./pages/Blank";
import History from "./pages/History";
import Settings from "./pages/Settings";
import PageHead from "./pages/components/PageHead";
import TabBar from "./pages/components/TabBar";

/** 앞머리 화면이 떠 있는 시간. 사라지는 데 걸리는 320ms 는 여기에 포함하지 않는다 */
const SPLASH_MS = 1500;
/** #splash 의 opacity 전환 시간(index.html)과 맞춰 둘 것 */
const SPLASH_FADE_MS = 320;

/**
 * 앞머리 화면을 걷어 낸다.
 * index.html 에 인라인으로 박아 둔 것이라, React 가 붙은 뒤 여기서 치운다.
 *
 * 기다리는 시간은 "React 가 붙은 때" 가 아니라 "화면이 열린 때" 부터 센다.
 * performance.now() 가 곧 그 시각부터 흐른 밀리초라, 붙는 데 오래 걸린 날에도
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

function App() {
  useSplashDismiss();

  return (
    // 화면은 루트에 선다. API 가 모두 /api 아래로 들어가면서
    // 더 이상 /app/ 으로 비켜 서 있을 이유가 없어졌다.
    <BrowserRouter>
      {/* 머리말은 화면 바깥에서 한 번만 그린다.
          페이지마다 그리면 옮길 때 새로 만들어져 갈래 탭 알약이 튄다. */}
      <PageHead />

      <Routes>
        {/* 홈: / — 들어가는 문만 낸 첫 화면 */}
        <Route path="/" element={<Home />} />
        {/* 쓰기 페이지 */}
        <Route path="/write" element={<Write />} />
        {/* 내역 탭 첫 화면 — 셋 중 하나로 들어간다 */}
        <Route path="/history" element={<History />} />
        {/* 지출 내역 페이지 */}
        <Route path="/entries" element={<Entries />} />
        {/* 대기 내역 페이지 */}
        <Route path="/pending-entries" element={<PendingEntries />} />
        {/* 정기 내역 페이지 */}
        <Route path="/scheduled-entries" element={<ScheduledEntries />} />
        {/* 달력 페이지 */}
        <Route path="/calendar" element={<Calendar />} />
        {/* 달력에서 고른 기간의 상세 — 달력에 딸린 화면이다 */}
        <Route path="/calendar/detail" element={<CalendarDetail />} />
        {/* 설정 탭 첫 화면 */}
        <Route path="/settings" element={<Settings />} />
        {/* 분류 페이지 */}
        <Route path="/categories" element={<Categories />} />
        {/* 결제 수단 페이지 */}
        <Route path="/payment-methods" element={<PaymentMethods />} />
        {/* 함께한 상대 페이지 — 금액 쪼개기의 상대 목록 */}
        <Route path="/counterparts" element={<Counterparts />} />
        {/* 홈에서 문만 내 둔 화면들 — 속은 뒤에 채운다.
            이름은 PageHead 가 경로를 보고 붙인다(utils/pageTitles.ts) */}
        <Route path="/me" element={<Blank />} />
        <Route path="/charts" element={<Blank />} />
        <Route path="/nudges" element={<Blank />} />

        {/* 존재하지 않는 경로 → 홈으로 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* 화면 아래 이동 막대 — 어느 화면에서나 같은 자리에 있다 */}
      <TabBar />
    </BrowserRouter>
  );
}

export default App;
