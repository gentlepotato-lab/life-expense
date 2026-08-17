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
    - scheduled_entries 테이블에서 is_active=0인 행 삭제 → 비활성화된 스케줄
    """
    db: Session = SessionLocal()
    
    try:
        # 1. pending_entries에서 sended=1인 행 삭제
        result_pending = db.execute(text("""
            DELETE FROM life_expense.pending_entries
                WHERE sended = 1
        """))
        deleted_pending = result_pending.rowcount
        
        # 2. scheduled_entries에서 is_active=0인 행 삭제
        result_scheduled = db.execute(text("""
            DELETE FROM life_expense.scheduled_entries
                WHERE is_active = 0
        """))
        deleted_scheduled = result_scheduled.rowcount
        
        db.commit()
        
        logger.info(f"Monthly cleanup completed: {deleted_pending} pending entries, {deleted_scheduled} scheduled entries deleted")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Monthly cleanup failed: {e}")
    finally:
        db.close()


def start_cleanup_scheduler():
    """
    정리 작업 스케줄러 시작
    매월 1일 새벽 2시에 실행
    """
    scheduler = BackgroundScheduler()
    
    # 매월 1일 새벽 2시
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
    logger.info("Monthly cleanup scheduler started (runs on day 1 at 02:00)")
