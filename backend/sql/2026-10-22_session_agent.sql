-- 로그인한 기기와 들어온 자리를 적는 칸.
--
-- admin_sessions 에 칸 둘을 더한다. 2026-10-20_admin_page.sql 에서 만든
-- 표이고, 관리자 자리 말고는 아무 데도 쓰지 않는다.
--
-- 왜 담는가. 같은 기기에서 다시 들어오면 앞서 연 줄이 그대로 남아, 로그인
-- 기록이 같은 기기의 줄로 뒤덮였다. 기기를 가릴 수 있어야 들어올 때 그
-- 기기의 옛 줄만 걷는다(app/routers/admin.py 의 /admin/login).
--
-- 담는 것은 둘뿐이다. 브라우저가 스스로 밝히는 User-Agent 한 줄과, 들어온
-- 자리의 IP다. 이름은 담지 않는다.
--
-- IP 는 앞에 선 nginx 가 X-Real-IP 로 넘겨준다(Gateway 의 snippets/proxy.conf).
-- 그 머리가 없으면 붙은 자리를 그대로 적는데, 그때는 nginx 의 자리가 적힌다.
-- IPv6 가 올 수 있어 45 칸을 둔다.
ALTER TABLE life_expense.admin_sessions
    ADD COLUMN IF NOT EXISTS agent varchar(200);

ALTER TABLE life_expense.admin_sessions
    ADD COLUMN IF NOT EXISTS ip varchar(45);

-- 같은 기기의 줄을 찾는 차례로 걸어 둔다.
CREATE INDEX IF NOT EXISTS ix_admin_sessions_agent
    ON life_expense.admin_sessions (agent);
