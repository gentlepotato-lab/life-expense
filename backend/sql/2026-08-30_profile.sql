-- 돈쓴이 — 쓰는 사람과 앱 자신에 대한 것.
--
-- 지금은 혼자 쓰는 앱이라 줄이 하나뿐이다. 그래도 칸은 바깥 인증(구글·카카오)이
-- 돌려주는 것에 맞춰 두었다 — 나중에 로그인을 붙일 때 표를 다시 짜지 않으려는
-- 것이다. provider 가 비어 있으면 사람이 손으로 적어 넣은 것이다.
--
-- avatar_url 은 바깥에서 받은 사진 주소다. 없으면 emoji 로 얼굴을 대신한다.

CREATE TABLE IF NOT EXISTS life_expense.profile (
    profile_id   integer PRIMARY KEY DEFAULT 1,
    display_name varchar(60),
    email        varchar(200),
    avatar_url   varchar(500),
    -- 'google' · 'kakao' — 비어 있으면 손으로 적은 것
    provider     varchar(20),
    provider_id  varchar(100),
    -- 사진이 없을 때 쓰는 얼굴
    emoji        varchar(8),
    -- 한마디
    bio          varchar(200),
    -- 이 앱을 처음 연 날. 내역보다 뒤일 수 있어 따로 둔다
    joined_on    date,
    created_at   timestamp DEFAULT now(),
    CONSTRAINT ck_profile_single CHECK (profile_id = 1)
);

-- 앱을 어떻게 볼지.
--
-- 화면마다 흩어져 매번 다시 눌러야 하던 것들을 한자리에 모은다. 값은 모두
-- 글자로 담는다 — 나중에 하나 더 늘려도 표를 고칠 일이 없다.
CREATE TABLE IF NOT EXISTS life_expense.app_prefs (
    pref_key   varchar(40) PRIMARY KEY,
    pref_value varchar(200) NOT NULL,
    updated_at timestamp DEFAULT now()
);
