import { useEffect, useRef, useState } from "react";
import useBackClose from "../../hooks/useBackClose";
import useAnchoredPanel from "../../hooks/useAnchoredPanel";
import { hour12 } from "../../utils/day";

/** 칸 하나의 높이. CSS의 .tp-item 높이와 반드시 같아야 한다. */
const 칸높이 = 34;

/**
 * 다이얼 한 줄. 굴려서 가운데 띠에 세운 것이 고른 것이다.
 *
 * 줄마다 훅을 하나씩 걸어야 하므로 부품으로 뗀다. map() 안에서는 훅을 부를 수
 * 없다. 이름을 영어로 적는 것은 한글 이름이면 react-hooks 규칙이 부품으로
 * 알아보지 못하기 때문이다.
 */
function Wheel({
  items,
  index,
  onIndex,
  label,
}: {
  items: string[];
  /** 지금 가운데에 선 칸. 고른 것이 없으면 -1이 아니라 앉힐 자리를 준다. */
  index: number;
  onIndex: (i: number) => void;
  /** 읽어 주는 이름. 무엇을 고르는 줄인지 알린다. */
  label: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const 처음 = useRef(index);
  /* 뜰 때 자리를 잡는 동안에는 굴림을 듣지 않는다. scrollTop을 손으로 밀면
     굴림 울림이 함께 나는데, 그것을 사람이 굴린 것으로 알면 아직 비어 있는
     칸에 값이 저 혼자 적힌다. */
  const 세우는중 = useRef(true);
  const 쉼 = useRef<number | undefined>(undefined);

  /* 뜰 때 고른 칸을 가운데에 세운다. 판은 닫히면 없어지므로 한 번이면 된다.
     굴리는 중에 다시 세우면 손가락과 싸운다. */
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 처음.current * 칸높이;
    const t = window.setTimeout(() => {
      세우는중.current = false;
    }, 220);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => () => window.clearTimeout(쉼.current), []);

  /* 손이 멈춘 다음에 센다. 굴리는 동안 칸마다 적으면 중간에 스친 시각이
     그때마다 값이 된다. */
  const 멈추면 = () => {
    const el = ref.current;
    if (!el || 세우는중.current) return;
    window.clearTimeout(쉼.current);
    쉼.current = window.setTimeout(() => {
      if (!ref.current) return;
      const i = Math.round(ref.current.scrollTop / 칸높이);
      onIndex(Math.max(0, Math.min(items.length - 1, i)));
    }, 110);
  };

  return (
    <div
      className="tp-wheel"
      ref={ref}
      onScroll={멈추면}
      role="listbox"
      aria-label={label}
    >
      {items.map((글, i) => (
        <button
          type="button"
          key={글}
          className={`tp-item${i === index ? " on" : ""}`}
          role="option"
          aria-selected={i === index}
          /* 굴리지 않고 바로 눌러도 되게 둔다. 눌린 칸을 가운데로 데려오면
             손이 굴려 세운 것과 끝 모습이 같다. */
          onClick={() => {
            /* 움직임을 줄여 달라고 한 손님에게는 끌지 않고 바로 세운다.
               CSS의 scroll-behavior는 여기서 짚은 smooth에 지므로 여기서 본다
               (hooks/usePeel.ts도 같은 잣대를 쓴다). */
            const 끌기 = window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? ("auto" as const)
              : ("smooth" as const);
            ref.current?.scrollTo({ top: i * 칸높이, behavior: 끌기 });
            onIndex(i);
          }}
        >
          {글}
        </button>
      ))}
    </div>
  );
}

/**
 * 시각 하나를 고르는 다이얼.
 *
 * 브라우저가 주는 시간 칸(input[type=time])을 대신한다. 그 칸은 기기마다
 * 생김새가 다르고, 크롬과 엣지에서는 a.m.과 p.m.을 자판으로만 바꾼다. a나 p를
 * 쳐야 넘어가는데 웹 앱에는 자판이 없어, 그 자리를 비운 채로 둘 수밖에
 * 없었다. 날짜와 연월을 앱의 것(DayPicker, MonthPicker)으로 바꾼 것과 같은
 * 까닭이고 같은 자리다.
 *
 * 값은 건드리지 않는다. 들고 나는 것 모두 24시간제 "HH:MM"이다. 화면에 적을
 * 때만 12시간제로 돌린다(utils/day.ts의 hour12). 정기 내역 카드와 배치 카드가
 * 쓰는 것과 같은 꼴이다.
 *
 * 방아쇠는 다른 선택기(SingleSelect, DayPicker)의 것을 그대로 쓴다. 한 줄에
 * 나란히 서는 칸들이라 눌리기 전 모습이 다르면 줄이 어긋나 보인다.
 */
export default function TimePicker({
  value,
  onChange,
  /** 분을 몇 분씩 끊어 보일지. 정기 내역은 5분, 관리자 배치는 1분이다. */
  step = 5,
  placeholder = "(시간)",
}: {
  value: string;
  onChange: (hhmm: string) => void;
  step?: number;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  /* 뒤로 가기는 떠 있는 이 판만 닫는다. 화면을 떠나면 안 된다.
     Backspace는 받지 않는다. 이 판 옆에는 글자를 지우는 칸이 흔하다. */
  useBackClose(open, () => setOpen(false), false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const style = useAnchoredPanel(open, wrapRef, { minWidth: 236, maxHeight: 320 });

  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("touchstart", outside);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("touchstart", outside);
    };
  }, [open]);

  /* 지금 들고 있는 값. 아직 아무것도 고르지 않았으면 자정에서 센다. 세 줄
     가운데 어느 것을 굴려도 온전한 시각이 나와야 하기 때문이다. */
  const 꼴 = /^(\d{1,2}):(\d{2})/.exec(value || "");
  const 골랐나 = 꼴 !== null;
  const 시각 = 꼴 ? Number(꼴[1]) : 0;
  const 분각 = 꼴 ? Number(꼴[2]) : 0;
  const 뒤인가 = 시각 >= 12;
  /* 0시는 12 a.m., 12시는 12 p.m.이다. 0으로 적는 시계는 없다(hour12와 같다). */
  const 열두시 = 시각 % 12 === 0 ? 12 : 시각 % 12;

  /** 12시간 시계의 시와 a.m./p.m.을 24시간 시로 돌린다. */
  const 스물넷 = (시: number, 뒤: boolean) => (시 % 12) + (뒤 ? 12 : 0);

  const 적기 = (시: number, 분: number) =>
    onChange(`${String(시).padStart(2, "0")}:${String(분).padStart(2, "0")}`);

  /* 시계가 도는 차례대로 둔다. 12부터 세야 자정과 정오가 맨 앞에 선다. */
  const 시들 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const 분들: number[] = [];
  for (let i = 0; i < 60; i += Math.max(1, step)) 분들.push(i);

  /* 분이 끊는 자리에 떨어지지 않는 값도 있다(1분씩 끊던 것을 5분으로 바꾼
     자리). 그때는 가장 가까운 칸에 세운다. */
  const 분자리 = Math.max(
    0,
    분들.findIndex((분) => 분 >= 분각) === -1 ? 분들.length - 1 : 분들.findIndex((분) => 분 >= 분각)
  );

  return (
    <div className="ms-wrap tp-wrap" ref={wrapRef}>
      {/* button이 아니라 div인 것은 전역 button 규칙(min-height 등)이 걸려
          모양이 달라지기 때문이다. 대신 역할과 키 조작을 손으로 붙인다. */}
      <div
        className="ms-display"
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          } else if (e.key === "Escape" && open) {
            setOpen(false);
          }
        }}
      >
        {골랐나 ? (
          <span className="ms-value">{hour12(value)}</span>
        ) : (
          <span className="ms-placeholder">{placeholder}</span>
        )}
      </div>

      {open && (
        <div className={`ms-dropdown tp-panel${골랐나 ? "" : " tp-panel--empty"}`} style={style}>
          {/* 가운데 띠. 여기에 선 것이 고른 것이다. 굴림을 가로막지 않는다. */}
          <div className="tp-dial">
            <span className="tp-dial__band" aria-hidden="true" />
            <Wheel
              label="시"
              items={시들.map(String)}
              index={시들.indexOf(열두시)}
              onIndex={(i) => 적기(스물넷(시들[i], 뒤인가), 분각)}
            />
            <Wheel
              label="분"
              items={분들.map((분) => String(분).padStart(2, "0"))}
              index={분자리}
              onIndex={(i) => 적기(시각, 분들[i])}
            />
            <Wheel
              label="오전 오후"
              items={["a.m.", "p.m."]}
              index={뒤인가 ? 1 : 0}
              onIndex={(i) => 적기(스물넷(열두시, i === 1), 분각)}
            />
          </div>

          {/* 줄을 긋고 아래에 따로 둔다. 날짜 선택기의 [오늘]과 같은 자리,
              같은 꼴이다. 이것 하나로 세 줄이 한꺼번에 서므로 바로 닫는다. */}
          <div className="tp-foot">
            <button
              type="button"
              className="tp-foot__btn"
              onClick={() => {
                const 이제 = new Date();
                const 끊기 = Math.max(1, step);
                적기(이제.getHours(), Math.floor(이제.getMinutes() / 끊기) * 끊기);
                setOpen(false);
              }}
            >
              지금
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
