-- 바퀴 하나가 몇 밀리초 걸렸는지 적는 칸.
--
-- job_runs 에 컬럼 하나를 더한다. 2026-10-22_batch.sql 에서 만든 테이블이고,
-- 관리자 사이트의 배치 쪽 말고는 아무 데도 쓰지 않는다.
--
-- 왜 담는가. 카드에는 마지막 한 줄만 서므로, 공휴일 조회가 요즘 느려지는
-- 중인지 어제만 느렸는지 가릴 길이 없었다. 상세 이력 쪽에서 바퀴마다 걸린
-- 시간을 나란히 놓고 본다(app/routers/admin.py 의 /admin/batch/runs).
--
-- 묵은 로우는 null 로 남는다. 잰 적이 없는 바퀴라 0으로 채우면 「한눈에
-- 끝났다」로 읽힌다.
ALTER TABLE life_expense.job_runs
    ADD COLUMN IF NOT EXISTS elapsed_ms integer;
