-- 관리자 페이지가 쓰는 테이블 다섯.
--
-- 기존 테이블은 칸 하나 건드리지 않는다. 이 파일에 ALTER는 한 줄도 없다 —
-- 다섯을 새로 만들 뿐이라, 되돌리기 하나로 흔적 없이 걷힌다.
--
-- 다섯 다 user_id 칸을 미리 두고 지금은 1을 넣는다. 아직 로그인이 없어
-- profile_id = 1이 코드 곳곳에 박혀 있는 1인용이지만, 나중에 여럿이 될 때
-- 자료를 옮기지 않게 하려는 가름이다. 그래서 외래키는 걸지 않는다 —
-- users 테이블이 생기는 날 걸면 된다.

-- ── 운영하는 사람의 설정 ────────────────────────────────────
--
-- app_prefs와 칸을 똑같이 맞춘다. 둘이 같은 꼴이어야 "쓰는 사람의 설정"과
-- "운영하는 사람의 설정"을 같은 코드로 다룰 수 있다. 받는 열쇠는 코드가
-- SITE_KEYS로 가려 받는다 — 여기 없는 열쇠는 들어오지 않는다.
CREATE TABLE IF NOT EXISTS life_expense.site_prefs (
    pref_key   varchar(40) PRIMARY KEY,
    pref_value varchar(200) NOT NULL,
    user_id    integer NOT NULL DEFAULT 1,
    updated_at timestamp DEFAULT now()
);

-- ── 공지사항 ────────────────────────────────────────────────
--
-- 홈 맨 위에 한 줄 띠로 뜬다. 뜨는 기간은 날짜만 담으므로 _on으로
-- 끝낸다(시각까지 담는 칸은 _at이다). 둘 다 비우면 늘 뜬다는 뜻이다.
CREATE TABLE IF NOT EXISTS life_expense.notices (
    notice_id  serial PRIMARY KEY,
    title      varchar(100) NOT NULL,
    body       text,
    start_on   date,
    end_on     date,
    sort_order integer NOT NULL DEFAULT 0,
    is_active  smallint NOT NULL DEFAULT 1,
    user_id    integer NOT NULL DEFAULT 1,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

-- 끝이 시작보다 앞설 수는 없다.
ALTER TABLE life_expense.notices
    DROP CONSTRAINT IF EXISTS notices_on_order_chk;

ALTER TABLE life_expense.notices
    ADD CONSTRAINT notices_on_order_chk
    CHECK (start_on IS NULL OR end_on IS NULL OR end_on >= start_on);

-- 화면은 켜진 것 가운데 오늘 걸린 것만 차례대로 읽는다.
CREATE INDEX IF NOT EXISTS ix_notices_live
    ON life_expense.notices (is_active, sort_order, notice_id);

-- ── 애니메이션 문구 ─────────────────────────────────────────
--
-- 안내 줄 쪽지와 앞머리 화면이 번갈아 띄우는 것들이다. 지금은
-- frontend/src/pages/components/PenMark.tsx에 상수로 박혀 있다.
--
-- kind는 그 줄이 무엇인지다.
--   mark  그림 자국(별, 동그라미, 네모, 세모, 다이아, 하트, 초승달, 돼지꼬리)
--   hello 인사말
-- 이름과 이모지는 돈쓴이가 정하는 것이라 이 테이블에 담지 않는다.
--
-- 확률은 켜진 줄을 전부 늘어놓고 1/전체로 뽑는다. 갈래로 먼저 나누면
-- 그림 하나하나가 글자보다 여덟 배 드물어진다.
CREATE TABLE IF NOT EXISTS life_expense.doodle_items (
    item_key   varchar(40) PRIMARY KEY,
    kind       varchar(20) NOT NULL,
    label      varchar(100) NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    is_active  smallint NOT NULL DEFAULT 1,
    user_id    integer NOT NULL DEFAULT 1,
    created_at timestamp DEFAULT now()
);

ALTER TABLE life_expense.doodle_items
    DROP CONSTRAINT IF EXISTS doodle_items_kind_chk;

ALTER TABLE life_expense.doodle_items
    ADD CONSTRAINT doodle_items_kind_chk
    CHECK (kind IN ('mark', 'hello'));

CREATE INDEX IF NOT EXISTS ix_doodle_items_live
    ON life_expense.doodle_items (is_active, sort_order, item_key);

-- 지금 화면에 박혀 있는 열 가지를 그대로 넣는다. 건드리기 전에는 지금과
-- 같은 결과가 나와야 한다. label은 그림 자국의 꼴 이름 그대로다 —
-- 화면이 그 이름으로 어느 그림을 그릴지 고른다.
INSERT INTO life_expense.doodle_items (item_key, kind, label, sort_order) VALUES
    ('mark-star',   'mark',  '별',      1),
    ('mark-circle', 'mark',  '동그라미', 2),
    ('mark-square', 'mark',  '네모',    3),
    ('mark-tri',    'mark',  '세모',    4),
    ('mark-diamond','mark',  '다이아',  5),
    ('mark-heart',  'mark',  '하트',    6),
    ('mark-moon',   'mark',  '초승달',  7),
    ('mark-tail',   'mark',  '돼지꼬리', 8),
    ('hello-plain', 'hello', '안녕하세요-! ;-)', 9)
ON CONFLICT (item_key) DO NOTHING;

-- ── 행동 기록 ───────────────────────────────────────────────
--
-- 통계 넷이 한 테이블에서 나온다. 테이블을 넷으로 나누면 대시보드에서 넷을
-- 따로 물어야 하고, 기간을 바꿀 때마다 네 번 돌게 된다.
--
-- kind는 무엇을 센 줄인지다.
--   view    화면별 드나든 수 — 라우터가 경로 바뀔 때 적는다.
--   feature 기능별 쓰임 — 영수증, 묶음, 엑셀을 쓸 때 적는다.
--   error   오류와 느린 요청 — axios 인터셉터가 적는다.
-- 적고 고친 건수(write)는 적지 않는다. entries에 날짜 칸이 있어 거기서
-- 셈하면 되고, 그래야 지난 것까지 소급해서 보인다.
--
-- 90일이 지난 줄은 월례 청소가 지운다(app/scheduler/cleanup_job.py).
CREATE TABLE IF NOT EXISTS life_expense.action_logs (
    log_id     bigserial PRIMARY KEY,
    kind       varchar(20) NOT NULL,
    name       varchar(100) NOT NULL,
    path       varchar(200),
    -- 걸린 시간. error 갈래에만 들어간다.
    elapsed_ms integer,
    -- HTTP 응답 코드. error 갈래에만 들어간다.
    status     smallint,
    user_id    integer NOT NULL DEFAULT 1,
    created_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE life_expense.action_logs
    DROP CONSTRAINT IF EXISTS action_logs_kind_chk;

ALTER TABLE life_expense.action_logs
    ADD CONSTRAINT action_logs_kind_chk
    CHECK (kind IN ('view', 'feature', 'error'));

-- 대시보드는 늘 "기간 안의 어느 갈래"를 묻는다. 청소도 같은 차례를 탄다.
CREATE INDEX IF NOT EXISTS ix_action_logs_when
    ON life_expense.action_logs (created_at, kind);

CREATE INDEX IF NOT EXISTS ix_action_logs_kind_name
    ON life_expense.action_logs (kind, name, created_at);

-- ── 관리자 자물쇠 ───────────────────────────────────────────
--
-- 암호가 맞으면 토큰 한 줄을 적고, 화면은 그것을 sessionStorage에 든다.
-- 메모리에 들면 서버를 재기동할 때마다 풀려서 테이블로 둔다.
--
-- 이것은 자물쇠지 인증이 아니다. 주소를 숨기고 암호 한 겹 두는 정도이고,
-- 여럿이 쓰게 될 때 제대로 된 로그인으로 바꿔야 한다.
CREATE TABLE IF NOT EXISTS life_expense.admin_sessions (
    token      varchar(64) PRIMARY KEY,
    expires_at timestamp NOT NULL,
    user_id    integer NOT NULL DEFAULT 1,
    created_at timestamp DEFAULT now()
);

-- 만료된 줄을 걷을 때 쓴다.
CREATE INDEX IF NOT EXISTS ix_admin_sessions_expires
    ON life_expense.admin_sessions (expires_at);
