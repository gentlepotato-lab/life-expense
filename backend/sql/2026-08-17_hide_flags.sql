-- ═══════════════════════════════════════════════════════════════
-- 분류·결제 수단에 "감추기" 추가
-- 2026-08-17
-- ─────────────────────────────────────────────────────────────
-- Counterparts 에만 있던 감추기를 나머지 두 화면에도 둔다.
--
-- Blur 와는 다른 것이다.
--   · Blur   — 금액을 흐리게 가려 보여 준다(categories_lvl2.blur_flag).
--              항목은 그대로 쓰고, 남이 화면을 봐도 액수를 모르게 하려는 것.
--   · 감추기 — 더 이상 쓰지 않는 항목을 고르는 목록에서 뺀다.
--              지난 내역은 그 항목을 계속 가리키므로 지울 수는 없다.
--
-- 기본값 1(보임)이라 기존 동작은 그대로다.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE life_expense.categories_lvl1
    ADD COLUMN IF NOT EXISTS is_active smallint NOT NULL DEFAULT 1;

ALTER TABLE life_expense.categories_lvl2
    ADD COLUMN IF NOT EXISTS is_active smallint NOT NULL DEFAULT 1;

ALTER TABLE life_expense.categories_lvl3
    ADD COLUMN IF NOT EXISTS is_active smallint NOT NULL DEFAULT 1;

ALTER TABLE life_expense.payment_methods
    ADD COLUMN IF NOT EXISTS is_active smallint NOT NULL DEFAULT 1;

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 롤백
--   ALTER TABLE life_expense.categories_lvl1 DROP COLUMN IF EXISTS is_active;
--   ALTER TABLE life_expense.categories_lvl2 DROP COLUMN IF EXISTS is_active;
--   ALTER TABLE life_expense.categories_lvl3 DROP COLUMN IF EXISTS is_active;
--   ALTER TABLE life_expense.payment_methods DROP COLUMN IF EXISTS is_active;
-- ═══════════════════════════════════════════════════════════════
