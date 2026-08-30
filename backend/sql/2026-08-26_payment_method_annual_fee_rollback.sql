-- 2026-08-26_payment_method_annual_fee.sql 되돌리기.

ALTER TABLE life_expense.payment_methods
    DROP COLUMN IF EXISTS annual_fee;
