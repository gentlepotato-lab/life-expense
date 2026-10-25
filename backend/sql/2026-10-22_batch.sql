-- 배치가 쓰는 테이블 둘.
--
-- 기존 테이블은 컬럼 하나 건드리지 않는다. 이 파일에 ALTER는 한 줄도 없다.
-- 둘을 새로 만들 뿐이라, 되돌리기 하나로 흔적 없이 걷힌다.
--
-- 둘 다 user_id 컬럼을 미리 두고 지금은 1을 넣는다. 2026-10-20_admin_page.sql과
-- 같은 가름이라 외래키는 걸지 않는다.

-- ── 도는 때 ─────────────────────────────────────────────────
--
-- 전에는 때가 파이썬 소스에 박혀 있었다(app/scheduler/*.py의 add_job).
-- 관리자 사이트에서 고치려면 어딘가 담겨 있어야 해서 이 테이블로 옮긴다.
--
-- kind는 셋뿐이다.
--   minute: 매분. hour와 day_of_month는 비운다.
--   daily: 날마다 hour시 minute분에 돈다.
--   monthly: 달마다 day_of_month일 hour시 minute분에 돈다.
-- 이 셋 말고는 코드가 받지 않는다(app/scheduler/registry.py).
CREATE TABLE IF NOT EXISTS life_expense.job_schedules (
    job_key      varchar(40) PRIMARY KEY,
    kind         varchar(10) NOT NULL,
    day_of_month smallint,
    hour         smallint,
    minute       smallint,
    is_active    smallint NOT NULL DEFAULT 1,
    user_id      integer NOT NULL DEFAULT 1,
    updated_at   timestamp DEFAULT now()
);

-- 받는 값을 테이블이 먼저 가린다. 코드가 한 번 더 가리지만, 손으로 넣는 일도
-- 있으므로 여기서도 막는다.
ALTER TABLE life_expense.job_schedules
    DROP CONSTRAINT IF EXISTS job_schedules_kind_chk;
ALTER TABLE life_expense.job_schedules
    ADD CONSTRAINT job_schedules_kind_chk
    CHECK (kind IN ('minute', 'daily', 'monthly'));

ALTER TABLE life_expense.job_schedules
    DROP CONSTRAINT IF EXISTS job_schedules_time_chk;
ALTER TABLE life_expense.job_schedules
    ADD CONSTRAINT job_schedules_time_chk
    CHECK (
        (hour IS NULL OR (hour >= 0 AND hour <= 23))
        AND (minute IS NULL OR (minute >= 0 AND minute <= 59))
        AND (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 28))
    );

-- 지금 소스에 박혀 있는 그대로를 담는다. 이 로우들이 들어간 뒤에도 도는 때가
-- 한 치도 달라지지 않아야 한다.
INSERT INTO life_expense.job_schedules (job_key, kind, day_of_month, hour, minute)
VALUES
    ('scheduled_entry_processor', 'minute',  NULL, NULL, NULL),
    ('holiday_update_daily',      'daily',   NULL,    9,   20),
    ('monthly_cleanup',           'monthly',   20,    2,    0)
ON CONFLICT (job_key) DO NOTHING;

-- ── 돈 자국 ─────────────────────────────────────────────────
--
-- 전에는 print로 흘려보냈다. 그래서 "어제 공휴일을 받아 왔나"를 알 길이
-- 서버 로그를 뒤지는 것뿐이었다. 한 로우씩 담으면 관리자 사이트에서 바로
-- 읽는다.
--
-- note는 그 바퀴가 무엇을 했는지 한 줄로 적는 자리다. 「11월까지」,
-- 「412건 지움」처럼 적는다. 틀을 정하지 않는 것은 일마다 계산하는 것이
-- 다르기 때문이다.
CREATE TABLE IF NOT EXISTS life_expense.job_runs (
    run_id     bigserial PRIMARY KEY,
    job_key    varchar(40) NOT NULL,
    started_at timestamp NOT NULL DEFAULT now(),
    ok         smallint NOT NULL DEFAULT 1,
    note       varchar(200),
    user_id    integer NOT NULL DEFAULT 1
);

-- 일마다 마지막 한 로우만 꺼내 보므로 그 차례로 건다.
CREATE INDEX IF NOT EXISTS ix_job_runs_key
    ON life_expense.job_runs (job_key, started_at DESC);
