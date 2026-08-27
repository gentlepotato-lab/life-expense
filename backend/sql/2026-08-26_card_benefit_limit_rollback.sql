-- 2026-08-26_card_benefit_limit.sql 되돌리기.

ALTER TABLE life_expense.card_benefits
    DROP COLUMN IF EXISTS limit_amount;
