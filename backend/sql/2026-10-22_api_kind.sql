-- 기록에 「바깥 요청」 갈래를 더한다.
--
-- action_logs 의 가름(kind) 하나만 넓힌다. 칸을 더하지도 지우지도 않는다.
--
-- 왜 더하는가. 카카오 지도는 브라우저가 dapi.kakao.com 으로 바로 부른다.
-- 서버를 거치지 않으니 서버가 적을 길이 없어, 관리자 사이트의 외부 API 쪽이
-- 「아직 쌓인 것이 없습니다」로만 떠 있었다. 브라우저가 스스로 적어 보내게
-- 하려면 담을 갈래가 있어야 한다.
--
-- feature 로 적지 않는 까닭은 대시보드의 기능별 사용 횟수가 그 갈래를
-- 세기 때문이다. 바깥에 묻는 일이 기능 목록에 섞이면 그 셈이 흐려진다.
ALTER TABLE life_expense.action_logs
    DROP CONSTRAINT IF EXISTS action_logs_kind_chk;

ALTER TABLE life_expense.action_logs
    ADD CONSTRAINT action_logs_kind_chk
    CHECK (kind::text = ANY (ARRAY[
        'view'::character varying,
        'feature'::character varying,
        'error'::character varying,
        'api'::character varying
    ]::text[]));
