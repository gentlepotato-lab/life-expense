/**
 * 묶음 내역이 거르는 조건.
 *
 * 거르는 것은 셋뿐이다 — 날짜와 이름과 메모. 분류나 결제 수단으로 거르는
 * 것은 내역 세 화면이 이미 맡고 있고, 묶음은 그 안의 건들을 한 덩이로 보는
 * 자리라 덩이 자체를 가리키는 말로 찾는 편이 맞다.
 *
 * 날짜는 담긴 내역의 날로 본다. 그 기간에 든 건이 하나라도 있으면 걸린다.
 */
export type GroupFilter = {
  dateFrom: string;
  dateTo: string;
  name: string;
  memo: string;
};

export const EMPTY_GROUP_FILTER: GroupFilter = {
  dateFrom: "",
  dateTo: "",
  name: "",
  memo: "",
};

/** 하나라도 걸려 있는가. 빈 값이면 걸지 않은 것이다. */
export function hasGroupCondition(f: GroupFilter): boolean {
  return !!(f.dateFrom || f.dateTo || f.name.trim() || f.memo.trim());
}
