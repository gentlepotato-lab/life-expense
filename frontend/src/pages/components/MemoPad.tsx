import { useLayoutEffect, useRef, useState } from "react";
import { prefOn } from "../../utils/prefs";
import CollapseToggle from "./CollapseToggle";

/**
 * 내역 카드 아래에 붙는 메모 판.
 *
 * 메모는 원래 카드 안 셋째 줄이었다. 길어지면 카드가 그만큼 뚱뚱해지고,
 * 같은 줄 오른쪽 끝의 결제 수단이 첫 줄로 밀려 올라가 혼자 떠 보였다.
 * 카드에서 빼내 바로 아래 제 판에 담으면 카드 키가 늘 같고, 메모는 메모끼리
 * 한 구역으로 읽힌다.
 *
 * 판은 카드 안쪽에 떠 있고, 돌려받음 칸(.split-tab)은 카드 끝에 붙는다 —
 * 둘이 함께 있어도 서로 겹칠 자리가 없다. 판이 먼저, 돌려받음이 뒤다.
 *
 * 보일지 말지는 돈쓴이의 `내역에 메모 보이기`가 정한다. 끄면 이 판이 아예
 * 서지 않고, 메모는 꾹 눌러 뜨는 편집 팝업에서 본다.
 *
 * 석 줄 이상이면 두 줄에서 끊는다. 목록을 훑을 때 카드 키가 들쭉날쭉해지지
 * 않게 하려는 것이다 — 두 줄까지는 그대로 다 보인다.
 *
 * 펼치는 손잡이는 이 판의 접기 손잡이(CollapseToggle)를 그대로 쓰고, 끊긴
 * 끝의 (...) 와 **같은 줄** 오른쪽에 둔다. 제 줄을 통째로 차지하면 두 줄을
 * 보이려고 세 줄만큼 자리를 쓰는 셈이 된다.
 */

/** 두 줄에 해당하는 키. CSS의 --memo-two 와 같아야 한다. */
const TWO_LINES = 40;

export default function MemoPad({ memo }: { memo: string | null | undefined }) {
  const text = (memo ?? "").trim();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  /* 석 줄 이상인가 — 끊지 않은 채로 재서 정한다. */
  const [long, setLong] = useState(false);
  const [open, setOpen] = useState(false);

  /* 그리자마자 재야 한 번도 들썩이지 않는다(useEffect는 한 판 늦다).
     글이나 폭이 바뀌면 다시 잰다 — 폭은 화면을 돌릴 때 달라진다. */
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setLong(el.scrollHeight > TWO_LINES + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  if (!text || !prefOn("memo_show")) return null;

  const cut = long && !open;

  return (
    /* 손잡이가 붙는 판은 오른쪽에 그만큼 자리를 비워 둔다 — 글과 손잡이가
       겹치지 않게. 손잡이가 없는 판은 폭을 한 치도 내주지 않는다. */
    <div className={`memo-pad${long ? " has-more" : ""}`}>
      <div className="memo-cut">
        <div ref={bodyRef} className={`memo-body${cut ? " is-cut" : ""}`}>
          {text}
        </div>
        {/* 끊긴 끝 — 뒤쪽을 길게 걸쳐 옅어지다 (...) 로 이어진다. 짧게 덮으면
            끝이 딱 떨어져 테이프를 붙여 놓은 것처럼 보인다. */}
        {cut && (
          <span className="memo-fade" aria-hidden="true">
            (...)
          </span>
        )}
      </div>

      {long && (
        <CollapseToggle open={open} onToggle={() => setOpen((v) => !v)} label="메모" />
      )}
    </div>
  );
}
