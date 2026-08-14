import { BrowserRouter, Routes, Route } from "react-router-dom";
import EntryForm from "./pages/EntryForm";
import EntriesGrid from "./pages/EntriesGrid";
import PendingEntries from "./pages/PendingEntries";
import ScheduledEntries from "./pages/ScheduledEntries";
import CategoriesSetting from "./pages/CategoriesSetting";
import PaymentMethodsSetting from "./pages/PaymentMethodsSetting";
import CounterpartsSetting from "./pages/CounterpartsSetting";
import Calculator from "./pages/Calculator";

function App() {
  return (
    // base 경로를 "/app"으로 고정
    <BrowserRouter basename="/app">
      <Routes>
        {/* Add Expense 페이지: /app/ */}
        <Route path="/" element={<EntryForm />} />
        {/* Expense Records 페이지: /app/entries */}
        <Route path="/entries" element={<EntriesGrid />} />
        {/* Pending Entries 페이지: /app/pending */}
        <Route path="/pending-entries" element={<PendingEntries />} />
        {/* Scheduled Entries 페이지: /app/scheduled */}
        <Route path="/scheduled-entries" element={<ScheduledEntries />} />
        {/* Categories 페이지: /app/categories */}
        <Route path="/categories" element={<CategoriesSetting />} />
        {/* Payment Methods 페이지: /app/payment-methods */}
        <Route path="/payment-methods" element={<PaymentMethodsSetting />} />
        {/* Counterparts 페이지: /app/counterparts — 금액 쪼개기의 상대 목록 */}
        <Route path="/counterparts" element={<CounterpartsSetting />} />
        {/* Calculator 페이지: /app/calculator */}
        <Route path="/calculator" element={<Calculator />} />
        {/* 존재하지 않는 경로 → 기본 페이지로 */}
        <Route path="*" element={<EntryForm />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;