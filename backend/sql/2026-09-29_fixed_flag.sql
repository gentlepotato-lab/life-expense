-- 고정과 변동을 가른다.
--
-- 월급이나 구독처럼 달마다 같은 자리에 오는 돈과, 점심이나 택시처럼 그때그때
-- 달라지는 돈은 성격이 다르다. 씀씀이를 볼 때 둘을 갈라 보면 "줄일 수 있는
-- 돈"이 얼마인지가 드러난다.
--
-- 두 곳에 둔다.
--
-- ① 분류(소 · 세)에 — 같은 갈래는 대개 같은 성격이라 여기서 한 번 정해 두면
--    새로 적는 건이 그것을 물려받는다. 중분류에는 두지 않는다. 한 중분류
--    안에서도 소분류마다 갈리기 때문이다(현재/미래 > 저축은 고정, 투자는 변동).
-- ② 건(지출 · 대기 · 정기)에 — 같은 갈래라도 어떤 건은 다르다. 비어 있으면
--    분류를 따르고, 손으로 바꾸면 그 건에만 남는다. 뒤에 분류 설정을 바꿔도
--    손댄 건은 그대로다. perf_exclude와 같은 짜임이다.
--
-- 0이면 변동, 1이면 고정이다. 분류는 모두 변동으로 깔아 두고 고정인 것만
-- 손으로 켠다.
ALTER TABLE life_expense.categories_lvl2
    ADD COLUMN IF NOT EXISTS fixed_flag smallint NOT NULL DEFAULT 0;

ALTER TABLE life_expense.categories_lvl3
    ADD COLUMN IF NOT EXISTS fixed_flag smallint NOT NULL DEFAULT 0;

ALTER TABLE life_expense.entries
    ADD COLUMN IF NOT EXISTS fixed_flag smallint NULL;

ALTER TABLE life_expense.pending_entries
    ADD COLUMN IF NOT EXISTS fixed_flag smallint NULL;

ALTER TABLE life_expense.scheduled_entries
    ADD COLUMN IF NOT EXISTS fixed_flag smallint NULL;

COMMENT ON COLUMN life_expense.categories_lvl2.fixed_flag    IS '0이면 변동, 1이면 고정. 이 갈래의 기본값이다.';
COMMENT ON COLUMN life_expense.categories_lvl3.fixed_flag    IS '0이면 변동, 1이면 고정. 소분류보다 앞선다.';
COMMENT ON COLUMN life_expense.entries.fixed_flag            IS '비면 분류를 따른다. 0이면 변동, 1이면 고정.';
COMMENT ON COLUMN life_expense.pending_entries.fixed_flag    IS '비면 분류를 따른다. 0이면 변동, 1이면 고정.';
COMMENT ON COLUMN life_expense.scheduled_entries.fixed_flag  IS '비면 분류를 따른다. 0이면 변동, 1이면 고정.';
