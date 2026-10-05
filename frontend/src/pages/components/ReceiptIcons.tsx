/**
 * 영수증 팝업의 단추 그림 셋.
 *
 * MenuIcons와 같은 32 상자에 둥근 선으로 그린다. 다만 선은 2로 둔다 —
 * 저 그림들은 26px로 서지만 이것들은 16px로 서서, 1.6으로 그으면 흐릿하다.
 * 잔소리 상세의 화살표도 같은 자리에서 2.4를 쓴다.
 */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** 복사 — 종이 한 장을 겹쳐 뗀다. */
export const CopyIcon = (
  <svg viewBox="0 0 32 32" {...stroke}>
    <rect x="12" y="12" width="15" height="15" rx="2.5" />
    <path d="M8 20H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1" />
  </svg>
);

/** 공유 — 한 점에서 두 곳으로 뻗는다. */
export const ShareIcon = (
  <svg viewBox="0 0 32 32" {...stroke}>
    <circle cx="23" cy="7.5" r="3.2" />
    <circle cx="9" cy="16" r="3.2" />
    <circle cx="23" cy="24.5" r="3.2" />
    <path d="M20.3 9.2 11.7 14.3M11.7 17.7l8.6 5.1" />
  </svg>
);

/** 다운로드 — 바닥으로 내려 꽂는다. */
export const DownloadIcon = (
  <svg viewBox="0 0 32 32" {...stroke}>
    <path d="M16 5v14M10 14l6 6 6-6M6 26h20" />
  </svg>
);
