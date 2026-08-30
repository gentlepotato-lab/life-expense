-- 혜택 하나의 월간 통합 할인한도.
--
-- 카드사는 "5개 영역 통틀어 월 1만 원까지"처럼 한도를 걸어 둔다. 상세 글에
-- 섞어 적으면 셈에 쓸 수가 없어 금액으로 따로 받는다.
-- 한도가 없는 혜택도 있으므로 비울 수 있다.
--
-- 이미 적어 둔 것이 있어 표를 다시 만들지 않고 칸만 더한다.

ALTER TABLE life_expense.card_benefits
    ADD COLUMN IF NOT EXISTS limit_amount numeric(14,2);
