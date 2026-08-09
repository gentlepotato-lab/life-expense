from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from datetime import datetime
from app.deps import SessionLocal
from app.routers.scheduled_entries import process_scheduled_entries

def run_scheduled_entries():
    """매분 실행되는 스케줄된 항목 처리 작업"""
    db: Session = SessionLocal()
    try:
        count = process_scheduled_entries(db)
        if count > 0:
            print(f"[ScheduledEntries] {count}개의 항목이 PendingEntries에 등록되었습니다.")
    except Exception as e:
        print(f"[ScheduledEntries] 오류 발생: {e}")
    finally:
        db.close()

def start_scheduled_entry_scheduler():
    """스케줄러 시작"""
    scheduler = BackgroundScheduler()
    
    # 매분 실행
    scheduler.add_job(
        run_scheduled_entries,
        trigger="cron",
        minute="*",  # 매분
        id="scheduled_entry_processor",
        replace_existing=True,
        misfire_grace_time=60  # 60초까지 지연 허용 (was missed 경고 방지)
    )
    
    scheduler.start()
    print("[ScheduledEntries] 스케줄러가 시작되었습니다.")