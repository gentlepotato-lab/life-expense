import { useEffect } from "react";

/**
 * 떠 있는 판이 열려 있는 동안 뒤쪽이 구르지 않게 잠근다.
 *
 * 판을 열어 둔 채 화면을 쓸면 뒤 글이 따라 움직여, 판이 떠 있는 것이 아니라
 * 같이 흘러가는 것처럼 보였다. 판을 닫고 나면 보던 자리도 달라져 있다.
 *
 * 부르는 곳은 관리자 화면의 판들뿐이다. 사용자 화면의 판들은 예부터 이대로
 * 돌고 있어 손대지 않는다 — 한꺼번에 바꾸면 거기 쌓인 손놀림까지 달라진다.
 *
 * 구르는 것은 body가 아니라 html이다. body에만 overflow를 걸었더니 손으로
 * 쓸 때 뒤쪽이 그대로 굴렀다. 둘 다 걸어야 멈춘다.
 *
 * 구르개가 사라지며 글이 옆으로 밀리지 않도록, 사라진 폭만큼 오른쪽에
 * 여백을 둔다. 손전화는 구르개가 글 위에 떠 그 폭이 0이라 아무 일도
 * 일어나지 않는다.
 *
 * 구르개가 사라지며 글이 옆으로 흔들리던 것은 여백으로 메우지 않는다.
 * body에 여백을 주면 그 안쪽이 좁아져 되레 8px 밀렸고, html에 주어도
 * 마찬가지였다. 대신 구르개가 섰던 자리를 그대로 비워 둔다
 * (scrollbar-gutter: stable). overflow를 hidden으로 바꾸어도 그 자리는
 * 남으므로, 잠그기 전과 후의 안쪽 폭이 한 픽셀도 다르지 않다.
 */
export default function useScrollLock(열렸나: boolean): void {
  useEffect(() => {
    if (!열렸나) return;
    const 뿌리 = document.documentElement;
    const 몸 = document.body;
    const 전 = {
      뿌리넘침: 뿌리.style.overflow,
      뿌리자리: 뿌리.style.scrollbarGutter,
      몸넘침: 몸.style.overflow,
    };
    뿌리.style.scrollbarGutter = "stable";
    뿌리.style.overflow = "hidden";
    몸.style.overflow = "hidden";
    return () => {
      뿌리.style.overflow = 전.뿌리넘침;
      뿌리.style.scrollbarGutter = 전.뿌리자리;
      몸.style.overflow = 전.몸넘침;
    };
  }, [열렸나]);
}
