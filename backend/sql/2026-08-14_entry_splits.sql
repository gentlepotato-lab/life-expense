-- ═══════════════════════════════════════════════════════════════
-- 금액 쪼개기 — 지출 중 돌려받은 몫을 분리한다
-- 2026-08-14
-- ─────────────────────────────────────────────────────────────
-- 설계 요지
--   · entries.amount 는 "내가 실제로 결제한 총액" 그대로 둔다.
--     과거 데이터의 의미가 바뀌지 않고, 기존 조회도 그대로 동작한다.
--   · 돌려받은 몫은 entry_splits 에 따로 쌓는다.
--     실지출(net) = entries.amount - COALESCE(SUM(entry_splits.amount), 0)
--   · 분할은 자기 자신을 다시 쪼갤 수 없으므로 깊이 1 이 구조적으로 보장된다.
--
-- 이 스크립트는 추가만 한다(Expand). 기존 테이블을 수정하지 않으므로
-- 되돌리려면 맨 아래 롤백 구문 두 줄이면 된다.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1) 상대 — 돈을 돌려준 사람/조직 ──────────────────────────
CREATE TABLE IF NOT EXISTS life_expense.counterparts (
    counterpart_id serial       PRIMARY KEY,
    name           varchar(100) NOT NULL,
    memo           varchar(200),
    sort_order     integer      NOT NULL DEFAULT 0,
    is_active      smallint     NOT NULL DEFAULT 1,
    created_at     timestamp    NOT NULL DEFAULT now(),
    updated_at     timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS counterparts_name_uniq
    ON life_expense.counterparts (name);

-- ─── 2) 분할 내역 ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS life_expense.entry_splits (
    split_id       serial        PRIMARY KEY,
    entry_id       integer       NOT NULL,
    amount         numeric(14,2) NOT NULL,
    split_type     varchar(20)   NOT NULL DEFAULT 'reimbursed',
    counterpart_id integer,
    memo           varchar(200),
    created_at     timestamp     NOT NULL DEFAULT now(),
    updated_at     timestamp,

    CONSTRAINT entry_splits_entry_fk
        FOREIGN KEY (entry_id)
        REFERENCES life_expense.entries (entry_id)
        ON DELETE CASCADE,          -- 내역이 지워지면 분할도 함께 사라진다

    CONSTRAINT entry_splits_counterpart_fk
        FOREIGN KEY (counterpart_id)
        REFERENCES life_expense.counterparts (counterpart_id)
        ON DELETE SET NULL,         -- 상대를 지워도 분할 금액은 남는다

    CONSTRAINT entry_splits_amount_positive
        CHECK (amount > 0),

    CONSTRAINT entry_splits_type_valid
        CHECK (split_type IN ('reimbursed', 'shared', 'business', 'other'))
);

CREATE INDEX IF NOT EXISTS entry_splits_entry_idx
    ON life_expense.entry_splits (entry_id);

-- ─── 3) 실지출 조회용 뷰 ──────────────────────────────────────
-- 애플리케이션과 향후 리포트가 같은 정의를 쓰도록 한 곳에 둔다.
CREATE OR REPLACE VIEW life_expense.v_entries_net AS
SELECT
    e.entry_id,
    e.amount                                        AS gross_amount,
    COALESCE(s.split_amount, 0)::numeric(14,2)      AS split_amount,
    (e.amount - COALESCE(s.split_amount, 0))::numeric(14,2) AS net_amount,
    COALESCE(s.split_count, 0)                      AS split_count
FROM life_expense.entries e
LEFT JOIN (
    SELECT entry_id,
           SUM(amount)  AS split_amount,
           COUNT(*)     AS split_count
    FROM life_expense.entry_splits
    GROUP BY entry_id
) s ON s.entry_id = e.entry_id;

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 롤백
--   DROP VIEW  IF EXISTS life_expense.v_entries_net;
--   DROP TABLE IF EXISTS life_expense.entry_splits;
--   DROP TABLE IF EXISTS life_expense.counterparts;
-- ═══════════════════════════════════════════════════════════════
