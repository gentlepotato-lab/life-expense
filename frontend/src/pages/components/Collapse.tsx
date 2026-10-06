import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * 얼마나 열리고 닫히느냐에 따라 걸릴 시간을 달리 잡는다.
 *
 * 모두 한 시간에 맞춰 두었더니, 808px짜리는 가장 빠른 틀에서 89px씩 건너뛰고
 * 32px짜리는 3px씩만 기었다. 카드 한 줄이 86px이니 앞엣것은 한 틀에 한 줄씩
 * 뛰어 아래 내용이 툭툭 밀렸고, 뒤엣것은 그냥 굼떴다. 걸음 폭을 비슷하게
 * 맞춰야 둘 다 고르게 보인다.
 *
 * 180ms 아래로는 내리지 않는다 — 그보다 짧으면 틀이 열 개도 안 되어 곡선을
 * 나눠 가질 자리가 없다. 420ms 위로도 올리지 않는다. 아주 긴 목록까지 비례해
 * 늘리면 접는 데만 1초가 걸려, 고르기 전에 느린 것이 먼저 거슬린다.
 */
function 걸릴시간(키: number) {
  return Math.round(Math.min(420, Math.max(180, 150 + 키 * 0.24)));
}

/**
 * 접고 펴는 동안 키가 미끄러지는 겹.
 *
 * 지금까지는 접으면 안쪽이 통째로 사라지고 펴면 통째로 나타났다. 한 틀에
 * 끝나니 목록이 툭 끊긴다. 키를 0에서 제 키까지 끌어 주면 어디가 접히고
 * 펴지는지가 눈으로 따라온다.
 *
 * 쉬고 있을 때는 상자를 만들지 않는다(display: contents). 겹 하나를 끼우면
 * `.date-group > .card`처럼 바로 아래 자식을 가리키는 규칙이 어긋나는데,
 * 상자가 없으면 안쪽은 지금까지와 똑같은 자리에 선다. 상자는 움직이는
 * 동안에만 생겼다가 끝나면 도로 사라진다. 겹 자체는 늘 같은 자리에 있어
 * 안쪽이 다시 그려지지 않는다.
 *
 * 접은 뒤에는 안쪽을 떼어 낸다. 접어 둔 것까지 계속 그려 두면 긴 목록에서
 * 그만큼 값을 치른다 — 지금까지와 같다.
 *
 * 움직임을 끄면(돈쓴이) 곧바로 접히고 펴진다. 끄는 것은 움직임뿐이고 하는
 * 일은 그대로다(160절).
 */
export default function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  /* 안쪽을 그려 둘지. 접는 동안에는 남겨 두어야 키가 줄어드는 것이 보인다. */
  const [mounted, setMounted] = useState(open);
  /* 움직이는 중인지. 이때만 상자가 생긴다. */
  const [moving, setMoving] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);
  /* 처음 그릴 때는 움직이지 않는다 — 화면을 열자마자 다 펴지는 꼴이 된다. */
  const 처음 = useRef(true);
  const 타이머 = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (타이머.current !== null) window.clearTimeout(타이머.current);
    },
    []
  );

  useLayoutEffect(() => {
    if (처음.current) {
      처음.current = false;
      setMounted(open);
      return;
    }
    if (타이머.current !== null) window.clearTimeout(타이머.current);

    /* 움직임을 껐으면 바로 끝낸 자리에 선다. */
    if (document.documentElement.dataset.motion === "off") {
      setMounted(open);
      setMoving(false);
      return;
    }

    if (open) setMounted(true);
    setMoving(true);
  }, [open]);

  /* 상자가 생긴 뒤라야 키를 잴 수 있다 — display: contents인 동안에는
     잴 것이 없다. 그래서 재는 일은 한 틀 뒤인 여기서 한다. */
  useLayoutEffect(() => {
    if (!moving) return;
    const el = ref.current;
    if (!el) return;

    /* 시작 키를 적고 그 자리에서 한 번 셈하게 한 뒤에 끝 키를 적는다.
       셈하지 않고 바로 끝 키를 적으면 둘이 한 칠에 들어가 끌 것이 없다.
       틀을 미뤄 두는 것으로도 되지만 그만큼(두 틀, 30ms쯤) 가만히 있다가
       움직이기 시작해 머뭇거리는 것처럼 보였다. */
    /* 안쪽이 미끄러지는 일은 CSS의 짜인 움직임(animation)에 맡긴다.
       트랜지션으로 두었더니 걸리지 않았다 — 안쪽은 쉴 때 상자가 없다가
       (display: contents) 움직이는 순간 생기는데, 상자가 없던 자리에서는
       끌어 줄 앞 값이 없기 때문이다. 짜인 움직임은 그 자리에서도 돈다. */
    const 속키 = el.scrollHeight;
    const 길이 = 걸릴시간(속키);
    /* 이번 한 번에만 걸리는 시간. 바깥 겹과 안쪽 겹이 같은 값을 보도록
       CSS 변수로 적는다 — 안쪽은 짜인 움직임이라 따로 적을 자리가 없다. */
    el.style.setProperty("--collapse-run", `${길이}ms`);

    const 끝키 = open ? `${속키}px` : "0px";
    el.style.height = open ? "0px" : `${속키}px`;
    void el.offsetHeight;
    el.style.height = 끝키;

    타이머.current = window.setTimeout(() => {
      /* 끝나면 키를 놓아 준다. 못 박아 두면 안쪽이 자란 만큼(메모 펼치기)
         잘려 보인다. */
      if (ref.current) ref.current.style.height = "";
      setMoving(false);
      if (!open) setMounted(false);
    }, 길이);
  }, [moving, open]);

  if (!mounted) return null;

  /* div가 아니라 span이다. 설정 화면들이 `.cat-group > div`처럼 바로 아래
     div를 통째로 잡는 규칙을 들고 있어, div로 두면 이 겹까지 끌려 들어가
     자리가 틀어진다. span은 그런 규칙을 비켜 간다. */
  return (
    <span
      className={`collapse${moving ? (open ? " is-moving is-opening" : " is-moving is-closing") : ""}`}
      ref={ref}
    >
      {/* 키를 끄는 겹과 미끄러지는 겹을 나눈다. 한 겹에 둘 다 걸면 제 손으로
          잘라 낸 자리를 제가 벗어난다. */}
      <span className="collapse__in">{children}</span>
    </span>
  );
}
