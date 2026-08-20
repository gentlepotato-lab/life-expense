-- ═══════════════════════════════════════════════════════════════
-- 분류 3뎁스에 "Exclude" 추가
-- 2026-08-18
-- ─────────────────────────────────────────────────────────────
-- 집계에서 뺄 갈래를 표시한다. 가계부는 쓴 돈을 보는 것이 목적이라
-- 수입 · 저축 · 투자 같은 것이 섞이면 달력과 씀씀이가 읽히지 않는다.
--
-- 이미 있는 두 깃발과는 다른 것이다.
--   · Blur    — 금액을 테이프로 덮어 남이 못 보게 한다(categories_lvl2.blur_flag).
--               셈에는 그대로 든다.
--   · 감추기  — 더 이상 쓰지 않는 갈래를 고르는 목록에서 뺀다(is_active).
--               지난 내역은 그대로 남는다.
--   · Exclude — 셈에서 뺀다. 내역 카드에는 그대로 보이고,
--               달력 · 씀씀이 · 기간 상세의 집계에서만 빠진다.
--
-- 중 · 소 · 세 중 하나라도 1 이면 그 항목은 집계에서 빠진다.
-- 컬럼 이름은 Exclude 가 PostgreSQL 예약어라 blur_flag 를 본떠 exclude_flag 로 둔다.
--
-- 기본값 0(집계에 듦)이라 기존 동작은 그대로다.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE life_expense.categories_lvl1
    ADD COLUMN IF NOT EXISTS exclude_flag smallint NOT NULL DEFAULT 0;

ALTER TABLE life_expense.categories_lvl2
    ADD COLUMN IF NOT EXISTS exclude_flag smallint NOT NULL DEFAULT 0;

ALTER TABLE life_expense.categories_lvl3
    ADD COLUMN IF NOT EXISTS exclude_flag smallint NOT NULL DEFAULT 0;

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 롤백 — 2026-08-18_exclude_flag_rollback.sql 을 실행하면 된다.
--   ALTER TABLE life_expense.categories_lvl1 DROP COLUMN IF EXISTS exclude_flag;
--   ALTER TABLE life_expense.categories_lvl2 DROP COLUMN IF EXISTS exclude_flag;
--   ALTER TABLE life_expense.categories_lvl3 DROP COLUMN IF EXISTS exclude_flag;
-- ═══════════════════════════════════════════════════════════════
