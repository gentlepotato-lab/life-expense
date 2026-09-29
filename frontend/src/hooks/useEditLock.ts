import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * 편집이 아닐 때 고칠 수 있는 자리를 누르면 왜 안 되는지 알려 준다.
 *
 * 조각이 옅어진 것만으로는 "지금은 못 고친다"가 읽히지 않는다. 눌러 보고 아무
 * 일도 일어나지 않으면 고장으로 오해한다. 그래서 누름을 받아 그 자리에 한 줄
 * 띄운다.
 *
 * 안내는 줄에 매달지 않고 누른 그 자리에 띄운다 — 줄에 매달면 줄이 길수록
 * 엉뚱한 곳에 떠서 무엇을 눌렀는지가 흐려진다.
 *
 * 돈쓴이에서 쓰던 것을 그대로 꺼내 왔다. 편집 모드를 둔 화면이 여럿이라
 * 화면마다 따로 만들면 같은 말이 화면마다 다르게 뜬다.
 */

/** 안내가 떠 있는 자리. n은 다시 띄울 때마다 오르는 번호다. */
export type LockAt = { x: number; y: number; n: number } | null;

/** 안내가 떠 있는 시간(ms). 꾸밈의 animation과 같은 값을 써야 한다. */
const 머무는시간 = 2200;

export default function useEditLock(editMode: boolean) {
  const [lockAt, setLockAt] = useState<LockAt>(null);
  const timer = useRef<number | null>(null);
  const seq = useRef(0);
  const tipRef = useRef<HTMLSpanElement>(null);

  const showLock = useCallback((e: React.MouseEvent<HTMLElement>) => {
    /* 키보드로 눌렀을 때는 좌표가 0으로 오므로 단추 한가운데를 쓴다. */
    const r = e.currentTarget.getBoundingClientRect();
    /* 누를 때마다 번호를 올려 key로 쓴다. 같은 요소를 다시 쓰면 뜨고 지는
       움직임이 처음부터 돌지 않아, 한 번 다 돈 뒤로는 투명한 채로 남는다.
       그 사이에 또 누르면 사라지는 시계마저 미뤄져 영영 안 보이게 된다. */
    seq.current += 1;
    setLockAt({
      x: e.clientX || r.left + r.width / 2,
      y: e.clientY || r.top + r.height / 2,
      n: seq.current,
    });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLockAt(null), 머무는시간);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  /* 편집으로 들어가면 안내는 할 말을 잃는다 — 띄워 둔 채 들어가면 이제 고칠
     수 있는데도 못 고친다는 말이 남는다. */
  useEffect(() => {
    if (editMode) setLockAt(null);
  }, [editMode]);

  /* 화면 밖으로 나가지 않게 민다. 그리기 전에 재야 해서 layout 쪽에 건다. */
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el || !lockAt) return;
    const 여백 = 8;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.min(
      Math.max(lockAt.x, 여백 + w / 2),
      window.innerWidth - 여백 - w / 2
    );
    /* 누른 자리 바로 위. 위가 좁으면 아래로 돌리고, 그래도 넘치면 민다.
       top은 안내의 아랫변이다(transform이 -100%라서). */
    const 위 = lockAt.y - 12;
    const 돌림 = 위 - h < 여백 ? lockAt.y + 12 + h : 위;
    const top = Math.min(Math.max(돌림, 여백 + h), window.innerHeight - 여백);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [lockAt]);

  return { lockAt, showLock, tipRef, editMode };
}
