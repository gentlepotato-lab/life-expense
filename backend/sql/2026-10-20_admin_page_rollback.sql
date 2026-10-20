-- 2026-10-20_admin_page.sql 되돌리기.
--
-- 다섯을 통째로 지운다. 기존 테이블은 애초에 건드리지 않았으므로 되돌릴
-- 것이 없다 — 이 파일만 돌리면 관리자 페이지가 생기기 전으로 돌아간다.
--
-- 지우면 함께 사라지는 것:
--   꺼 놓은 메뉴 목록과 관리자 암호(site_prefs)
--   적어 놓은 공지사항 전부(notices)
--   켜고 끈 애니메이션 문구 설정(doodle_items)
--   쌓인 행동 기록 전부(action_logs)
--   로그인한 자리(admin_sessions)
--
-- 문구 설정이 사라져도 화면은 멀쩡하다. 못 받아 오면 코드에 있는 열 가지를
-- 쓰도록 짰기 때문이다. 꺼 놓은 메뉴도 목록이 비면 전부 켜짐이 된다.

DROP TABLE IF EXISTS life_expense.admin_sessions;

DROP TABLE IF EXISTS life_expense.action_logs;

DROP TABLE IF EXISTS life_expense.doodle_items;

DROP TABLE IF EXISTS life_expense.notices;

DROP TABLE IF EXISTS life_expense.site_prefs;
