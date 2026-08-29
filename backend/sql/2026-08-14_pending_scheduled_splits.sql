-- ═══════════════════════════════════════════════════════════════
-- 금액 쪼개기를 Pending / Scheduled로 확장
-- 2026-08-14
-- ─────────────────────────────────────────────────────────────
-- 내역은 다음 순서로 흘러간다.
--
--     scheduled_entries ──(스케줄러)──> pending_entries ──(전송)──> entries
--
-- entry_splits는 entries를 가리키는 FK라서 앞단에서는 쓸 수 없다.
-- 각 단계에 같은 모양의 표를 하나씩 두고, 내역이 다음 단계로 넘어갈 때
-- 분할도 함께 복사한다. 그래야 매달 나가는 지출의 "N빵" 설정을
-- 한 번만 해 두면 계속 따라온다.
--
-- 추가만 한다(Expand). 기존 표는 손대지 않으므로 되돌리기는
-- 맨 아래 롤백 구문뿐이다.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1) Pending 단계의 분할 ───────────────────────────────────
CREATE TABLE IF NOT EXISTS life_expense.pending_entry_splits (
    split_id       serial        PRIMARY KEY,
    pending_id     integer       NOT NULL,
    amount         numeric(14,2) NOT NULL,
    split_type     varchar(20)   NOT NULL DEFAULT 'reimbursed',
    counterpart_id integer,
    memo           varchar(200),
    created_at     timestamp     NOT NULL DEFAULT now(),
    updated_at     timestamp,

    CONSTRAINT pending_entry_splits_pending_fk
        FOREIGN KEY (pending_id)
        REFERENCES life_expense.pending_entries (entry_id)
        ON DELETE CASCADE,

    CONSTRAINT pending_entry_splits_counterpart_fk
        FOREIGN KEY (counterpart_id)
        REFERENCES life_expense.counterparts (counterpart_id)
        ON DELETE SET NULL,

    CONSTRAINT pending_entry_splits_amount_positive
        CHECK (amount > 0),

    CONSTRAINT pending_entry_splits_type_valid
        CHECK (split_type IN ('reimbursed', 'shared', 'business', 'other'))
);

CREATE INDEX IF NOT EXISTS pending_entry_splits_pending_idx
    ON life_expense.pending_entry_splits (pending_id);

-- ─── 2) Scheduled 단계의 분할(템플릿) ─────────────────────────
CREATE TABLE IF NOT EXISTS life_expense.scheduled_entry_splits (
    split_id       serial        PRIMARY KEY,
    schedule_id    integer       NOT NULL,
    amount         numeric(14,2) NOT NULL,
    split_type     varchar(20)   NOT NULL DEFAULT 'reimbursed',
    counterpart_id integer,
    memo           varchar(200),
    created_at     timestamp     NOT NULL DEFAULT now(),
    updated_at     timestamp,

    CONSTRAINT scheduled_entry_splits_schedule_fk
        FOREIGN KEY (schedule_id)
        REFERENCES life_expense.scheduled_entries (schedule_id)
        ON DELETE CASCADE,

    CONSTRAINT scheduled_entry_splits_counterpart_fk
        FOREIGN KEY (counterpart_id)
        REFERENCES life_expense.counterparts (counterpart_id)
        ON DELETE SET NULL,

    CONSTRAINT scheduled_entry_splits_amount_positive
        CHECK (amount > 0),

    CONSTRAINT scheduled_entry_splits_type_valid
        CHECK (split_type IN ('reimbursed', 'shared', 'business', 'other'))
);

CREATE INDEX IF NOT EXISTS scheduled_entry_splits_schedule_idx
    ON life_expense.scheduled_entry_splits (schedule_id);

-- ─── 3) 실지출 조회용 뷰 ──────────────────────────────────────
-- entries 쪽 v_entries_net과 같은 모양으로 맞춘다.
CREATE OR REPLACE VIEW life_expense.v_pending_entries_net AS
SELECT
    p.entry_id,
    p.amount                                        AS gross_amount,
    COALESCE(s.split_amount, 0)::numeric(14,2)      AS split_amount,
    (p.amount - COALESCE(s.split_amount, 0))::numeric(14,2) AS net_amount,
    COALESCE(s.split_count, 0)                      AS split_count
FROM life_expense.pending_entries p
LEFT JOIN (
    SELECT pending_id,
           SUM(amount)  AS split_amount,
           COUNT(*)     AS split_count
    FROM life_expense.pending_entry_splits
    GROUP BY pending_id
) s ON s.pending_id = p.entry_id;

CREATE OR REPLACE VIEW life_expense.v_scheduled_entries_net AS
SELECT
    e.schedule_id,
    e.amount                                        AS gross_amount,
    COALESCE(s.split_amount, 0)::numeric(14,2)      AS split_amount,
    (e.amount - COALESCE(s.split_amount, 0))::numeric(14,2) AS net_amount,
    COALESCE(s.split_count, 0)                      AS split_count
FROM life_expense.scheduled_entries e
LEFT JOIN (
    SELECT schedule_id,
           SUM(amount)  AS split_amount,
           COUNT(*)     AS split_count
    FROM life_expense.scheduled_entry_splits
    GROUP BY schedule_id
) s ON s.schedule_id = e.schedule_id;

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 롤백
--   DROP VIEW  IF EXISTS life_expense.v_scheduled_entries_net;
--   DROP VIEW  IF EXISTS life_expense.v_pending_entries_net;
--   DROP TABLE IF EXISTS life_expense.scheduled_entry_splits;
--   DROP TABLE IF EXISTS life_expense.pending_entry_splits;
-- ═══════════════════════════════════════════════════════════════
