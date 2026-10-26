-- 테이블 이름을 상위부터 적는 꼴로 바꾼다.
--
-- 이름이 지어진 때가 저마다 달라 상하위가 이름으로 읽히지 않았다. 규칙은
-- 하나다. 상위 낱말을 앞에 둔다.
--
--   entries           지출 내역이 상위다
--   entries_pending   그 아래 대기
--   entries_scheduled 그 아래 정기
--   entries_groups    그 아래 묶음
--   entries_splits    그 아래 분할
--
-- 테이블 스물하나를 바꾼다. 담긴 것은 한 로우도 움직이지 않는다. RENAME은
-- 이름만 바꾸므로 자료와 인덱스와 외래키가 그대로 남는다.
--
-- 테이블만 바꾸면 제약과 인덱스와 시퀀스와 뷰에 옛 이름이 남는다. 그 넷도
-- 함께 바꾼다. 이름은 카탈로그에서 뽑았으므로 빠뜨린 것이 없다.
--
-- 바꾸기 전에 스키마를 통째로 떠 Desktop/Lab/_backup에 두었다.

BEGIN;

-- 테이블
ALTER TABLE life_expense.scheduled_entry_splits RENAME TO entries_scheduled_splits;
ALTER TABLE life_expense.pending_entry_splits RENAME TO entries_pending_splits;
ALTER TABLE life_expense.payment_method_categories RENAME TO payment_methods_categories;
ALTER TABLE life_expense.counterpart_categories RENAME TO counterparts_categories;
ALTER TABLE life_expense.card_benefit_targets RENAME TO cards_benefits_targets;
ALTER TABLE life_expense.scheduled_entries RENAME TO entries_scheduled;
ALTER TABLE life_expense.pending_entries RENAME TO entries_pending;
ALTER TABLE life_expense.category_goals RENAME TO categories_goals;
ALTER TABLE life_expense.admin_sessions RENAME TO sessions_admin;
ALTER TABLE life_expense.doodle_items RENAME TO doodles;
ALTER TABLE life_expense.card_benefits RENAME TO cards_benefits;
ALTER TABLE life_expense.entry_groups RENAME TO entries_groups;
ALTER TABLE life_expense.entry_splits RENAME TO entries_splits;
ALTER TABLE life_expense.action_logs RENAME TO logs_action;
ALTER TABLE life_expense.job_schedules RENAME TO jobs_schedules;
ALTER TABLE life_expense.chart_cards RENAME TO charts_cards;
ALTER TABLE life_expense.card_tiers RENAME TO cards_tiers;
ALTER TABLE life_expense.site_prefs RENAME TO prefs_site;
ALTER TABLE life_expense.app_prefs RENAME TO prefs_app;
ALTER TABLE life_expense.job_runs RENAME TO jobs_runs;
ALTER TABLE life_expense.profile RENAME TO profiles;

-- 제약
ALTER TABLE life_expense.logs_action RENAME CONSTRAINT action_logs_kind_chk TO logs_action_kind_chk;
ALTER TABLE life_expense.logs_action RENAME CONSTRAINT action_logs_pkey TO logs_action_pkey;
ALTER TABLE life_expense.sessions_admin RENAME CONSTRAINT admin_sessions_pkey TO sessions_admin_pkey;
ALTER TABLE life_expense.prefs_app RENAME CONSTRAINT app_prefs_pkey TO prefs_app_pkey;
ALTER TABLE life_expense.cards_benefits_targets RENAME CONSTRAINT card_benefit_targets_benefit_id_fkey TO cards_benefits_targets_benefit_id_fkey;
ALTER TABLE life_expense.cards_benefits_targets RENAME CONSTRAINT card_benefit_targets_pkey TO cards_benefits_targets_pkey;
ALTER TABLE life_expense.cards_benefits RENAME CONSTRAINT card_benefits_pkey TO cards_benefits_pkey;
ALTER TABLE life_expense.cards_benefits RENAME CONSTRAINT card_benefits_tier_id_fkey TO cards_benefits_tier_id_fkey;
ALTER TABLE life_expense.cards_tiers RENAME CONSTRAINT card_tiers_method_id_fkey TO cards_tiers_method_id_fkey;
ALTER TABLE life_expense.cards_tiers RENAME CONSTRAINT card_tiers_pkey TO cards_tiers_pkey;
ALTER TABLE life_expense.categories_goals RENAME CONSTRAINT category_goals_cat1_id_fkey TO categories_goals_cat1_id_fkey;
ALTER TABLE life_expense.categories_goals RENAME CONSTRAINT category_goals_cat2_id_fkey TO categories_goals_cat2_id_fkey;
ALTER TABLE life_expense.categories_goals RENAME CONSTRAINT category_goals_cat3_id_fkey TO categories_goals_cat3_id_fkey;
ALTER TABLE life_expense.categories_goals RENAME CONSTRAINT category_goals_end_ym_chk TO categories_goals_end_ym_chk;
ALTER TABLE life_expense.categories_goals RENAME CONSTRAINT category_goals_pkey TO categories_goals_pkey;
ALTER TABLE life_expense.categories_goals RENAME CONSTRAINT category_goals_start_ym_chk TO categories_goals_start_ym_chk;
ALTER TABLE life_expense.categories_goals RENAME CONSTRAINT category_goals_ym_order_chk TO categories_goals_ym_order_chk;
ALTER TABLE life_expense.categories_goals RENAME CONSTRAINT ck_category_goals_path TO ck_categories_goals_path;
ALTER TABLE life_expense.charts_cards RENAME CONSTRAINT chart_cards_pkey TO charts_cards_pkey;
ALTER TABLE life_expense.counterparts_categories RENAME CONSTRAINT counterpart_categories_pkey TO counterparts_categories_pkey;
ALTER TABLE life_expense.doodles RENAME CONSTRAINT doodle_items_kind_chk TO doodles_kind_chk;
ALTER TABLE life_expense.doodles RENAME CONSTRAINT doodle_items_pkey TO doodles_pkey;
ALTER TABLE life_expense.entries_groups RENAME CONSTRAINT entry_groups_pkey TO entries_groups_pkey;
ALTER TABLE life_expense.entries_splits RENAME CONSTRAINT entry_splits_amount_positive TO entries_splits_amount_positive;
ALTER TABLE life_expense.entries_splits RENAME CONSTRAINT entry_splits_counterpart_fk TO entries_splits_counterpart_fk;
ALTER TABLE life_expense.entries_splits RENAME CONSTRAINT entry_splits_entry_fk TO entries_splits_entry_fk;
ALTER TABLE life_expense.entries_splits RENAME CONSTRAINT entry_splits_pkey TO entries_splits_pkey;
ALTER TABLE life_expense.entries_splits RENAME CONSTRAINT entry_splits_type_valid TO entries_splits_type_valid;
ALTER TABLE life_expense.jobs_runs RENAME CONSTRAINT job_runs_pkey TO jobs_runs_pkey;
ALTER TABLE life_expense.jobs_schedules RENAME CONSTRAINT job_schedules_kind_chk TO jobs_schedules_kind_chk;
ALTER TABLE life_expense.jobs_schedules RENAME CONSTRAINT job_schedules_pkey TO jobs_schedules_pkey;
ALTER TABLE life_expense.jobs_schedules RENAME CONSTRAINT job_schedules_time_chk TO jobs_schedules_time_chk;
ALTER TABLE life_expense.payment_methods_categories RENAME CONSTRAINT payment_method_categories_pkey TO payment_methods_categories_pkey;
ALTER TABLE life_expense.entries_pending RENAME CONSTRAINT pending_entries_pkey TO entries_pending_pkey;
ALTER TABLE life_expense.entries_pending RENAME CONSTRAINT pending_entries_schedule_id_fkey TO entries_pending_schedule_id_fkey;
ALTER TABLE life_expense.entries_pending_splits RENAME CONSTRAINT pending_entry_splits_amount_positive TO entries_pending_splits_amount_positive;
ALTER TABLE life_expense.entries_pending_splits RENAME CONSTRAINT pending_entry_splits_counterpart_fk TO entries_pending_splits_counterpart_fk;
ALTER TABLE life_expense.entries_pending_splits RENAME CONSTRAINT pending_entry_splits_pending_fk TO entries_pending_splits_pending_fk;
ALTER TABLE life_expense.entries_pending_splits RENAME CONSTRAINT pending_entry_splits_pkey TO entries_pending_splits_pkey;
ALTER TABLE life_expense.entries_pending_splits RENAME CONSTRAINT pending_entry_splits_type_valid TO entries_pending_splits_type_valid;
ALTER TABLE life_expense.profiles RENAME CONSTRAINT ck_profile_single TO ck_profiles_single;
ALTER TABLE life_expense.profiles RENAME CONSTRAINT profile_pkey TO profiles_pkey;
ALTER TABLE life_expense.entries_scheduled RENAME CONSTRAINT scheduled_entries_cat1_id_fkey TO entries_scheduled_cat1_id_fkey;
ALTER TABLE life_expense.entries_scheduled RENAME CONSTRAINT scheduled_entries_cat2_id_fkey TO entries_scheduled_cat2_id_fkey;
ALTER TABLE life_expense.entries_scheduled RENAME CONSTRAINT scheduled_entries_cat3_id_fkey TO entries_scheduled_cat3_id_fkey;
ALTER TABLE life_expense.entries_scheduled RENAME CONSTRAINT scheduled_entries_interval_chk TO entries_scheduled_interval_chk;
ALTER TABLE life_expense.entries_scheduled RENAME CONSTRAINT scheduled_entries_pay_method_fkey TO entries_scheduled_pay_method_fkey;
ALTER TABLE life_expense.entries_scheduled RENAME CONSTRAINT scheduled_entries_pkey TO entries_scheduled_pkey;
ALTER TABLE life_expense.entries_scheduled RENAME CONSTRAINT scheduled_entries_place_id_fkey TO entries_scheduled_place_id_fkey;
ALTER TABLE life_expense.entries_scheduled RENAME CONSTRAINT scheduled_entries_ym_chk TO entries_scheduled_ym_chk;
ALTER TABLE life_expense.entries_scheduled_splits RENAME CONSTRAINT scheduled_entry_splits_amount_positive TO entries_scheduled_splits_amount_positive;
ALTER TABLE life_expense.entries_scheduled_splits RENAME CONSTRAINT scheduled_entry_splits_counterpart_fk TO entries_scheduled_splits_counterpart_fk;
ALTER TABLE life_expense.entries_scheduled_splits RENAME CONSTRAINT scheduled_entry_splits_pkey TO entries_scheduled_splits_pkey;
ALTER TABLE life_expense.entries_scheduled_splits RENAME CONSTRAINT scheduled_entry_splits_schedule_fk TO entries_scheduled_splits_schedule_fk;
ALTER TABLE life_expense.entries_scheduled_splits RENAME CONSTRAINT scheduled_entry_splits_type_valid TO entries_scheduled_splits_type_valid;
ALTER TABLE life_expense.prefs_site RENAME CONSTRAINT site_prefs_pkey TO prefs_site_pkey;

-- 인덱스(제약이 받치지 않는 것)
ALTER INDEX life_expense.ix_action_logs_kind_name RENAME TO ix_logs_action_kind_name;
ALTER INDEX life_expense.ix_action_logs_when RENAME TO ix_logs_action_when;
ALTER INDEX life_expense.ix_admin_sessions_agent RENAME TO ix_sessions_admin_agent;
ALTER INDEX life_expense.ix_admin_sessions_expires RENAME TO ix_sessions_admin_expires;
ALTER INDEX life_expense.ix_card_benefit_targets_benefit RENAME TO ix_cards_benefits_targets_benefit;
ALTER INDEX life_expense.ix_card_benefits_tier RENAME TO ix_cards_benefits_tier;
ALTER INDEX life_expense.ix_card_tiers_method RENAME TO ix_cards_tiers_method;
ALTER INDEX life_expense.ix_category_goals_sort RENAME TO ix_categories_goals_sort;
ALTER INDEX life_expense.ux_category_goals_target RENAME TO ux_categories_goals_target;
ALTER INDEX life_expense.ix_chart_cards_sort RENAME TO ix_charts_cards_sort;
ALTER INDEX life_expense.counterpart_categories_name_uniq RENAME TO counterparts_categories_name_uniq;
ALTER INDEX life_expense.ix_doodle_items_live RENAME TO ix_doodles_live;
ALTER INDEX life_expense.entry_splits_entry_idx RENAME TO entries_splits_entry_idx;
ALTER INDEX life_expense.ix_entry_splits_counterpart RENAME TO ix_entries_splits_counterpart;
ALTER INDEX life_expense.ix_job_runs_key RENAME TO ix_jobs_runs_key;
ALTER INDEX life_expense.payment_method_categories_name_uniq RENAME TO payment_methods_categories_name_uniq;
ALTER INDEX life_expense.pending_entry_splits_pending_idx RENAME TO entries_pending_splits_pending_idx;
ALTER INDEX life_expense.scheduled_entry_splits_schedule_idx RENAME TO entries_scheduled_splits_schedule_idx;

-- 시퀀스
ALTER SEQUENCE life_expense.action_logs_log_id_seq RENAME TO logs_action_log_id_seq;
ALTER SEQUENCE life_expense.card_benefit_targets_target_id_seq RENAME TO cards_benefits_targets_target_id_seq;
ALTER SEQUENCE life_expense.card_benefits_benefit_id_seq RENAME TO cards_benefits_benefit_id_seq;
ALTER SEQUENCE life_expense.card_tiers_tier_id_seq RENAME TO cards_tiers_tier_id_seq;
ALTER SEQUENCE life_expense.category_goals_goal_id_seq RENAME TO categories_goals_goal_id_seq;
ALTER SEQUENCE life_expense.counterpart_categories_category_id_seq RENAME TO counterparts_categories_category_id_seq;
ALTER SEQUENCE life_expense.entry_groups_group_id_seq RENAME TO entries_groups_group_id_seq;
ALTER SEQUENCE life_expense.entry_splits_split_id_seq RENAME TO entries_splits_split_id_seq;
ALTER SEQUENCE life_expense.job_runs_run_id_seq RENAME TO jobs_runs_run_id_seq;
ALTER SEQUENCE life_expense.payment_method_categories_category_id_seq RENAME TO payment_methods_categories_category_id_seq;
ALTER SEQUENCE life_expense.pending_entries_entry_id_seq RENAME TO entries_pending_entry_id_seq;
ALTER SEQUENCE life_expense.pending_entry_splits_split_id_seq RENAME TO entries_pending_splits_split_id_seq;
ALTER SEQUENCE life_expense.scheduled_entries_schedule_id_seq RENAME TO entries_scheduled_schedule_id_seq;
ALTER SEQUENCE life_expense.scheduled_entry_splits_split_id_seq RENAME TO entries_scheduled_splits_split_id_seq;

-- 뷰
ALTER VIEW life_expense.v_pending_entries_net RENAME TO v_entries_pending_net;
ALTER VIEW life_expense.v_scheduled_entries_net RENAME TO v_entries_scheduled_net;

-- 딸린 이름이 테이블 이름으로 시작하게 맞춘다. 이름만 바뀐다.
ALTER INDEX life_expense.ix_pending_group RENAME TO ix_entries_pending_group;
ALTER INDEX life_expense.ix_pending_schedule RENAME TO ix_entries_pending_schedule;
ALTER INDEX life_expense.ix_pending_sended RENAME TO ix_entries_pending_sended;
ALTER INDEX life_expense.ix_scheduled_group RENAME TO ix_entries_scheduled_group;
ALTER INDEX life_expense.ix_scheduled_next_run RENAME TO ix_entries_scheduled_next_run;

ALTER TABLE life_expense.entries_pending RENAME CONSTRAINT fk_pending_group TO fk_entries_pending_group;
ALTER TABLE life_expense.entries_scheduled RENAME CONSTRAINT fk_scheduled_group TO fk_entries_scheduled_group;
ALTER TABLE life_expense.payment_methods RENAME CONSTRAINT uq_payment_method_name TO uq_payment_methods_name;
ALTER TABLE life_expense.places RENAME CONSTRAINT uniq_place_lat_lng TO uniq_places_lat_lng;


COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 롤백. 2026-10-26_table_naming_rollback.sql
-- ═══════════════════════════════════════════════════════════════
