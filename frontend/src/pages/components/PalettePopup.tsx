/**
 * 빛깔과 배경 밝기 미리 보기.
 *
 * 고르기 전에 벌과 밝기가 화면에서 어떻게 보이는지 미리 본다. 한 번에 한
 * 화면만 크게 보여 준다 — 여러 장을 늘어놓으면 한 장이 손톱만 해져 정작
 * 색을 못 본다. 화면은 좌우로 밀거나 화살표로 넘기고, 벌과 밝기는 위 두
 * 줄에서 바꾼다. 누르면 그 자리에서 그림이 바뀐다.
 *
 * 그림은 public/palette에 미리 찍어 둔 것이다. 금액과 이름은 그림을 굽는
 * 단계에서 이미 흐려 놓았다 — CSS로 흐리면 원본이 파일에 그대로 남아 한 줄만
 * 지우면 드러난다. 다시 찍는 법은 docs/palette-shots.md에 적어 두었다.
 */
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import useBackClose from "../../hooks/useBackClose";
import { PALETTES, paletteOf, swatchOf } from "../../utils/palettes";
import { STEPS, type Step } from "../../utils/theme";

/** 예시로 보여 주는 네 화면. 파일 이름과 차례가 이 줄에서 정해진다. */
const SHOTS = [
  { file: "home", label: "홈" },
  { file: "entries", label: "지출 내역" },
  { file: "charts", label: "씀씀이" },
  { file: "calendar", label: "달력" },
];

export default function PalettePopup({
  value,
  step,
  onPick,
  onPickStep,
  onClose,
}: {
  /** 지금 줄에서 골라져 있는 벌 */
  value: string;
  /**
   * 지금 줄에서 골라져 있는 밝기 칸.
   *
   * 화면에 끼워진 칸이 아니라 줄에서 고른 칸이다. 밝기는 담아야 화면에
   * 끼워지므로, 끼워진 칸을 보면 고르는 중에 바꾼 밝기를 예시가 따라오지
   * 못한다 — 흰 종이를 골라 놓고 예시만 새벽빛으로 떴다.
   */
  step: Step;
  onPick: (key: string) => void;
  /** 고른 밝기 칸을 줄에 담는다. */
  onPickStep: (s: Step) => void;
  onClose: () => void;
}) {
  useBackClose(true, onClose);

  useEffect(() => {
    document.documentElement.classList.add("modal-open");
    return () => document.documentElement.classList.remove("modal-open");
  }, []);

  /* 들여다보는 벌과 밝기는 줄에서 고른 것과 따로 논다. 넘겨 보다가 마음에
     들면 그때 [적용]을 눌러 줄에 담는다. 그 전까지는 이 팝업 안에서만
     바뀌므로, 둘러보다 닫아도 쓰던 것이 그대로다. */
  const [shown, setShown] = useState(value);
  const [shownStep, setShownStep] = useState<Step>(step);
  const [at, setAt] = useState(0);
  const p = paletteOf(shown);
  const 꼬리 = `_${shownStep.key}`;

  /**
   * 그림을 미리 받아 둔다.
   *
   * 벌 여섯에 화면 넷이라 스물네 장이다. 누른 뒤에 받아 오면 다 받을 때까지
   * 옛 그림이 그대로 있어, 누른 사람에게는 "안 눌렸다"로 읽힌다 — 재어 보니
   * 옆으로 넘긴 뒤 알약을 누를 때 872ms였다. 한 번 받아 둔 뒤에는 2ms다.
   *
   * 한 손짓에 닿는 곳부터 받는다. 지금 벌의 네 화면(밀어서 가는 곳)과 지금
   * 화면의 여섯 벌(알약으로 가는 곳)이 먼저고, 나머지는 그 뒤에 따라온다.
   */
  const 받은칸 = useRef<Set<string>>(new Set());
  const 받아둔것 = useRef<HTMLImageElement[]>([]);
  useEffect(() => {
    /* 밝기 칸마다 그림이 따로 있다. 칸을 바꾸면 그 칸 것을 한 번 더 받는다. */
    if (받은칸.current.has(꼬리)) return;
    받은칸.current.add(꼬리);
    const 차례: string[] = [];
    const 담기 = (k: string, f: string) => {
      const src = `/palette/${k}_${f}${꼬리}.webp`;
      if (!차례.includes(src)) 차례.push(src);
    };
    SHOTS.forEach((x) => 담기(shown, x.file));
    PALETTES.forEach((x) => 담기(x.key, SHOTS[at].file));
    PALETTES.forEach((x) => SHOTS.forEach((y) => 담기(x.key, y.file)));
    /* 받아 둔 것을 잡고 있어야 한다. 놓으면 다 받기 전에 치워질 수 있다. */
    받아둔것.current = [
      ...받아둔것.current,
      ...차례.map((src) => {
        const img = new Image();
        img.src = src;
        return img;
      }),
    ];
  }, [shown, at, 꼬리]);

  /* 손가락을 따라 그림이 밀리는 거리. 놓으면 0으로 돌아온다. */
  const [민거리, set민거리] = useState(0);
  /* 끄는 동안에는 붙어 따라와야 하므로 전환을 끈다. */
  const [미끄러짐, set미끄러짐] = useState(false);
  const 창 = useRef<HTMLDivElement>(null);

  /**
   * 한 장 넘긴다.
   *
   * 새 그림을 반대쪽 바깥에 세워 두었다가 제자리로 미끄러뜨린다. 그래야
   * 화살표로 넘기든 손가락으로 밀든 같은 모습으로 넘어간다.
   */
  const 넘기기 = (걸음: number) => {
    const w = 창.current?.clientWidth ?? 300;
    setAt((i) => (i + 걸음 + SHOTS.length) % SHOTS.length);
    set미끄러짐(false);
    set민거리(걸음 > 0 ? w : -w);
    /* 바깥에 세운 것이 한 틀 그려진 뒤에 전환을 켠다. 같은 틀에 켜면
       브라우저가 둘을 묶어 버려 미끄러지지 않고 튄다. */
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        set미끄러짐(true);
        set민거리(0);
      })
    );
  };

  /* 밀기. 가로로 먼저 움직였을 때만 잡는다 — 세로로 먼저 가면 팝업을
     굴리려는 것이라 손을 뗀다. */
  const 잡은곳 = useRef<{ x: number; y: number; 가로: boolean | null } | null>(null);

  const 누름 = (e: ReactPointerEvent<HTMLDivElement>) => {
    잡은곳.current = { x: e.clientX, y: e.clientY, 가로: null };
    set미끄러짐(false);
  };

  const 움직임 = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = 잡은곳.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.가로 === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.가로 = Math.abs(dx) > Math.abs(dy);
      if (!g.가로) {
        잡은곳.current = null;
        return;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    set민거리(dx);
  };

  const 놓음 = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = 잡은곳.current;
    잡은곳.current = null;
    if (!g || !g.가로) return;
    const dx = e.clientX - g.x;
    const w = 창.current?.clientWidth ?? 300;
    /* 폭의 다섯 가운데 하나면 넘긴다. 손목만 까딱해도 넘어가되 스치기만
       해서는 안 넘어가는 거리다. */
    if (Math.abs(dx) > w / 5) {
      넘기기(dx < 0 ? 1 : -1);
      return;
    }
    set미끄러짐(true);
    set민거리(0);
  };

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel popup-panel--pal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="빛깔과 배경 밝기 미리 보기"
      >
        <h3>미리 보기</h3>

        {/* 조각의 생김새는 돈쓴이의 그 줄들과 같다 — 벌은 세 빛깔, 밝기는
            카드빛과 바탕빛 둘. 머리말은 조각 위에 얹는다. 벌에는 이름을
            조각 안에 적고, 밝기에는 적지 않는다 — 밝은 쪽에서 어두운 쪽으로
            가는 단계일 뿐이라 흑백이 이미 다 말한다. */}
        <div className="pal-pop__pick">
          <span className="pal-pop__label">빛깔</span>
          <div className="pal-pop__chips">
            {PALETTES.map((x) => {
              const t = swatchOf(x, shownStep.dark);
              return (
                <button
                  key={x.key}
                  type="button"
                  className={`pal-pop__chip${x.key === shown ? " on" : ""}`}
                  style={{
                    background: `linear-gradient(90deg, ${t.primary} 0 33.34%, ${t.success} 33.34% 66.67%, ${t.danger} 66.67% 100%)`,
                  }}
                  aria-pressed={x.key === shown}
                  onClick={() => setShown(x.key)}
                >
                  <span className="pal-pop__chip-name">{x.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 어느 화면인지는 그림 위에 딱지로 둔다. 아래 순서 점과 한 줄에 두면
            이름 길이가 바뀔 때마다 점이 좌우로 흔들린다. */}
        <div className="pal-pop__now">
          <span className="pal-pop__tag">{SHOTS[at].label}</span>
        </div>

        <div className="pal-pop__stage">
          <button
            type="button"
            className="pal-pop__arrow"
            aria-label="앞 화면"
            onClick={() => 넘기기(-1)}
          >
            ‹
          </button>
          <div
            className="pal-pop__frame"
            ref={창}
            onPointerDown={누름}
            onPointerMove={움직임}
            onPointerUp={놓음}
            onPointerCancel={놓음}
          >
            <img
              className={`pal-pop__shot${미끄러짐 ? " sliding" : ""}`}
              style={{ transform: `translateX(${민거리}px)` }}
              src={`/palette/${p.key}_${SHOTS[at].file}${꼬리}.webp`}
              alt={`${p.label} 빛깔의 ${SHOTS[at].label} 화면`}
              draggable={false}
            />
          </div>
          <button
            type="button"
            className="pal-pop__arrow"
            aria-label="다음 화면"
            onClick={() => 넘기기(1)}
          >
            ›
          </button>
        </div>

        <div className="pal-pop__dots" aria-hidden="true">
          {SHOTS.map((s, i) => (
            <i key={s.file} className={i === at ? "on" : ""} />
          ))}
        </div>

        {/* 밝기는 예시 아래다. 바탕을 고치는 일이라, 바뀐 바탕을 눈으로 본
            뒤에 다음 칸으로 넘어가는 차례가 손에 맞는다. */}
        <div className="pal-pop__pick">
          <span className="pal-pop__label">배경 밝기</span>
          <div className="pal-pop__chips">
            {STEPS.map((x) => (
              <button
                key={x.key}
                type="button"
                className={`pal-pop__chip pal-pop__chip--step${
                  x.key === shownStep.key ? " on" : ""
                }`}
                style={{
                  background: `linear-gradient(180deg, ${x.surface} 0 52%, ${x.bg} 52% 100%)`,
                }}
                aria-pressed={x.key === shownStep.key}
                aria-label={x.label}
                title={x.label}
                onClick={() => setShownStep(x)}
              />
            ))}
          </div>
        </div>

        <div className="pal-pop__foot">
          <button type="button" onClick={onClose}>
            닫기
          </button>
          <button
            type="button"
            className="go"
            disabled={shown === value && shownStep.key === step.key}
            onClick={() => {
              onPick(shown);
              onPickStep(shownStep);
              onClose();
            }}
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
