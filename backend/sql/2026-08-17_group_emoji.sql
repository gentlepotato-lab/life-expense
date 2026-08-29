-- ═══════════════════════════════════════════════════════════════
-- 묶음 머리말에 이모지 붙이기
-- 2026-08-17
-- ─────────────────────────────────────────────────────────────
-- 색 점만으로는 묶음을 알아보기 어렵다. 이모지를 직접 골라 붙인다.
--
-- 저장 위치가 두 갈래인 이유
--   · Categories의 중분류는 실제 행이므로 그 행에 컬럼을 더한다.
--   · Payment Methods의 구분은 코드에 고정된 이름일 뿐 행이 없다.
--     그래서 "묶음 이름 → 이모지"를 담는 작은 표를 따로 둔다.
--     scope를 두었으니 나중에 다른 화면의 묶음도 여기에 얹을 수 있다.
--
-- 추가만 한다(Expand).
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1) 중분류의 이모지 ───────────────────────────────────────
-- 이모지 한 자는 서로게이트 페어 + 변이 선택자까지 붙으면 길어질 수 있어
-- 넉넉하게 잡는다.
ALTER TABLE life_expense.categories_lvl1
    ADD COLUMN IF NOT EXISTS emoji varchar(16);

-- ─── 2) 이름으로만 존재하는 묶음의 이모지 ─────────────────────
CREATE TABLE IF NOT EXISTS life_expense.group_emojis (
    scope      varchar(40) NOT NULL,   -- 예: 'payment_method_category'
    group_key  varchar(60) NOT NULL,   -- 예: '카드'
    emoji      varchar(16),
    updated_at timestamp   NOT NULL DEFAULT now(),

    CONSTRAINT group_emojis_pk PRIMARY KEY (scope, group_key)
);

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 롤백
--   DROP TABLE IF EXISTS life_expense.group_emojis;
--   ALTER TABLE life_expense.categories_lvl1 DROP COLUMN IF EXISTS emoji;
-- ═══════════════════════════════════════════════════════════════
