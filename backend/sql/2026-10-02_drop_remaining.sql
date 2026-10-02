-- 정기 내역의 remaining(남은 횟수) 칸을 걷어 낸다.
--
-- 끝나는 때를 횟수로 잡는 길과 연월로 잡는 길 둘을 두었다가, 화면은 연월
-- 하나로 모았다. 그 뒤로 remaining은 화면에서 닿을 수 없는 칸이 되었고,
-- 값이 들어 있는 줄도 하나 없다(22줄 모두 NULL).
--
-- scheduled_entries_end_chk는 remaining과 end_ym이 함께 쓰이지 못하게
-- 막던 것이다. 지킬 칸이 사라지므로 함께 걷는다.

ALTER TABLE life_expense.scheduled_entries
    DROP CONSTRAINT IF EXISTS scheduled_entries_end_chk;

ALTER TABLE life_expense.scheduled_entries
    DROP COLUMN IF EXISTS remaining;
