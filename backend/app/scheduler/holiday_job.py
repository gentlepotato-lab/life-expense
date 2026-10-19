from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from datetime import datetime
from app.deps import SessionLocal
from app.routers.holidays import update_holidays_core

def run_holiday_update():
    """
    매일 실행되는 휴일 업데이트 작업으로,
    다음 달까지 미리 적재하도록 구성

    조회가 실패해도 세션은 반드시 닫는다. 예전에는 close가 try 밖에 있어
    공공데이터 API가 멈춘 날마다 커넥션이 하나씩 남았다.
    """
    db: Session = SessionLocal()

    try:
        today = datetime.now()
        year = today.year
        month = today.month

        # 이번 달
        ok_now = update_holidays_core(db, year, month)

        # 다음 달까지 미리 적재
        if month == 12:
            ok_next = update_holidays_core(db, year + 1, 1)
        else:
            ok_next = update_holidays_core(db, year, month + 1)

        if not (ok_now and ok_next):
            # 다음 날 다시 돌면서 채운다. 그때까지는 알고 있던 값을 쓴다.
            print("[run_holiday_update] 조회 실패한 달이 있다. 다음 실행에서 다시 받는다.")
    except Exception as e:
        print(f"[run_holiday_update] 실패: {str(e)}")
    finally:
        db.close()


def start_scheduler():
    scheduler = BackgroundScheduler()

    # 매일 오전 9시 20분
    scheduler.add_job(run_holiday_update,
                      trigger="cron",
                      hour=9,
                      minute=20,
                      id="holiday_update_daily",
                      replace_existing=True)

    scheduler.start()
