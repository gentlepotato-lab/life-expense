from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dotenv import load_dotenv
load_dotenv()

from app.routers import (
    categories,
    charts,
    counterparts,
    entries,
    goals,
    holidays,
    payment_methods,
    pending_entries,
    places,
    profile,
    scheduled_entries,
    splits,
)
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
            
            # categories_lvl3에서 inout 컬럼 제거(이미 제거되어 있을 수 있음)
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

# API는 모두 /api 아래로 모은다.
#
# 전에는 /meta, /entries처럼 루트를 쓰고 있었다. 그래서 화면(SPA)을 루트에 올리면
# 라우트와 API가 부딪혀, 화면을 /app/으로 밀어 둘 수밖에 없었다.
# 여기 한 자리로 모으면서 그 제약이 풀린다.
#
# 판(v1, v2 …)은 나누지 않는다. 쓰는 사람이 하나뿐이라 갈래를 늘릴 이유가 없고,
# 갈라 두면 고칠 때마다 두 곳을 손봐야 한다.
API = "/api"

# 규칙 — 한 자원은 한 자리, 한 파일, 한 화면을 갖는다.
#
#   /api/categories        categories.py         Categories.tsx
#   /api/payment-methods   payment_methods.py    PaymentMethods.tsx
#   /api/counterparts      counterparts.py       Counterparts.tsx
#   /api/entries           entries.py            Entries.tsx
#   /api/pending-entries   pending_entries.py    PendingEntries.tsx
#   /api/scheduled-entries scheduled_entries.py  ScheduledEntries.tsx
#   /api/places            places.py             components/PlacePicker.tsx
#   /api/holidays          holidays.py           (화면 없음)
#
# 자리는 여기 한 곳에서만 붙인다. 라우터 파일 안에서 또 붙이지 않는다.
# 예전에는 분류·결제 수단·상대가 /api/meta 라는 껍데기 밑에 묶여 있었는데,
# 셋 다 어엿한 자원이라 그 껍데기를 없앴다.
app.include_router(categories.router, prefix=f"{API}/categories", tags=["categories"])
app.include_router(payment_methods.router, prefix=f"{API}/payment-methods", tags=["payment_methods"])
app.include_router(counterparts.router, prefix=f"{API}/counterparts", tags=["counterparts"])
app.include_router(goals.router, prefix=f"{API}/goals", tags=["goals"])
app.include_router(charts.router, prefix=f"{API}/charts", tags=["charts"])
app.include_router(profile.router, prefix=f"{API}/profile", tags=["profile"])
app.include_router(entries.router, prefix=f"{API}/entries", tags=["entries"])
app.include_router(pending_entries.router, prefix=f"{API}/pending-entries", tags=["pending_entries"])
app.include_router(scheduled_entries.router, prefix=f"{API}/scheduled-entries", tags=["scheduled_entries"])
app.include_router(places.router, prefix=f"{API}/places", tags=["places"])
app.include_router(holidays.router, prefix=f"{API}/holidays", tags=["holidays"])

# 금액 쪼개기 — 세 자원에 똑같이 /{id}/splits로 붙는다.
app.include_router(splits.router, prefix=f"{API}/entries", tags=["splits"])
app.include_router(splits.pending_router, prefix=f"{API}/pending-entries", tags=["splits"])
app.include_router(splits.scheduled_router, prefix=f"{API}/scheduled-entries", tags=["splits"])

# 앱 실행 시 스케줄러 시작
start_scheduler()
start_scheduled_entry_scheduler()
start_cleanup_scheduler()
