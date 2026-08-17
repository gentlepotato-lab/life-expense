-- ═══════════════════════════════════════════════════════════════
-- 상대의 구분을 분류 표로 올리고, 사용자가 늘릴 수 있게 한다
-- 2026-08-17
-- ─────────────────────────────────────────────────────────────
-- Payment Methods 와 같은 모양이다. 다른 점은 색이 하나 더 붙는 것.
--
-- 왜 색이 필요한가
--   Counterparts 는 이름 첫 글자를 담은 동그란 아바타가 색을 쓴다.
--   지금은 구분 네 가지에 맞춘 CSS 클래스(.cat-1~4)로 색이 박혀 있어,
--   사용자가 다섯 번째 구분을 만들면 칠할 색이 없다.
--
-- 색은 헥사값이 아니라 토큰 이름('indigo', 'teal' …)으로 담는다.
-- 화면의 색을 나중에 조정할 때 DB 를 건드리지 않으려는 것이다.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1) 구분 표 ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS life_expense.counterpart_categories (
    category_id serial      PRIMARY KEY,
    name        varchar(40) NOT NULL,
    emoji       varchar(16),
    color       varchar(20),          -- 팔레트 토큰 이름
    sort_order  integer     NOT NULL DEFAULT 0,
    is_active   smallint    NOT NULL DEFAULT 1,
    created_at  timestamp   NOT NULL DEFAULT now(),
    updated_at  timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS counterpart_categories_name_uniq
    ON life_expense.counterpart_categories (name);

-- ─── 2) 화면에 박혀 있던 네 가지 + 실제로 쓰이던 값을 행으로 ──
INSERT INTO life_expense.counterpart_categories (name, color, sort_order)
VALUES ('가족', 'indigo', 1), ('친구', 'teal', 2),
       ('직장', 'amber', 3), ('기타', 'slate', 4)
ON CONFLICT (name) DO NOTHING;

-- 코드에 없던 이름을 누가 넣어 두었다면 그것도 행으로 만든다
INSERT INTO life_expense.counterpart_categories (name, color, sort_order)
SELECT DISTINCT c.category, 'slate',
       100 + dense_rank() OVER (ORDER BY c.category)
  FROM life_expense.counterparts c
 WHERE c.category IS NOT NULL
   AND c.category <> ''
   AND NOT EXISTS (
       SELECT 1 FROM life_expense.counterpart_categories x WHERE x.name = c.category
   )
ON CONFLICT (name) DO NOTHING;

-- ─── 3) 상대가 분류 행을 가리키게 한다 ────────────────────────
ALTER TABLE life_expense.counterparts
    ADD COLUMN IF NOT EXISTS category_id integer;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'counterparts_category_fk'
    ) THEN
        ALTER TABLE life_expense.counterparts
            ADD CONSTRAINT counterparts_category_fk
            FOREIGN KEY (category_id)
            REFERENCES life_expense.counterpart_categories (category_id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS counterparts_category_idx
    ON life_expense.counterparts (category_id);

UPDATE life_expense.counterparts c
   SET category_id = t.category_id
  FROM life_expense.counterpart_categories t
 WHERE c.category = t.name
   AND c.category_id IS NULL;

-- ─── 4) 문자열 컬럼을 뗀다 ────────────────────────────────────
-- 옮기지 못한 값이 하나라도 있으면 통째로 멈춘다.
DO $$
DECLARE
    n integer;
BEGIN
    SELECT count(*) INTO n
      FROM life_expense.counterparts
     WHERE category IS NOT NULL AND category <> '' AND category_id IS NULL;
    IF n > 0 THEN
        RAISE EXCEPTION '구분 % 건을 분류 행으로 옮기지 못했다', n;
    END IF;
END $$;

ALTER TABLE life_expense.counterparts
    DROP COLUMN IF EXISTS category;

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 되돌리기
--   ALTER TABLE life_expense.counterparts ADD COLUMN category varchar(20);
--   UPDATE life_expense.counterparts c SET category = t.name
--     FROM life_expense.counterpart_categories t WHERE t.category_id = c.category_id;
--   ALTER TABLE life_expense.counterparts DROP CONSTRAINT IF EXISTS counterparts_category_fk;
--   ALTER TABLE life_expense.counterparts DROP COLUMN IF EXISTS category_id;
--   DROP TABLE IF EXISTS life_expense.counterpart_categories;
-- ═══════════════════════════════════════════════════════════════
