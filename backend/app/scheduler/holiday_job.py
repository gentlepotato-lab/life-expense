from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from datetime import datetime
from app.deps import SessionLocal
from app.routers.holidays import update_holidays_core

def run_holiday_update():
    """
    매일 실행되는 휴일 업데이트 작업으로,
    다음 달까지 미리 적재하도록 구성
    """
    db: Session = SessionLocal()

    today = datetime.now()
    year = today.year
    month = today.month

    # 이번 달
    update_holidays_core(db, year, month)

    # 다음 달까지 미리 적재
    if month == 12:
        update_holidays_core(db, year + 1, 1)
    else:
        update_holidays_core(db, year, month + 1)

    db.close()


def start_scheduler():
    scheduler = BackgroundScheduler()

    # 매일 새벽 1시
    scheduler.add_job(run_holiday_update,
                      trigger="cron",
                      hour=9,
                      minute=20,
                      id="holiday_update_daily",
                      replace_existing=True)

    scheduler.start()
