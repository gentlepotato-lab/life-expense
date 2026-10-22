import axios from "../api/client";

/**
 * 고른 것을 하나씩 지운다.
 *
 * 서버에 여럿을 한 번에 지우는 길이 없다. 새로 뚫는 대신 있는 길을 차례로
 * 호출한다 — 지우는 길마다 딸린 것을 함께 정리하는 셈이 이미 들어 있어,
 * 한 번에 지우는 길을 새로 만들면 그 셈을 두 벌로 들고 있어야 한다.
 *
 * 하나가 실패해도 멈추지 않는다. 중간에 멎으면 어디까지 지워졌는지 알 수
 * 없어, 다시 눌러야 할지 말아야 할지 사람이 판단할 수 없다. 끝까지 해 보고
 * 몇이 됐고 몇이 안 됐는지 돌려준다.
 */
export async function 골라제거(
  길: string,
  열쇠들: (number | string)[]
): Promise<{ 성공: number; 실패: number }> {
  let 성공 = 0;
  let 실패 = 0;
  for (const 열쇠 of 열쇠들) {
    try {
      await axios.delete(`${길}/${열쇠}`);
      성공 += 1;
    } catch {
      실패 += 1;
    }
  }
  return { 성공, 실패 };
}

export default 골라제거;
