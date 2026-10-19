-- 2026-10-09_goal_start_ym.sql 되돌리기.
--
-- 칸을 지우면 어느 달부터 센 목표인지가 사라진다. 되돌린 뒤에는 모든 달이
-- 지금 금액으로 매겨지므로, 달을 거슬러 보는 화면도 함께 걷어야 한다.

ALTER TABLE life_expense.category_goals
    DROP CONSTRAINT IF EXISTS category_goals_start_ym_chk;

ALTER TABLE life_expense.category_goals
    DROP COLUMN IF EXISTS start_ym;
