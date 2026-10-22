-- 2026-10-22_api_kind.sql 되돌리기.
--
-- 가름을 셋으로 되돌린다. 되돌리기 전에 api 갈래로 쌓인 줄을 먼저 지워야
-- 한다. 남아 있으면 가름에 걸려 되돌아가지 않는다.

DELETE FROM life_expense.action_logs WHERE kind = 'api';

ALTER TABLE life_expense.action_logs
    DROP CONSTRAINT IF EXISTS action_logs_kind_chk;

ALTER TABLE life_expense.action_logs
    ADD CONSTRAINT action_logs_kind_chk
    CHECK (kind::text = ANY (ARRAY[
        'view'::character varying,
        'feature'::character varying,
        'error'::character varying
    ]::text[]));
