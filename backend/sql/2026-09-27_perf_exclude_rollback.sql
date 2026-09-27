-- 2026-09-27_perf_exclude.sql 되돌리기.
-- 칸을 지우면 표시해 둔 건도 함께 사라진다.
ALTER TABLE life_expense.entries           DROP COLUMN IF EXISTS perf_exclude;
ALTER TABLE life_expense.pending_entries   DROP COLUMN IF EXISTS perf_exclude;
ALTER TABLE life_expense.scheduled_entries DROP COLUMN IF EXISTS perf_exclude;
