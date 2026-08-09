from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dotenv import load_dotenv
load_dotenv()

from app.routers import entries, meta, places, payment_methods, pending_entries, holidays, scheduled_entries, superset
from app.scheduler.holiday_job import start_scheduler
from app.scheduler.scheduled_entry_job import start_scheduled_entry_scheduler
from app.scheduler.cleanup_job import start_cleanup_scheduler
from app.deps import engine
from sqlalchemy import text

app = FastAPI(title="Expense Management System")

@app.on_event("startup")
def add_inout_columns():
    """앱 시작 시 categories_lvl2 테이블에 inout 컬럼 추가 및 categories_lvl3에서 제거"""
    try:
        with engine.connect() as conn:
            # categories_lvl2에 inout 컬럼 추가
            conn.execute(text("""
                ALTER TABLE life_expense.categories_lvl2
                ADD COLUMN IF NOT EXISTS inout SMALLINT NULL
            """))
            
            # categories_lvl3에서 inout 컬럼 제거 (이미 제거되어 있을 수 있음)
            conn.execute(text("""
                ALTER TABLE life_expense.categories_lvl3
                DROP COLUMN IF EXISTS inout
            """))
            
            conn.commit()
            print("✅ categories_lvl2 테이블에 inout 컬럼이 추가되었고, categories_lvl3 테이블에서 inout 컬럼이 제거되었습니다.")
    except Exception as e:
        print(f"⚠️ 컬럼 작업 중 오류 (이미 적용되어 있을 수 있음): {e}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meta.router, prefix="/meta", tags=["meta"])
app.include_router(payment_methods.router, prefix="/meta", tags=["payment_methods"])
app.include_router(entries.router, prefix="/entries", tags=["entries"])
app.include_router(pending_entries.router, prefix="/pending-entries", tags=["pending_entries"])
app.include_router(places.router, prefix="/api/places", tags=["places"])
app.include_router(holidays.router, prefix="/holidays", tags=["holidays"])
app.include_router(scheduled_entries.router, prefix="/scheduled-entries", tags=["scheduled_entries"])
app.include_router(superset.router, prefix="/superset", tags=["superset"])

# 앱 실행 시 스케줄러 시작
start_scheduler()
start_scheduled_entry_scheduler()
start_cleanup_scheduler()