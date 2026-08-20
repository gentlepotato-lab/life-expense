-- ═══════════════════════════════════════════════════════════════
-- 2026-08-18_exclude_flag.sql 되돌리기
-- ─────────────────────────────────────────────────────────────
-- 컬럼만 지운다. 다른 자료는 건드리지 않는다.
-- 화면·백엔드 코드도 함께 되돌려야 한다(그 파일들은 백업 폴더에 있다).
-- ═══════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE life_expense.categories_lvl1 DROP COLUMN IF EXISTS exclude_flag;
ALTER TABLE life_expense.categories_lvl2 DROP COLUMN IF EXISTS exclude_flag;
ALTER TABLE life_expense.categories_lvl3 DROP COLUMN IF EXISTS exclude_flag;

COMMIT;
