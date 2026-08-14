import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Menu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      {/* ☰ 버튼 */}
      <button
        className="menu-button"
        onClick={() => setOpen(!open)}
        aria-label="Menu"
      >
        ☰
      </button>

      {/* 메뉴 패널 */}
      {open && (
        <div className="menu-overlay" onClick={() => setOpen(false)}>
          <div
            className="menu-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="menu-title"></h2>
            {/* Pages 그룹 */}
            <div className="menu-group-title">Pages</div>

            <button
              onClick={() => { navigate("/"); setOpen(false); }}
              className="menu-sub-item"
            >
              • Add Expense
            </button>

            <button
              onClick={() => { navigate("/entries"); setOpen(false); }}
              className="menu-sub-item"
            >
              • Expense Records
            </button>

            <button
              onClick={() => { navigate("/pending-entries"); setOpen(false); }}
              className="menu-sub-item"
            >
              • Pending Entries
            </button>

            <button
              onClick={() => { navigate("/scheduled-entries"); setOpen(false); }}
              className="menu-sub-item"
            >
              • Scheduled Entries
            </button>

            {/* Settings 그룹 */}
            <div className="menu-group-title">Settings</div>

            <button
              onClick={() => { navigate("/categories"); setOpen(false); }}
              className="menu-sub-item"
            >
              • Categories
            </button>

            <button
              onClick={() => { navigate("/payment-methods"); setOpen(false); }}
              className="menu-sub-item"
            >
              • Payment Methods
            </button>

            <button
              onClick={() => { navigate("/counterparts"); setOpen(false); }}
              className="menu-sub-item"
            >
              • Counterparts
            </button>
            <hr className="menu-divider" />
            <button onClick={() => setOpen(false)} className="menu-close">닫기</button>
          </div>
        </div>
      )}
    </>
  );
}