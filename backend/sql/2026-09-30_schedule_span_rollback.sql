-- 2026-09-30_schedule_span.sql 되돌리기.
--
-- 다섯 칸을 지우면 격월 · 매년 · 할부로 적어 둔 스케줄은 모두 매월로 돌아간다.
-- 되돌리기 전에 그런 줄이 있는지 먼저 본다.
--
--   SELECT schedule_id, interval_months, anchor_ym, end_ym, remaining, skip_ym
--     FROM life_expense.scheduled_entries
--    WHERE interval_months <> 1 OR end_ym IS NOT NULL
--       OR remaining IS NOT NULL OR skip_ym IS NOT NULL;
BEGIN;

ALTER TABLE life_expense.scheduled_entries
    DROP CONSTRAINT IF EXISTS scheduled_entries_interval_chk;
ALTER TABLE life_expense.scheduled_entries
    DROP CONSTRAINT IF EXISTS scheduled_entries_ym_chk;
ALTER TABLE life_expense.scheduled_entries
    DROP CONSTRAINT IF EXISTS scheduled_entries_end_chk;

ALTER TABLE life_expense.scheduled_entries
    DROP COLUMN IF EXISTS interval_months,
    DROP COLUMN IF EXISTS anchor_ym,
    DROP COLUMN IF EXISTS end_ym,
    DROP COLUMN IF EXISTS remaining,
    DROP COLUMN IF EXISTS skip_ym;

COMMIT;
