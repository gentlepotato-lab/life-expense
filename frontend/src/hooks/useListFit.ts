import { useLayoutEffect, type RefObject } from "react";

/** 팝업에서 목록 말고 들어가는 것들의 키. 짧은 화면에서 판을 가두는 데 쓴다. */
const 겉 = 310;

/** 목록이 가장 길어도 여기까지. 메모가 달린 두 건이 날짜도 서로 다를 때가
    가장 커서 348px이 들었다. */
const 끝 = 352;

/**
 * 담긴 만큼만 자리를 쓰되, 한 번 정한 키는 더 자라지 않게 못 박는다.
 *
 * 키를 아예 못 박아 두면 한 건짜리 묶음에서도 판이 그만큼 길어 아래가
 * 휑하다. 그렇다고 담긴 만큼 늘어나게 두면, 안에서 메모를 펼칠 때마다
 * 판이 들썩인다. 열 때 한 번 재서 그 키로 굳히면 둘 다 풀린다 — 뒤에
 * 자라는 것은 목록 안에서 굴러간다.
 */
export default function useListFit(ref: RefObject<HTMLDivElement | null>, 다시: unknown) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* 메모 판이 다 닫힌 뒤에 재야 담긴 만큼이 나온다. 두 가지가 걸린다.

       ① 메모 판은 석 줄 이상이면 두 줄에서 끊는데(MemoPad), 끊을지 말지는
          제 키를 재어 정한다 — 그 판가름은 이 효과가 도는 판의 다음 판에
          들어오므로, 여기서 바로 재면 아직 끊기지 않은 키가 잡힌다.
       ② 끊김은 240ms에 걸쳐 닫힌다. 다음 판에 재더라도 그 사이 키가 잡힌다.

       그래서 한 판 뒤에, 움직임을 끈 채로 잰다. 메모 둘짜리 묶음에서 목록이
       536px로 읽히던 것이 이 둘을 모두 걷으면 296px이다. 그만큼 아래가 비어
       [내역 추가]가 목록에서 동떨어져 보였다. 판이 뜨는 첫 판이라 메모가
       닫히는 모습을 보여 줄 자리도 아니다. */
    const 틀 = requestAnimationFrame(() => {
      el.classList.add("is-measuring");
      /* 먼저 풀어 두고 재야 담긴 만큼이 나온다. */
      el.style.height = "auto";
      const 한계 = Math.min(끝, window.innerHeight - 겉);
      el.style.height = `${Math.min(el.scrollHeight, Math.max(한계, 0))}px`;
      el.classList.remove("is-measuring");
    });
    return () => cancelAnimationFrame(틀);
  }, [ref, 다시]);
}
