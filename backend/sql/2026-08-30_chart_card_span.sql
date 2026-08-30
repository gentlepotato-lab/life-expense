-- 그림 카드가 한 줄에서 몇 칸을 쓰는지.
--
-- 1이면 반 칸(넓은 화면에서 둘이 나란히), 2면 한 줄을 다 쓴다. 좁은 화면은
-- 어차피 한 줄에 하나씩이라 이 값과 상관없이 쭉 늘어선다.
--
-- 어느 그림이 넓은지가 코드에 박혀 있던 것을 사람이 정할 수 있게 옮긴다.

ALTER TABLE life_expense.chart_cards
    ADD COLUMN IF NOT EXISTS span smallint NOT NULL DEFAULT 1;
