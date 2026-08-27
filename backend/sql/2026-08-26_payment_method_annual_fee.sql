-- 카드 연회비.
--
-- 실적 구간과 달리 카드 한 장에 하나뿐이라 payment_methods 에 칸으로 둔다.
-- 연회비가 없는 결제 수단이 대부분이므로 비울 수 있다.

ALTER TABLE life_expense.payment_methods
    ADD COLUMN IF NOT EXISTS annual_fee numeric(14,2);
