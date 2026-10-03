/**
 * 건너뛰기를 켰는지 껐는지 말하는 그림 둘.
 *
 * 전구다. 빛살이 뻗은 전구는 이번 한 번을 건너뛴다는 뜻이고, 빛살이 없는
 * 전구는 그대로 온다는 뜻이다. 글자(`켬`·`끔`)를 쓰지 않는 까닭은 이 자리가
 * 분류 화면의 고정 · 변동 스위치와 같은 꼴이어야 하기 때문이다 — 같은 모양의
 * 스위치가 한 곳에서는 그림, 다른 곳에서는 글자면 같은 것으로 읽히지 않는다.
 * 돈쓴이의 켬·끔도 같은 까닭으로 이 그림을 쓴다(index.css 159절).
 *
 * 유리를 채우는 것으로 켜짐을 말하지 않는다. 고른 쪽은 스위치가 이미 바탕을
 * 깔아 알리므로, 채움으로 또 말하면 둘이 싸운다 — 안 고른 쪽 전구가 꽉 차
 * 있으면 그쪽이 켜진 것처럼 읽힌다. 두 유리를 똑같이 비워 두고 빛살만
 * 여닫는다. 굵기와 마감은 앱의 다른 선 그림과 같게 2px 둥근 끝이다.
 */

/** 유리와 소켓. 두 그림이 같은 자리에 같은 크기로 서야 눌렀을 때 안 흔들린다. */
const GLASS = "M12 5.2a4.4 4.4 0 0 0-2.5 8v1.6h5V13.2a4.4 4.4 0 0 0-2.5-8z";
const SOCKET = "M10.2 17.4h3.6";

function Bulb({ className, lit }: { className?: string; lit: boolean }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={GLASS} />
      <path d={SOCKET} />
      {/* 빛살 셋 — 위와 위 양옆. 유리에서 한 칸 떨어뜨려 엉키지 않게 한다. */}
      {lit && <path d="M12 1.4v2M4.4 4.6l1.5 1.5M19.6 4.6l-1.5 1.5" />}
    </svg>
  );
}

export function BulbOnIcon({ className }: { className?: string }) {
  return <Bulb className={className} lit />;
}

export function BulbOffIcon({ className }: { className?: string }) {
  return <Bulb className={className} lit={false} />;
}
