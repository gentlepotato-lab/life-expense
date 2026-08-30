-- 2026-08-30_chart_card_span.sql 되돌리기.

ALTER TABLE life_expense.chart_cards
    DROP COLUMN IF EXISTS span;
