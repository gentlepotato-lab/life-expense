-- 카드 실적에서 뺄 건을 건별로 표시한다.
--
-- 상품권 · 세금처럼 카드로 그었지만 카드사가 실적으로 쳐 주지 않는 건이 있다.
-- 지금까지는 메모에 손으로 "- 실적 제외"라고 적어 두었다. 셈에 쓸 수 없는 글이라
-- 씀씀이의 카드 실적은 그 돈까지 얹어 셌다.
--
-- 분류에 다는 것이 아니라 건에 단다. 같은 갈래라도 어떤 건은 들고 어떤 건은
-- 빠지기 때문이다.
--
-- 세 표 모두에 둔다. 정기 → 대기 → 지출로 옮겨 갈 때 표가 따라가야 한다.
ALTER TABLE life_expense.entries
    ADD COLUMN IF NOT EXISTS perf_exclude smallint NOT NULL DEFAULT 0;

ALTER TABLE life_expense.pending_entries
    ADD COLUMN IF NOT EXISTS perf_exclude smallint NOT NULL DEFAULT 0;

ALTER TABLE life_expense.scheduled_entries
    ADD COLUMN IF NOT EXISTS perf_exclude smallint NOT NULL DEFAULT 0;

COMMENT ON COLUMN life_expense.entries.perf_exclude           IS '1이면 카드 실적에서 뺀다.';
COMMENT ON COLUMN life_expense.pending_entries.perf_exclude   IS '1이면 카드 실적에서 뺀다.';
COMMENT ON COLUMN life_expense.scheduled_entries.perf_exclude IS '1이면 카드 실적에서 뺀다.';
