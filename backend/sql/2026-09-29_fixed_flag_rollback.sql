-- 2026-09-29_fixed_flag.sql 되돌리기.
-- 칸을 지우면 갈래마다 정해 둔 고정 · 변동과 건마다 손댄 것이 함께 사라진다.
ALTER TABLE life_expense.categories_lvl2   DROP COLUMN IF EXISTS fixed_flag;
ALTER TABLE life_expense.categories_lvl3   DROP COLUMN IF EXISTS fixed_flag;
ALTER TABLE life_expense.entries           DROP COLUMN IF EXISTS fixed_flag;
ALTER TABLE life_expense.pending_entries   DROP COLUMN IF EXISTS fixed_flag;
ALTER TABLE life_expense.scheduled_entries DROP COLUMN IF EXISTS fixed_flag;
