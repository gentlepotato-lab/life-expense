-- ═══════════════════════════════════════════════════════════════
-- 쓰지 않게 된 것 정리
-- 2026-08-17
-- ─────────────────────────────────────────────────────────────
-- 오늘 하루 안에 두 번 방향이 바뀌면서 남은 것들이다.
--
--   1) group_emojis
--      "이름만 있는 묶음"의 이모지를 담으려고 만들었는데,
--      결제 수단 구분을 제대로 된 분류 표로 올리면서 쓸 일이 없어졌다.
--      담긴 행도 0건이다.
--
--   2) payment_methods.category (문자열)
--      구분을 문자열로 들고 있던 시절의 컬럼이다.
--      지금은 payment_methods.category_id가 분류 행을 가리키고,
--      조회는 그 행의 이름을 가져오므로 읽는 곳이 없다.
--
-- 둘 다 오늘 만들어 오늘 쓰임이 사라진 것이라 남은 데이터가 없다.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- 지우기 전에 정말 비어 있는지 확인한다. 값이 있으면 통째로 멈춘다.
DO $$
DECLARE
    n_emoji integer;
    n_cat   integer;
BEGIN
    SELECT count(*) INTO n_emoji FROM life_expense.group_emojis;
    IF n_emoji > 0 THEN
        RAISE EXCEPTION 'group_emojis 에 % 건이 남아 있다. 옮긴 뒤에 다시 실행할 것', n_emoji;
    END IF;

    SELECT count(*) INTO n_cat
      FROM life_expense.payment_methods
     WHERE category IS NOT NULL;
    IF n_cat > 0 THEN
        RAISE EXCEPTION 'payment_methods.category 에 % 건이 남아 있다. category_id 로 옮긴 뒤 실행할 것', n_cat;
    END IF;
END $$;

DROP TABLE IF EXISTS life_expense.group_emojis;

ALTER TABLE life_expense.payment_methods
    DROP COLUMN IF EXISTS category;

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 되돌리기
--   ALTER TABLE life_expense.payment_methods ADD COLUMN category varchar(20);
--   CREATE TABLE life_expense.group_emojis (
--       scope varchar(40) NOT NULL, group_key varchar(60) NOT NULL,
--       emoji varchar(16), updated_at timestamp NOT NULL DEFAULT now(),
--       CONSTRAINT group_emojis_pk PRIMARY KEY (scope, group_key));
-- ═══════════════════════════════════════════════════════════════
