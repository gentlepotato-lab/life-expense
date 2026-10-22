-- 2026-10-22_batch.sql 되돌리기.
--
-- 새로 만든 둘만 걷는다. 기존 테이블은 건드린 적이 없으므로 되돌릴 것도
-- 없다. 걷고 나면 도는 때는 다시 소스에 박힌 값을 쓴다
-- (app/scheduler/registry.py의 기본때).

DROP TABLE IF EXISTS life_expense.job_runs;

DROP TABLE IF EXISTS life_expense.job_schedules;
