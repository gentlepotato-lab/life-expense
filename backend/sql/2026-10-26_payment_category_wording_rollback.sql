-- 2026-10-26_payment_category_wording.sql 되돌리기.
--
-- 이름을 `계좌·현금`으로 되돌린다. 담긴 값 하나만 바뀌므로 잃는 것은 없다.

BEGIN;

UPDATE life_expense.payment_method_categories
   SET name = '계좌·현금'
     , updated_at = now()
 WHERE name = '현금';

COMMIT;
