-- 목표에 곁들이는 한마디.
--
-- 왜 이 목표를 걸었는지는 금액만 봐서는 남지 않는다. 카드 혜택의 memo 와
-- 같은 자리, 같은 길이다.
--
-- 이미 걸어 둔 목표가 있을 수 있으므로 칸만 더한다.

ALTER TABLE life_expense.category_goals
    ADD COLUMN IF NOT EXISTS memo varchar(200);
