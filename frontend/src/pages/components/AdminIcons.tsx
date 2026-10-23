/**
 * 관리자 사이트의 페이지마다 딸린 그림.
 *
 * 탭 첫 쪽의 칸이 오른쪽 끝에 단다. 사용자 사이트의 것과 같은 잣대로
 * 그린다. 32 상자에 1.6 두께의 선이다(MenuIcons.tsx).
 */

const 선 = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const ADMIN_ICON: Record<string, React.ReactNode> = {
  /* 대시보드. 막대 셋과 그 위를 지나는 선이다. */
  "/admin/dash": (
    <svg viewBox="0 0 32 32" {...선}>
      <path d="M5 27h22" />
      <path d="M10 27v-8M16 27v-13M22 27v-6" />
    </svg>
  ),

  /* 액션 기록. 줄 세 개와 돋보기다. 한 줄씩 들여다보는 자리다. */
  "/admin/logs": (
    <svg viewBox="0 0 32 32" {...선}>
      <path d="M6 8h20M6 14h20M6 20h11" />
      <circle cx="22" cy="23" r="5" />
      <path d="M25.6 26.6L29 30" />
    </svg>
  ),

  /* 사용자. 둘이 선 모습이다. */
  "/admin/users": (
    <svg viewBox="0 0 32 32" {...선}>
      <circle cx="13" cy="12" r="4.5" />
      <path d="M5 26c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5" />
      <path d="M22 9.5a4 4 0 0 1 0 8" />
      <path d="M24 19.2c2.6.9 4 3.3 4 6.8" />
    </svg>
  ),

  /* 공지. 확성기다. 떠 있는 공지 띠의 기호와 같은 뜻이다(MegaphoneIcon.tsx). */
  "/admin/notice": (
    <svg viewBox="0 0 32 32" {...선}>
      <path d="M7 13v6h4l9 5V8l-9 5z" />
      <path d="M24 12.5a5 5 0 0 1 0 7" />
      <path d="M11 19v6" />
    </svg>
  ),

  /* 문구. 말풍선이다. 쪽지에 뜨는 글이다. */
  "/admin/doodle": (
    <svg viewBox="0 0 32 32" {...선}>
      <path d="M5 7h22v14H14l-6 5v-5H5z" />
      <path d="M11 14h.01M16 14h.01M21 14h.01" />
    </svg>
  ),

  /* 메뉴. 점과 줄로 된 목록이다. */
  "/admin/menu": (
    <svg viewBox="0 0 32 32" {...선}>
      <path d="M11 9h16M11 16h16M11 23h10" />
      <path d="M6 9h.01M6 16h.01M6 23h.01" />
    </svg>
  ),

  /* 배치. 시계다. 때가 되면 저 혼자 돈다. */
  "/admin/batch": (
    <svg viewBox="0 0 32 32" {...선}>
      <circle cx="16" cy="17" r="10" />
      <path d="M16 11v6l4 2" />
      <path d="M12 5h8" />
    </svg>
  ),

  /* 외부 API. 지구다. 바깥에 묻는 자리다. */
  "/admin/api": (
    <svg viewBox="0 0 32 32" {...선}>
      <circle cx="16" cy="16" r="11" />
      <path d="M5 16h22" />
      <path d="M16 5c3.5 3.5 3.5 18 0 22c-3.5-4-3.5-18.5 0-22z" />
    </svg>
  ),

  /* DB. 쌓인 원통이다. */
  "/admin/db": (
    <svg viewBox="0 0 32 32" {...선}>
      <ellipse cx="16" cy="8" rx="10" ry="4" />
      <path d="M6 8v16c0 2.2 4.5 4 10 4s10-1.8 10-4V8" />
      <path d="M6 16c0 2.2 4.5 4 10 4s10-1.8 10-4" />
    </svg>
  ),

  /* 비밀번호. 자물쇠다. */
  "/admin/pw": (
    <svg viewBox="0 0 32 32" {...선}>
      <path d="M8 14h16v13H8z" />
      <path d="M12 14v-3.5a4 4 0 0 1 8 0V14" />
      <path d="M16 19v3" />
    </svg>
  ),

  /* 로그인 기록. 문으로 들어서는 화살표다. */
  "/admin/login-log": (
    <svg viewBox="0 0 32 32" {...선}>
      <path d="M13 6H7v20h6" />
      <path d="M12 16h14" />
      <path d="M21 11l5 5-5 5" />
    </svg>
  ),
};
