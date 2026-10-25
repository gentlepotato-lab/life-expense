from sqlalchemy.orm import Session
from sqlalchemy import text
from app.deps import SessionLocal
import logging

logger = logging.getLogger(__name__)

def run_monthly_cleanup():
    """
    매월 1회 실행되는 데이터 정리 작업
    - pending_entries 테이블에서 sended=1인 행 삭제 → 전송 완료된 항목
    - action_logs에서 90일이 지난 행 삭제 → 관리자 사이트가 보는 기록
    - admin_sessions에서 90일이 지나 닫힌 행 삭제 → 로그인 기록

    정기 내역(scheduled_entries)은 더 이상 여기서 지우지 않는다. 아래 주석을
    보라. is_active의 뜻이 바뀌었다.
    """
    db: Session = SessionLocal()

    try:
        # 1. pending_entries에서 sended=1인 행 삭제
        result_pending = db.execute(text("""
            DELETE FROM life_expense.pending_entries
                WHERE sended = 1
        """))
        deleted_pending = result_pending.rowcount

        # 2. scheduled_entries에서 is_active=0인 행 삭제, 걷었다(2026-10-01)
        #
        # is_active = 0 은 예전에 "지워진 스케줄"이라는 뜻이었고, 이 자리가
        # 그것을 한 달에 한 번 실제로 지웠다. 이제 그 값은 "감춘 스케줄"을
        # 뜻한다. 사용자가 잠시 치운 것이고, 끝나는 달이 지나 저절로
        # 감춰진 것도 여기 든다. 그대로 두면 감춘 항목이 20일마다 소리 없이
        # 사라진다.
        #
        # 지우는 일은 이제 DELETE /api/scheduled-entries/{id} 한 곳에서만
        # 일어난다. 되살릴 여지를 두지 않고 그 자리에서 아주 지운다.
        #
        # result_scheduled = db.execute(text("""
        #     DELETE FROM life_expense.scheduled_entries
        #         WHERE is_active = 0
        # """))
        # deleted_scheduled = result_scheduled.rowcount

        # 3. action_logs에서 90일이 지난 행 삭제
        #
        # 대시보드가 묻는 기간은 길어야 석 달이다. 그보다 오래된 줄은 아무도
        # 보지 않으면서 테이블만 불린다. 지우는 차례가 ix_action_logs_when의
        # 첫 칸과 같아 훑는 값도 싸다.
        result_logs = db.execute(text("""
            DELETE FROM life_expense.action_logs
                WHERE created_at < now() - interval '90 days'
        """))
        deleted_logs = result_logs.rowcount

        # 4. admin_sessions에서 90일이 지나 닫힌 줄 삭제
        #
        # 그 줄이 곧 로그인 기록이라 들어올 때마다 걷지 않는다. 닫힌 줄만
        # 지우므로 열려 있는 기기는 건드리지 않는다. 날수는 액션 기록과 같은
        # 90일로 둔다. 관리자 쪽이 두 기록을 나란히 보여 주는데, 한쪽만 더
        # 오래 남으면 같은 기간을 보는 것이 아니게 된다.
        result_sessions = db.execute(text("""
            DELETE FROM life_expense.admin_sessions
                WHERE expires_at <= now()
                  AND created_at < now() - interval '90 days'
        """))
        deleted_sessions = result_sessions.rowcount

        db.commit()

        logger.info(
            f"Monthly cleanup completed: {deleted_pending} pending entries, "
            f"{deleted_logs} action logs, {deleted_sessions} sessions deleted"
        )

        return True, f"{deleted_pending + deleted_logs + deleted_sessions}건 지움"

    except Exception as e:
        db.rollback()
        logger.error(f"Monthly cleanup failed: {e}")
        return False, str(e)
    finally:
        db.close()


# 스케줄러는 등록부 하나가 쥔다(app/scheduler/registry.py). 전에는 여기서
# 제 BackgroundScheduler를 세웠는데, 그러면 도는 때를 바깥에서 고칠 길이 없다.
