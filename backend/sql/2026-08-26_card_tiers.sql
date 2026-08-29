-- 카드 실적 구간과 그 구간의 혜택.
--
-- 구간 하나에 혜택이 여럿 붙으므로 표를 둘로 나눈다. 한 행에 혜택을 몰아
-- 담으면(콤마로 이은 글) 나중에 하나만 고치거나 순서를 바꿀 수가 없다.
--
-- 실적은 조회하는 달에 그 카드로 그은 금액(N빵 전 결제액)을 그대로 센다.
-- 카드사가 실적에서 빼는 항목(세금·상품권 등)은 종잡을 수 없어 두지 않는다 —
-- 어림잡아 보는 용도다.

CREATE TABLE IF NOT EXISTS life_expense.card_tiers (
    tier_id    serial PRIMARY KEY,
    method_id  integer NOT NULL
               REFERENCES life_expense.payment_methods(method_id) ON DELETE CASCADE,
    threshold  numeric(14,2) NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_card_tiers_method
    ON life_expense.card_tiers (method_id, sort_order);

-- content는 혜택 항목의 이름, memo는 그 옆에 적는 상세다.
-- 이름만으로는 "커피 할인"이 어느 가게에서 얼마인지가 남지 않는다.
CREATE TABLE IF NOT EXISTS life_expense.card_benefits (
    benefit_id serial PRIMARY KEY,
    tier_id    integer NOT NULL
               REFERENCES life_expense.card_tiers(tier_id) ON DELETE CASCADE,
    content      varchar(200) NOT NULL,
    memo         varchar(200),
    -- 월간 통합 할인한도. 없는 혜택도 있어 비울 수 있다.
    limit_amount numeric(14,2),
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_card_benefits_tier
    ON life_expense.card_benefits (tier_id, sort_order);

-- 혜택 하나가 걸리는 대상. "디지털 구독 할인" 아래에
--   OTT   → 넷플릭스, 유튜브프리미엄 …
--   음원  → 멜론, 지니
-- 처럼 영역과 가맹점이 짝으로 붙는다. 영역 구분이 없는 혜택도 있어 area는 비울 수 있다.
CREATE TABLE IF NOT EXISTS life_expense.card_benefit_targets (
    target_id  serial PRIMARY KEY,
    benefit_id integer NOT NULL
               REFERENCES life_expense.card_benefits(benefit_id) ON DELETE CASCADE,
    area       varchar(60),
    stores     varchar(400) NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_card_benefit_targets_benefit
    ON life_expense.card_benefit_targets (benefit_id, sort_order);
