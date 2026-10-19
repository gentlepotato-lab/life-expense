-- 2026-10-02_drop_remaining.sql 되돌리기.
--
-- 칸과 제약을 다시 세운다. 값은 모두 NULL이었으므로 되돌려도 자료는
-- 그대로다 — 지울 때 잃은 것이 없었다.

ALTER TABLE life_expense.scheduled_entries
    ADD COLUMN IF NOT EXISTS remaining smallint NULL;

ALTER TABLE life_expense.scheduled_entries
    DROP CONSTRAINT IF EXISTS scheduled_entries_end_chk;

ALTER TABLE life_expense.scheduled_entries
    ADD CONSTRAINT scheduled_entries_end_chk
    CHECK (remaining IS NULL OR (remaining >= 0 AND end_ym IS NULL));
