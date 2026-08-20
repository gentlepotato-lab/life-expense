-- ═══════════════════════════════════════════════════════════════
-- 2026-08-19_blur_3depth.sql 되돌리기
-- ─────────────────────────────────────────────────────────────
-- 소분류(categories_lvl2)의 blur_flag 는 원래 있던 것이라 건드리지 않는다.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE life_expense.categories_lvl1 DROP COLUMN IF EXISTS blur_flag;
ALTER TABLE life_expense.categories_lvl3 DROP COLUMN IF EXISTS blur_flag;

COMMIT;
