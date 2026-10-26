from sqlalchemy.orm import Session
from app.deps import SessionLocal
from app.routers.entries_scheduled import process_entries_scheduled

def run_entries_scheduled():
    """매분 실행되는 스케줄된 항목 처리 작업

    (잘됐나, 한 줄)을 돌려준다. 등록부가 그것을 그대로 jobs_runs에 적는다
    (app/scheduler/registry.py). 탈은 여기서 삼킨다. 한 바퀴가 터져도
    다음 바퀴는 돌아야 한다.
    """
    db: Session = SessionLocal()
    try:
        count = process_entries_scheduled(db)
        if count > 0:
            print(f"[entries_scheduled] {count}개의 항목이 entries_pending에 등록되었습니다.")
        return True, f"{count}건"
    except Exception as e:
        print(f"[entries_scheduled] 오류 발생: {e}")
        return False, str(e)
    finally:
        db.close()

# 스케줄러는 등록부 하나가 쥔다(app/scheduler/registry.py). 전에는 여기서
# 제 BackgroundScheduler를 세웠는데, 그러면 도는 때를 바깥에서 고칠 길이 없다.
