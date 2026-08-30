-- ═══════════════════════════════════════════════════════════════
-- Blur를 중분류 · 세분류에도
-- 2026-08-19
-- ─────────────────────────────────────────────────────────────
-- 소분류에만 있던 blur_flag를 세 뎁스 모두에 둔다. Exclude와 같은 모양이다.
-- 중 · 소 · 세 중 하나라도 1이면 그 항목의 금액은 테이프로 덮인다.
--
-- 기본값 0이라 기존 동작은 그대로다.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE life_expense.categories_lvl1
    ADD COLUMN IF NOT EXISTS blur_flag smallint NOT NULL DEFAULT 0;

ALTER TABLE life_expense.categories_lvl3
    ADD COLUMN IF NOT EXISTS blur_flag smallint NOT NULL DEFAULT 0;

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 롤백 — 2026-08-19_blur_3depth_rollback.sql
--   소분류의 blur_flag는 원래 있던 것이라 지우지 않는다.
-- ═══════════════════════════════════════════════════════════════
