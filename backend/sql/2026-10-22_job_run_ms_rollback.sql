-- 2026-10-22_job_run_ms.sql 되돌리기.
--
-- 더한 컬럼만 걷는다. 걷고 나면 상세 이력에서 걸린 시간 칸이 빈다.

ALTER TABLE life_expense.job_runs
    DROP COLUMN IF EXISTS elapsed_ms;
