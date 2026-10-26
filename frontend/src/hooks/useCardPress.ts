import { useEffect } from "react";

/**
 * 칸을 누르는 동안 표를 붙인다.
 *
 * 칸이 눌린 티를 내는 일은 본디 `:active`가 맡았다(40절). 그런데 그 상태는
 * 브라우저가 쥐고 있어서, 누른 자리의 칸이 사라지고 그 자리에 새 칸이 들어서면
 * 새 칸에 그대로 걸린 채로 남는다. 관리자 사이트에 들어갈 때가 그랬다.
 * 비밀번호 칸을 눌렀던 412px 화면의 118px 자리에, 들어간 뒤 대시보드 칸이
 * 서면서(92..256px) 그 칸이 눌린 채로 굳었다. 손가락은 마우스처럼 자리를
 * 떠나지 못하므로 다른 데를 한 번 더 짚어야 풀렸다.
 *
 * 머무름(:hover)은 「손가락 기기에서는 그 결을 끄기」로 풀 수 있지만(188절),
 * 누름은 그럴 수 없다. 끄면 손가락으로 누를 때 아무 반응이 없어진다.
 *
 * 그래서 브라우저가 쥔 상태를 쓰지 않고 우리가 붙였다 뗀다. 새로 그려진 칸에는
 * 표가 없으므로 굳을 자리가 없다.
 *
 * 칸마다 거는 대신 몸통에서 한 번만 듣는다. 칸은 네 곳에서 그려지고
 * (Home.tsx, MenuList.tsx, AdminTabUse.tsx, AdminMenuList.tsx) 모두 map 안이라,
 * 조각마다 훅을 걸려면 네 곳을 다 부품으로 떼어야 한다.
 *
 * 떼는 자리가 여럿인 까닭:
 *   pointerup     손을 뗀다.
 *   pointercancel 굴리기 시작하면 브라우저가 누름을 거둔다.
 *   scroll        거두지 않는 브라우저를 위해 한 겹 더 둔다.
 *   blur          누른 채로 앱을 떠났다 돌아오는 자리.
 */
export default function useCardPress() {
  useEffect(() => {
    const 떼기 = () => {
      document
        .querySelectorAll(".home-card.is-pressed")
        .forEach((el) => el.classList.remove("is-pressed"));
    };

    const 붙이기 = (e: PointerEvent) => {
      떼기();
      const 집은것 = e.target;
      if (!(집은것 instanceof Element)) return;
      집은것.closest(".home-card")?.classList.add("is-pressed");
    };

    /* 캡처로 듣는다. 칸 안의 글이나 그림이 눌려도 같은 자리에서 잡힌다. */
    document.addEventListener("pointerdown", 붙이기, true);
    document.addEventListener("pointerup", 떼기, true);
    document.addEventListener("pointercancel", 떼기, true);
    window.addEventListener("scroll", 떼기, true);
    window.addEventListener("blur", 떼기);
    return () => {
      document.removeEventListener("pointerdown", 붙이기, true);
      document.removeEventListener("pointerup", 떼기, true);
      document.removeEventListener("pointercancel", 떼기, true);
      window.removeEventListener("scroll", 떼기, true);
      window.removeEventListener("blur", 떼기);
    };
  }, []);
}
