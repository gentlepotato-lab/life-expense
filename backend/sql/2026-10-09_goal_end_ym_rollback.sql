-- 2026-10-09_goal_end_ym.sql 되돌리기.
--
-- 칸을 지우면 그만둔 도전이 다시 영영 걸린 것이 된다. 되돌린 뒤에는
-- 종료 연월을 고르는 자리도 함께 걷어야 한다.

ALTER TABLE life_expense.category_goals
    DROP CONSTRAINT IF EXISTS category_goals_ym_order_chk;

ALTER TABLE life_expense.category_goals
    DROP CONSTRAINT IF EXISTS category_goals_end_ym_chk;

ALTER TABLE life_expense.category_goals
    DROP COLUMN IF EXISTS end_ym;
