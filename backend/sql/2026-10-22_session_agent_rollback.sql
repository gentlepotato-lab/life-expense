-- 2026-10-22_session_agent.sql 되돌리기.
--
-- 더한 칸과 차례만 걷는다. 걷고 나면 같은 기기를 가릴 수 없어, 들어올 때마다
-- 로우가 하나씩 쌓인다.

DROP INDEX IF EXISTS life_expense.ix_admin_sessions_agent;

ALTER TABLE life_expense.admin_sessions
    DROP COLUMN IF EXISTS agent;

ALTER TABLE life_expense.admin_sessions
    DROP COLUMN IF EXISTS ip;
