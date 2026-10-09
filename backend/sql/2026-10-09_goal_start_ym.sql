-- 안쓴이 도전에 시작 연월을 둔다.
--
-- 목표는 분류마다 한 줄뿐이라 기간이 없었다. 그래서 달을 거슬러 보면 어제
-- 건 목표가 작년에도 걸려 있던 것처럼 나와 "그때 넘겼다"는 거짓 성적이
-- 생긴다. 어느 달부터 센 것인지를 줄이 들고 있게 한다.
--
-- 이미 걸어 둔 목표는 만든 달부터 센 것으로 본다 — 그 전 달에는 없던 것이
-- 맞다.

ALTER TABLE life_expense.category_goals
    ADD COLUMN IF NOT EXISTS start_ym char(7) NULL;

UPDATE life_expense.category_goals
   SET start_ym = to_char(COALESCE(created_at, now()), 'YYYY-MM')
 WHERE start_ym IS NULL;

ALTER TABLE life_expense.category_goals
    ALTER COLUMN start_ym SET NOT NULL;

ALTER TABLE life_expense.category_goals
    ALTER COLUMN start_ym SET DEFAULT to_char(now(), 'YYYY-MM');

-- `2026-10` 꼴만 받는다. 화면이 보내는 값이 어긋나면 여기서 걸린다.
ALTER TABLE life_expense.category_goals
    DROP CONSTRAINT IF EXISTS category_goals_start_ym_chk;

ALTER TABLE life_expense.category_goals
    ADD CONSTRAINT category_goals_start_ym_chk
    CHECK (start_ym ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
