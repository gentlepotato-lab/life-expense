-- 정기 내역의 스케줄을 넓힌다.
--
-- 지금까지 정기 내역은 "매월 N일" 하나뿐이었다. 그런데 실제로 나가는 돈은
-- 그렇게만 오지 않는다 — 관리비는 격월로 오고, 자동차보험은 해마다 한 번
-- 오고, 할부는 정해진 횟수만큼만 오다가 끝난다.
--
-- 다섯 자리를 더한다.
--
-- ① interval_months — 몇 달마다 오는가. 1이면 지금까지와 똑같다.
-- ② anchor_ym       — 주기의 첫 달. 격월이 홀수 달인지 짝수 달인지는 이것이
--                     정한다. 매월(1)이면 볼 것이 없어 비워 둔다.
-- ③ end_ym          — 이 달까지만 온다. 그 달을 넘기면 멈춘다.
-- ④ remaining       — 남은 횟수. 한 번 나갈 때마다 하나씩 줄고 0이면 멈춘다.
--                     ③과 ④는 함께 쓰지 않는다 — 화면에서 하나만 고른다.
-- ⑤ skip_ym         — 이번 한 번만 건너뛸 달. 한 번 쓰고 나면 지워진다.
--
-- 멈춘다는 것은 next_run_at을 비운다는 뜻이고, 줄 자체는 지우지 않는다.
-- 끝난 할부가 소리 없이 사라지면 무엇이 끝났는지 알 길이 없기 때문이다.
--
-- 기존 줄은 모두 interval_months = 1로 깔린다. 나머지 넷은 비어 있으니
-- 지금까지의 셈이 한 톨도 달라지지 않는다.
BEGIN;

ALTER TABLE life_expense.scheduled_entries
    ADD COLUMN IF NOT EXISTS interval_months smallint NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS anchor_ym       char(6)  NULL,
    ADD COLUMN IF NOT EXISTS end_ym          char(6)  NULL,
    ADD COLUMN IF NOT EXISTS remaining       smallint NULL,
    ADD COLUMN IF NOT EXISTS skip_ym         char(6)  NULL;

-- 주기는 달력에서 뜻이 통하는 다섯 가지만 받는다. 5개월처럼 어중간한 값이
-- 들어오면 화면의 이름표가 지어질 자리가 없다.
ALTER TABLE life_expense.scheduled_entries
    DROP CONSTRAINT IF EXISTS scheduled_entries_interval_chk;
ALTER TABLE life_expense.scheduled_entries
    ADD CONSTRAINT scheduled_entries_interval_chk
    CHECK (interval_months IN (1, 2, 3, 6, 12));

-- 연월은 'YYYYMM' 여섯 자다. 글자로 담아도 대소 비교가 곧 시간 순서라
-- 셈이 간단하고, 자리마다 뜻이 눈에 보인다.
ALTER TABLE life_expense.scheduled_entries
    DROP CONSTRAINT IF EXISTS scheduled_entries_ym_chk;
ALTER TABLE life_expense.scheduled_entries
    ADD CONSTRAINT scheduled_entries_ym_chk
    CHECK (
        (anchor_ym IS NULL OR anchor_ym ~ '^[0-9]{4}(0[1-9]|1[0-2])$')
    AND (end_ym    IS NULL OR end_ym    ~ '^[0-9]{4}(0[1-9]|1[0-2])$')
    AND (skip_ym   IS NULL OR skip_ym   ~ '^[0-9]{4}(0[1-9]|1[0-2])$')
    );

-- 남은 횟수는 음수가 될 수 없고, 끝나는 달과 함께 쓰지 않는다.
ALTER TABLE life_expense.scheduled_entries
    DROP CONSTRAINT IF EXISTS scheduled_entries_end_chk;
ALTER TABLE life_expense.scheduled_entries
    ADD CONSTRAINT scheduled_entries_end_chk
    CHECK (remaining IS NULL OR (remaining >= 0 AND end_ym IS NULL));

COMMENT ON COLUMN life_expense.scheduled_entries.interval_months IS '몇 달마다. 1=매월, 2=격월, 3=분기, 6=반년, 12=매년';
COMMENT ON COLUMN life_expense.scheduled_entries.anchor_ym       IS '주기의 첫 달 YYYYMM. 매월이면 비운다.';
COMMENT ON COLUMN life_expense.scheduled_entries.end_ym          IS '이 달까지만 온다 YYYYMM. 비면 끝이 없다.';
COMMENT ON COLUMN life_expense.scheduled_entries.remaining       IS '남은 횟수. 한 번 나갈 때마다 줄고 0이면 멈춘다.';
COMMENT ON COLUMN life_expense.scheduled_entries.skip_ym         IS '이번 한 번만 건너뛸 달 YYYYMM. 쓰고 나면 지워진다.';

COMMIT;
