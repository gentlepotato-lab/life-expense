-- 2026-08-26_card_tiers.sql 되돌리기.
-- 가리키는 쪽부터 지운다 — 대상 → 혜택 → 구간.

DROP TABLE IF EXISTS life_expense.card_benefit_targets;
DROP TABLE IF EXISTS life_expense.card_benefits;
DROP TABLE IF EXISTS life_expense.card_tiers;
