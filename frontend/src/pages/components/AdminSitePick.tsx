import { useEffect, useRef, useState } from "react";

/**
 * 어느 사이트의 기록을 볼지 고르는 드롭다운.
 *
 * 액션 기록은 두 사이트의 기록을 한 표에 쌓는다. 사용자 사이트를 보러 들어왔는데
 * 관리자 사이트를 드나든 줄이 그 사이에 섞여 있으면, 쌓인 줄의 대부분이 제가
 * 방금 눌러 만든 것이다(지금 표에 4,121줄 가운데 2,895줄이 관리자 쪽이다).
 * 그래서 한 쪽만 보고, 기본은 사용자 사이트다.
 *
 * 꼴은 사용자 사이트에서 고정과 변동을 선택하는 드롭다운을 그대로 쓴다(FixedFilter.tsx). 알약
 * 하나를 눌러 판을 펴고, 줄마다 네모와 그림과 이름이 선다. 둘 가운데 하나만
 * 켜지므로 네모는 켠 줄에만 찬다.
 *
 * 그림 둘은 이 자리에서만 쓴다. 사람은 쓰는 쪽, 자물쇠는 운영하는 쪽이다.
 * 관리자 사이트가 암호 한 겹 뒤에 있으므로(pages/Admin.tsx) 자물쇠가 그 쪽을
 * 가리키는 기호로 맞다. 굵기와 마감은 앱의 다른 선 그림과 같은 24 상자에
 * 2px 둥근 끝이다(FixedIcons.tsx).
 */

export type 사이트 = "user" | "admin";

const 선 = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function 사람그림({ className }: { className?: string }) {
  return (
    <svg className={className} {...선}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </svg>
  );
}

function 자물쇠그림({ className }: { className?: string }) {
  return (
    <svg className={className} {...선}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" />
      <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" />
      <path d="M12 14.4v2.2" />
    </svg>
  );
}

const 들 = [
  { key: "user" as const, 이름: "사용자 사이트", 짧게: "사용자", 그림: 사람그림 },
  { key: "admin" as const, 이름: "관리자 사이트", 짧게: "관리자", 그림: 자물쇠그림 },
];

export default function AdminSitePick({
  값,
  on바뀜,
}: {
  값: 사이트;
  on바뀜: (다음: 사이트) => void;
}) {
  const [열림, set열림] = useState(false);
  const 상자 = useRef<HTMLSpanElement>(null);

  /* 판 바깥을 누르면 접는다. 그림 위에서 눌러도 접혀야 하므로 문서에서 듣는다.
     그 드롭다운과 같은 잣대다(FixedFilter.tsx). */
  useEffect(() => {
    if (!열림) return;
    const 접기 = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (상자.current && t && 상자.current.contains(t)) return;
      set열림(false);
    };
    document.addEventListener("pointerdown", 접기, true);
    return () => document.removeEventListener("pointerdown", 접기, true);
  }, [열림]);

  const 선것 = 들.find((s) => s.key === 값) ?? 들[0];
  const 선그림 = 선것.그림;

  return (
    <span className="fx-filter admin-site" ref={상자}>
      <button
        type="button"
        className={`filter-pill admin-site__pill${열림 ? " on" : ""}`}
        aria-expanded={열림}
        aria-haspopup="true"
        title="어느 사이트의 기록을 볼지 선택합니다."
        onClick={() => set열림((v) => !v)}
      >
        <선그림 className="admin-site__ico" />
        {선것.짧게}
        <span className="fx-filter__caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {열림 && (
        <div className="fx-pop admin-site__pop" role="dialog" aria-label="사이트 선택">
          {들.map((s) => {
            const 그림 = s.그림;
            return (
              <button
                key={s.key}
                type="button"
                className={`fx-pop__row${s.key === 값 ? " on" : ""}`}
                aria-pressed={s.key === 값}
                onClick={() => {
                  on바뀜(s.key);
                  set열림(false);
                }}
              >
                <span className="fx-pop__box" aria-hidden="true">
                  {s.key === 값 ? "✓" : ""}
                </span>
                <그림 className="fx-pop__ico" />
                {s.이름}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}
