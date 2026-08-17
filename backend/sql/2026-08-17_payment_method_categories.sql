-- ═══════════════════════════════════════════════════════════════
-- 결제 수단 구분을 제대로 된 분류 표로 올린다
-- 2026-08-17
-- ─────────────────────────────────────────────────────────────
-- 지금까지 구분은 코드에 박힌 문자열이었고, 이모지는 이름으로만
-- 매달아 둔 옆 표(group_emojis)에 있었다.
-- 이래서는 "구분별 집계에 이모지를 같이 붙인다" 같은 일을 할 때
-- 이름 문자열로 조인해야 하고, 이름을 고치는 순간 끊긴다.
--
-- Categories 의 중분류(categories_lvl1)처럼 구분도 행으로 두고
-- 이모지를 그 행에 담는다. 결제 수단은 그 행을 FK 로 가리킨다.
--
-- 추가만 한다(Expand).
--   · payment_methods.category(문자열)는 그대로 남긴다.
--     당장 읽는 곳이 있어 함께 채우고, 나중에 정리한다.
--   · group_emojis 표는 지우지 않는다(다른 화면이 쓸 수 있다).
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1) 구분 표 ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS life_expense.payment_method_categories (
    category_id serial      PRIMARY KEY,
    name        varchar(40) NOT NULL,
    emoji       varchar(16),
    sort_order  integer     NOT NULL DEFAULT 0,
    is_active   smallint    NOT NULL DEFAULT 1,
    created_at  timestamp   NOT NULL DEFAULT now(),
    updated_at  timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_method_categories_name_uniq
    ON life_expense.payment_method_categories (name);

-- ─── 2) 화면에서 쓰던 네 가지를 행으로 옮긴다 ─────────────────
INSERT INTO life_expense.payment_method_categories (name, sort_order)
VALUES ('카드', 1), ('계좌·현금', 2), ('간편결제', 3), ('기타', 4)
ON CONFLICT (name) DO NOTHING;

-- ─── 3) 옆 표에 있던 이모지를 분류 행으로 옮긴다 ──────────────
UPDATE life_expense.payment_method_categories c
   SET emoji = g.emoji
  FROM life_expense.group_emojis g
 WHERE g.scope = 'payment_method_category'
   AND g.group_key = c.name
   AND g.emoji IS NOT NULL;

-- ─── 4) 결제 수단이 분류 행을 가리키게 한다 ───────────────────
ALTER TABLE life_expense.payment_methods
    ADD COLUMN IF NOT EXISTS category_id integer;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payment_methods_category_fk'
    ) THEN
        ALTER TABLE life_expense.payment_methods
            ADD CONSTRAINT payment_methods_category_fk
            FOREIGN KEY (category_id)
            REFERENCES life_expense.payment_method_categories (category_id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS payment_methods_category_idx
    ON life_expense.payment_methods (category_id);

-- 기존 문자열 값으로 채워 둔다(현재는 전부 NULL 이라 바뀌는 행이 없다)
UPDATE life_expense.payment_methods p
   SET category_id = c.category_id
  FROM life_expense.payment_method_categories c
 WHERE p.category = c.name
   AND p.category_id IS NULL;

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 롤백
--   ALTER TABLE life_expense.payment_methods
--       DROP CONSTRAINT IF EXISTS payment_methods_category_fk;
--   DROP INDEX IF EXISTS life_expense.payment_methods_category_idx;
--   ALTER TABLE life_expense.payment_methods DROP COLUMN IF EXISTS category_id;
--   DROP TABLE IF EXISTS life_expense.payment_method_categories;
-- ═══════════════════════════════════════════════════════════════
