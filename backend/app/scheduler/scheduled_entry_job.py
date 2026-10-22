from sqlalchemy.orm import Session
from app.deps import SessionLocal
from app.routers.scheduled_entries import process_scheduled_entries

def run_scheduled_entries():
    """매분 실행되는 스케줄된 항목 처리 작업

    (잘됐나, 한 줄)을 돌려준다. 등록부가 그것을 그대로 job_runs에 적는다
    (app/scheduler/registry.py). 탈은 여기서 삼킨다 — 한 바퀴가 터져도
    다음 바퀴는 돌아야 한다.
    """
    db: Session = SessionLocal()
    try:
        count = process_scheduled_entries(db)
        if count > 0:
            print(f"[ScheduledEntries] {count}개의 항목이 PendingEntries에 등록되었습니다.")
        return True, f"{count}건"
    except Exception as e:
        print(f"[ScheduledEntries] 오류 발생: {e}")
        return False, str(e)
    finally:
        db.close()

# 스케줄러는 등록부 하나가 쥔다(app/scheduler/registry.py). 전에는 여기서
# 제 BackgroundScheduler를 세웠는데, 그러면 도는 때를 바깥에서 고칠 길이 없다.
