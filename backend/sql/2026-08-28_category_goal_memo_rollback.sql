-- 2026-08-28_category_goal_memo.sql 되돌리기.

ALTER TABLE life_expense.category_goals
    DROP COLUMN IF EXISTS memo;
