-- 씀씀이 화면의 그림 카드 — 차례와 켜짐.
--
-- 그림 자체는 코드가 들고 있고 표에는 열쇠와 차례만 담는다. 그래야 그림을
-- 새로 만들거나 고쳐도 표를 건드릴 일이 없다. 표에 없는 열쇠는 코드가 적어
-- 둔 차례 그대로 맨 뒤에 선다.
--
-- 결제 수단의 구분(payment_method_categories)과 같은 꼴이다.

CREATE TABLE IF NOT EXISTS life_expense.chart_cards (
    card_key   varchar(40) PRIMARY KEY,
    sort_order integer NOT NULL DEFAULT 0,
    is_active  smallint NOT NULL DEFAULT 1,
    created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_chart_cards_sort
    ON life_expense.chart_cards (sort_order, card_key);
