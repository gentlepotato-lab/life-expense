import { useCallback, useState } from "react";

/**
 * 긴 표의 나머지를 펼치고 접는 자리.
 *
 * 쥐는 것은 둘이다. 지금 펼쳐 있는 묶음과, 한 번이라도 펼친 적이 있는
 * 묶음이다.
 *
 * 둘로 나눈 까닭은 스르륵 접히게 하려면 줄이 화면에 남아 있어야 하기
 * 때문이다. 접을 때 줄을 걷어 버리면 그 자리에서 한 번에 사라진다. 그렇다고
 * 처음부터 삼백 줄을 모두 세우면 쪽이 뜨는 데 그만큼 걸린다.
 *
 * 그래서 한 번 펼치기 전에는 앞 몇 줄만 세우고, 한 번 펼친 뒤로는 모두
 * 세운 채 접었다 폈다 한다. 열어 본 묶음만 그 값을 치른다.
 */
export default function useAdminFold() {
  const [편것, set편것] = useState<Set<string>>(new Set());
  const [담긴것, set담긴것] = useState<Set<string>>(new Set());

  /** 지금 펼쳐 있나. */
  const 폈나 = useCallback((열쇠: string) => 편것.has(열쇠), [편것]);

  /** 줄을 모두 세운 묶음인가. 한 번이라도 펼친 적이 있으면 그렇다. */
  const 담겼나 = useCallback((열쇠: string) => 담긴것.has(열쇠), [담긴것]);

  /**
   * 펼치거나 접는다.
   *
   * 처음 펼칠 때는 줄을 접힌 채로 한 번 그린 뒤에 편다. 세우자마자 펴면
   * 그 자리에서 펼쳐진 채로 나타나, 열 때만 스르륵이 빠진다. 틀을 두 번
   * 건너뛰는 까닭은 한 번만으로는 브라우저가 접힌 모습을 아직 그리지 않은
   * 때가 있어서다.
   */
  const 바꾸기 = useCallback(
    (열쇠: string) => {
      if (!담긴것.has(열쇠)) {
        set담긴것((v) => new Set(v).add(열쇠));
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            set편것((v) => new Set(v).add(열쇠));
          });
        });
        return;
      }
      set편것((v) => {
        const 다음 = new Set(v);
        if (다음.has(열쇠)) 다음.delete(열쇠);
        else 다음.add(열쇠);
        return 다음;
      });
    },
    [담긴것]
  );

  return { 폈나, 담겼나, 바꾸기 };
}
