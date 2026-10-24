-- 2026-10-24_api_request.sql 되돌리기.
--
-- 더한 컬럼 둘을 걷는다. 그 컬럼에 쌓인 것은 함께 사라진다 — 되살릴 길이 없으니
-- 되돌리기 전에 들여다볼 것이 남았는지 먼저 본다.

BEGIN;

ALTER TABLE life_expense.action_logs
    DROP COLUMN IF EXISTS url;

ALTER TABLE life_expense.action_logs
    DROP COLUMN IF EXISTS method;

COMMIT;
