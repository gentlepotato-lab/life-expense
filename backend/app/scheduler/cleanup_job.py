from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.deps import SessionLocal
import logging

logger = logging.getLogger(__name__)

def run_monthly_cleanup():
    """
    매월 1회 실행되는 데이터 정리 작업
    - pending_entries 테이블에서 sended=1인 행 삭제 → 전송 완료된 항목

    정기 내역(scheduled_entries)은 더 이상 여기서 지우지 않는다. 아래 주석을
    보라 — is_active의 뜻이 바뀌었다.
    """
    db: Session = SessionLocal()

    try:
        # 1. pending_entries에서 sended=1인 행 삭제
        result_pending = db.execute(text("""
            DELETE FROM life_expense.pending_entries
                WHERE sended = 1
        """))
        deleted_pending = result_pending.rowcount

        # 2. scheduled_entries에서 is_active=0인 행 삭제 — 걷었다(2026-10-01)
        #
        # is_active = 0 은 예전에 "지워진 스케줄"이라는 뜻이었고, 이 자리가
        # 그것을 한 달에 한 번 실제로 지웠다. 이제 그 값은 "감춘 스케줄"을
        # 뜻한다 — 사용자가 잠시 치워 둔 것이고, 끝나는 달이 지나 저절로
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

        db.commit()

        logger.info(f"Monthly cleanup completed: {deleted_pending} pending entries deleted")

    except Exception as e:
        db.rollback()
        logger.error(f"Monthly cleanup failed: {e}")
    finally:
        db.close()


def start_cleanup_scheduler():
    """
    정리 작업 스케줄러 시작
    매월 20일 새벽 2시에 실행
    """
    scheduler = BackgroundScheduler()

    # 매월 20일 새벽 2시
    scheduler.add_job(
        run_monthly_cleanup,
        trigger="cron",
        day=20,
        hour=2,
        minute=0,
        id="monthly_cleanup",
        replace_existing=True
    )

    scheduler.start()
    logger.info("Monthly cleanup scheduler started (runs on day 20 at 02:00)")
