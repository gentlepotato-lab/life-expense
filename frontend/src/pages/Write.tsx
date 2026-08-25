import EntryForm from "./components/EntryForm";
import QuickActions from "./components/QuickActions";

export default function Write() {
  return (
    <div className="page-wrap">

      {/* 카드 스타일 폼 컨테이너.
          같은 칸 묶음을 지출 내역의 적기 팝업도 쓴다 — 한 자리에 두었다. */}
      <EntryForm />

      <QuickActions />
    </div>
  );
}
