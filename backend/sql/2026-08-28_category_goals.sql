-- 분류별 목표 금액 — "안쓴이 도전".
--
-- 지출에 거는 목표라 덜 쓰면 이기는 것이다. 중·소·세 어느 단에나 걸 수 있고,
-- 채운 것 중 가장 깊은 단이 그 목표의 대상이다. 세 칸을 그대로 둔 것은
-- entries와 같은 꼴이라 화면이 쓰는 분류 경로 함수를 그대로 쓸 수 있어서다.
--
-- 겹쳐 걸 수 있다. "식비" 50만과 "식비 > 점심" 20만을 함께 두면 점심에 쓴 돈은
-- 두 목표에 모두 들어간다. 나눠 셈하지 않는다 — 큰 테두리와 그 안의 한 갈래를
-- 함께 지켜보는 것이 가장 흔한 쓰임이기 때문이다.
--
-- 금액은 달마다 같은 값 하나다. 달마다 다르게 잡고 싶어지면 ym 칸을 더하면
-- 되지만, 지금 넣으면 매달 다시 적어야 한다.

CREATE TABLE IF NOT EXISTS life_expense.category_goals (
    goal_id    serial PRIMARY KEY,
    cat1_id    integer NOT NULL
               REFERENCES life_expense.categories_lvl1(cat1_id) ON DELETE CASCADE,
    cat2_id    integer
               REFERENCES life_expense.categories_lvl2(cat2_id) ON DELETE CASCADE,
    cat3_id    integer
               REFERENCES life_expense.categories_lvl3(cat3_id) ON DELETE CASCADE,
    amount     numeric(14,2) NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp DEFAULT now(),
    -- 세분류만 덩그러니 있는 줄은 없다. 위 단을 건너뛸 수 없다.
    CONSTRAINT ck_category_goals_path CHECK (cat3_id IS NULL OR cat2_id IS NOT NULL)
);

-- 같은 분류에 목표를 두 번 걸 수는 없다.
-- 비어 있는 칸이 섞여 있어 그냥 UNIQUE로는 걸리지 않는다(NULL은 서로 다르다).
CREATE UNIQUE INDEX IF NOT EXISTS ux_category_goals_target
    ON life_expense.category_goals
       (cat1_id, COALESCE(cat2_id, 0), COALESCE(cat3_id, 0));

CREATE INDEX IF NOT EXISTS ix_category_goals_sort
    ON life_expense.category_goals (sort_order, goal_id);
