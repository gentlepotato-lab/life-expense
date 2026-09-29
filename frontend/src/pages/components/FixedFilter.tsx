import { useEffect, useRef, useState } from "react";
import { PinIcon, WaveIcon } from "./FixedIcons";
import type { FixedPick } from "../../utils/calendarFilter";

/**
 * 고정 · 변동 고르개 — 지출·대기·정기 알약과 한 줄에 서는 드롭다운.
 *
 * 넷(고정 지출 · 변동 지출 · 고정 수입 · 변동 수입)을 알약으로 늘어놓으면
 * 손전화 가로를 넘는다. 그래서 알약 하나로 접어 두고 눌러서 펼친다.
 *
 * 펼친 판은 IN/OUT으로 묶는다. 앱이 이미 쓰는 딱지(`OUT(−)` 붉은,
 * `IN(+)` 초록)를 그대로 써서, 어느 쪽 돈을 말하는지 글을 읽지 않아도 알게
 * 한다. 씀씀이는 나간 돈만 그리므로 수입 묶음을 주지 않는다.
 *
 * 들어올 때는 넷 다 켜져 있고 담아 두지 않는다 — 화면을 옮기면 다시 넷이다.
 */
type Props = {
  value: FixedPick;
  onChange: (next: FixedPick) => void;
  /** 씀씀이처럼 나간 돈만 다루는 화면은 false */
  withIncome?: boolean;
};

const 줄 = [
  { key: "fixOut", inout: "out", fixed: true, label: "고정" },
  { key: "varOut", inout: "out", fixed: false, label: "변동" },
  { key: "fixIn", inout: "in", fixed: true, label: "고정" },
  { key: "varIn", inout: "in", fixed: false, label: "변동" },
] as const;

export default function FixedFilter({ value, onChange, withIncome = true }: Props) {
  const [open, setOpen] = useState(false);
  const 상자 = useRef<HTMLSpanElement>(null);

  /* 판 바깥을 누르면 접는다. 그림 위에서 눌러도 접혀야 하므로 문서에서 듣는다. */
  useEffect(() => {
    if (!open) return;
    const 접기 = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (상자.current && t && 상자.current.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", 접기, true);
    return () => document.removeEventListener("pointerdown", 접기, true);
  }, [open]);

  const 보이는줄 = withIncome ? 줄 : 줄.filter((r) => r.inout === "out");
  const 켠수 = 보이는줄.filter((r) => value[r.key]).length;
  const 다켬 = 켠수 === 보이는줄.length;
  /* 딱지는 늘 붙인다. 다 켜졌을 때만 비워 두면 그 자리가 뭘 말하는 자리인지
     알 수 없어 오히려 빠진 것처럼 보인다. 다 켜졌으면 `all`이다. */
  const 딱지 = 다켬 ? "all" : String(켠수);
  /* 알약이 찼는지는 담긴 것이 있는지로 가른다 — 하나도 안 켜면 점선에 빈
     알약이고, 하나라도 켜면 찬다. 몇이 켜졌는지는 딱지가 말한다. */
  const 켬 = 켠수 > 0;

  const 묶음 = (kind: "out" | "in") => (
    <div className="fx-pop__group" key={kind}>
      <div className="fx-pop__head">
        <span className={`inout-chip ${kind}`}>{kind === "out" ? "OUT(−)" : "IN(+)"}</span>
        <span className="fx-pop__kind">{kind === "out" ? "지출" : "수입"}</span>
      </div>
      {보이는줄
        .filter((r) => r.inout === kind)
        .map((r) => (
          <button
            key={r.key}
            type="button"
            className={`fx-pop__row${value[r.key] ? " on" : ""}`}
            aria-pressed={value[r.key]}
            onClick={() => onChange({ ...value, [r.key]: !value[r.key] })}
          >
            <span className="fx-pop__box" aria-hidden="true">
              {value[r.key] ? "✓" : ""}
            </span>
            {r.fixed ? <PinIcon className="fx-pop__ico" /> : <WaveIcon className="fx-pop__ico" />}
            {r.label}
          </button>
        ))}
    </div>
  );

  return (
    <span className="fx-filter" ref={상자}>
      <button
        type="button"
        className={`cal-source cal-source--fixed${켬 ? " on" : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
        title="고정 · 변동 가운데 무엇을 볼지 고른다."
        onClick={() => setOpen((v) => !v)}
      >
        고정/변동
        <span className="fx-filter__n">{딱지}</span>
        <span className="fx-filter__caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="fx-pop" role="dialog" aria-label="고정 · 변동 고르기">
          {묶음("out")}
          {withIncome && 묶음("in")}
        </div>
      )}
    </span>
  );
}
