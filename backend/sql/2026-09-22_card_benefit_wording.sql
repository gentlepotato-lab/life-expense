-- 카드 혜택의 두 글칸 이름을 화면 말과 맞춘다.
--
-- ① card_benefits.memo → description
--    메모가 아니라 그 혜택이 무엇인지 적는 설명이다. 메모는 이 판에서
--    "쓰는 사람이 덧붙이는 한마디"를 뜻해 왔는데(entries.memo 등), 이 칸은
--    카드사가 적어 둔 내용을 옮겨 적는 자리라 뜻이 어긋났다.
--
-- ② card_benefit_targets.stores → detail
--    처음에는 가맹점만 적을 자리로 보고 이름 붙였는데 담긴 것은 더 넓다 —
--    `아파트 관리비, 도시가스, 전기요금`처럼 요금 종류가 들어가기도 하고
--    `편의점(GS25/CU), 다이소, 올리브영, 스타벅스 자동 충전`처럼 가게와
--    결제 방식이 섞여 있기도 하다. 그 영역에서 무엇이 걸리는지를 적는 칸이다.
--
-- 이름만 바뀌고 담긴 값은 그대로다.

ALTER TABLE life_expense.card_benefits
    RENAME COLUMN memo TO description;

ALTER TABLE life_expense.card_benefit_targets
    RENAME COLUMN stores TO detail;
