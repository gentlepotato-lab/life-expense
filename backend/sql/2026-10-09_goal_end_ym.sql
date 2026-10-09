-- 안쓴이 도전에 종료 연월을 둔다.
--
-- 시작 연월만으로는 그만둔 도전을 접을 데가 없었다. 한 번 건 도전은 영영
-- 걸린 것이 되어, 몇 해 뒤에도 그 달의 성적에 끼어든다.
--
-- 비워 두면 끝이 없다는 뜻이다 — 지금 걸어 둔 것은 모두 그렇다.

ALTER TABLE life_expense.category_goals
    ADD COLUMN IF NOT EXISTS end_ym char(7) NULL;

-- `2026-10` 꼴만 받는다. 비어 있는 것(종료 없음)은 그대로 받는다.
ALTER TABLE life_expense.category_goals
    DROP CONSTRAINT IF EXISTS category_goals_end_ym_chk;

ALTER TABLE life_expense.category_goals
    ADD CONSTRAINT category_goals_end_ym_chk
    CHECK (end_ym IS NULL OR end_ym ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

-- 끝이 시작보다 앞설 수는 없다.
ALTER TABLE life_expense.category_goals
    DROP CONSTRAINT IF EXISTS category_goals_ym_order_chk;

ALTER TABLE life_expense.category_goals
    ADD CONSTRAINT category_goals_ym_order_chk
    CHECK (end_ym IS NULL OR end_ym >= start_ym);
