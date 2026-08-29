/**
 * 화면마다 딸린 그림.
 *
 * 내역 · 설정 탭의 목록(MenuList)이 쓰던 것을 한자리에 모았다. 잔소리 상세에서
 * "그 화면으로 건너뛰기" 단추도 같은 그림을 쓰기 때문이다 — 같은 화면을
 * 가리키는데 그림이 다르면 어디로 가는지 알아보기 어렵다.
 *
 * 모두 32 상자에 1.6 두께의 선으로 그린다.
 */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const PAGE_ICON: Record<string, React.ReactNode> = {
  "/entries": (
    <svg viewBox="0 0 32 32" {...stroke}>
      <path d="M6 5h20v22H6z" />
      <path d="M11 12h10M11 17h10M11 22h6" />
    </svg>
  ),

  /* 모래시계 — 아래에 모래가 조금 쌓였다 */
  "/pending-entries": (
    <svg viewBox="0 0 32 32" {...stroke}>
      {/* 위아래 테 */}
      <path d="M9 5h14M9 27h14" />
      {/* 유리 — 가운데가 잘록하다 */}
      <path d="M11 5v3.4c0 3.6 5 5.6 5 7.6s-5 4-5 7.6V27" />
      <path d="M21 5v3.4c0 3.6-5 5.6-5 7.6s5 4 5 7.6V27" />
      {/* 아래에 쌓인 모래.
          위쪽에도 남은 모래를 그려 봤지만, 26px 에서는 잘록한 목의 선과 붙어
          덩어리로 보였다. 목의 틈이 0.5px 도 안 돼 떼어 놓을 수가 없다.
          아래에 쌓인 것만으로도 "모래가 내려앉는 중" 은 충분히 읽힌다. */}
      <path d="M12 25.7c0-3.1 2.3-4.8 4-4.8s4 1.7 4 4.8z" fill="currentColor" stroke="none" />
    </svg>
  ),

  "/scheduled-entries": (
    <svg viewBox="0 0 32 32" {...stroke}>
      <path d="M6 9h20v18H6z" />
      <path d="M6 15h20M11 5v6M21 5v6" />
      <path d="M13 21h6" />
    </svg>
  ),

  "/calendar": (
    <svg viewBox="0 0 32 32" {...stroke}>
      <path d="M5 8h22v19H5z" />
      <path d="M5 14h22M11 5v5M21 5v5" />
      <path d="M10 19h3M15 19h3M20 19h3M10 23h3M15 23h3" />
    </svg>
  ),

  "/categories": (
    <svg viewBox="0 0 32 32" {...stroke}>
      <path d="M5 8h9l2 3h11v13H5z" />
      <path d="M5 15h22" />
    </svg>
  ),

  "/payment-methods": (
    <svg viewBox="0 0 32 32" {...stroke}>
      <rect x="4" y="8" width="24" height="16" rx="3" />
      <path d="M4 14h24M8 19h5" />
    </svg>
  ),

  "/counterparts": (
    <svg viewBox="0 0 32 32" {...stroke}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M4 25c0-4.4 3.6-7 8-7s8 2.6 8 7" />
      <circle cx="23" cy="13" r="3.5" />
      <path d="M22 19c3.4.3 6 2.8 6 6" />
    </svg>
  ),

  /* 과녁 — 가운데를 맞히면 이긴다. 목표라는 말과 가장 곶바로 이어진다 */
  "/goals": (
    <svg viewBox="0 0 32 32" {...stroke}>
      <circle cx="16" cy="16" r="11" />
      <circle cx="16" cy="16" r="6.5" />
      <circle cx="16" cy="16" r="2" fill="currentColor" stroke="none" />
    </svg>
  ),

  /* 종 — 단추의 것(BellIcon)과 같은 종이되, 여기 그림들과 같은 선으로 다시 그렸다 */
  "/nudges": (
    <svg viewBox="0 0 32 32" {...stroke}>
      <path d="M16 4v2.6" />
      <path d="M24.6 15.2c0-4.7-3.8-8.6-8.6-8.6s-8.6 3.9-8.6 8.6c0 5.9-2.1 8.6-3.7 10.2h24.6c-1.6-1.6-3.7-4.3-3.7-10.2Z" />
      <path d="M18.8 27.9a2.9 2.9 0 0 1-5.6 0" />
    </svg>
  ),
};
