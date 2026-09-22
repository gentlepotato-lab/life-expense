-- 2026-09-22_card_benefit_wording.sql 되돌리기.
-- 이름만 되돌린다 — 담긴 값은 건드린 적이 없다.

ALTER TABLE life_expense.card_benefits
    RENAME COLUMN description TO memo;

ALTER TABLE life_expense.card_benefit_targets
    RENAME COLUMN detail TO stores;
