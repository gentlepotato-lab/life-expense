import requests
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date
from calendar import monthrange
from app.deps import get_db
from app.models import Holiday
import os
import xml.etree.ElementTree as ET
import urllib.parse

router = APIRouter()

KASI_KEY = os.getenv("KASI_API_KEY")

def fetch_kasi_holidays(year: int, month: int):
    url = (
        "http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/"
        "getRestDeInfo"
        f"?serviceKey={KASI_KEY}"
        f"&pageNo=1"
        f"&numOfRows=100"
        f"&solYear={year}"
        f"&solMonth={month:02d}"
    )
    
    print(f"[fetch_kasi_holidays] Fetching holidays for {year}-{month:02d}")
    print(f"[fetch_kasi_holidays] URL: {url}")

    r = requests.get(url)
    text = r.text.strip()

    # 1) JSON 시도
    try:
        js = r.json()
        items = js["response"]["body"].get("items")
        if not items:
            return []
        items = items.get("item", [])
        if isinstance(items, dict):
            items = [items]
        result = []
        for it in items:
            dt = it["locdate"]
            d = date(int(dt[:4]), int(dt[4:6]), int(dt[6:8]))
            result.append((d, it.get("dateName")))
        return result
    except:
        pass

    # 2) XML fallback
    try:
        root = ET.fromstring(text)
        items = []
        for it in root.iter("item"):
            locdate = it.findtext("locdate")
            name = it.findtext("dateName")
            if locdate:
                d = date(int(locdate[:4]), int(locdate[4:6]), int(locdate[6:8]))
                items.append((d, name))
        return items
    except Exception as e:
        print(f"[fetch_kasi_holidays] JSON/XML 파싱 실패: {str(e)}")
        print(f"[fetch_kasi_holidays] Response text: {text[:500]}")
        return []

# ----------------------------
# 핵심 업데이트 로직 → 스케줄러 + API 공동 사용
# ----------------------------
def update_holidays_core(db: Session, year: int, month: int):
    print(f"\n[update_holidays_core] Starting update for {year}-{month:02d}")
    days = monthrange(year, month)[1]

    # (1) 월 전체 날짜 insert 또는 update
    for day in range(1, days + 1):
        d = date(year, month, day)
        weekday = d.weekday()

        row = db.query(Holiday).filter(Holiday.dt == d).first()
        is_weekend = 1 if weekday in (5, 6) else 0  # 토(5), 일(6)

        if row:
            # 기존 row 업데이트 (휴일은 아래에서 다시 정확하게 덮어씀)
            row.year = year
            row.month = month
            row.day = day
            row.weekday = weekday

            # 기본: 주말이면 1, 평일이면 0
            row.is_holiday = is_weekend
            row.holiday_name = None
        else:
            row = Holiday(
                dt=d,
                year=year,
                month=month,
                day=day,
                weekday=weekday,
                is_holiday=is_weekend,
                holiday_name=None
            )
            db.add(row)

    db.commit()

    # (2) 공공데이터 API → 공휴일만 True로 override
    items = fetch_kasi_holidays(year, month)
    print(f"[update_holidays_core] Fetched {len(items)} holidays from API")

    for d, name in items:
        print(f"[update_holidays_core] Setting holiday: {d} - {name}")
        row = db.query(Holiday).filter(Holiday.dt == d).first()
        if row:
            row.is_holiday = 1
            row.holiday_name = name
        else:
            print(f"[update_holidays_core] WARNING: Holiday date {d} not found in DB")

    db.commit()
    print(f"[update_holidays_core] Successfully updated holidays for {year}-{month:02d}\n")


# ----------------------------
# 휴일 조회 엔드포인트
# ----------------------------
@router.get("")
def get_holidays(year: int, month: int, db: Session = Depends(get_db)):
    """특정 년/월의 휴일 정보 조회"""
    holidays = db.query(Holiday).filter(
        Holiday.year == year,
        Holiday.month == month
    ).all()
    
    return [{
        "dt": str(h.dt),
        "year": h.year,
        "month": h.month,
        "day": h.day,
        "weekday": h.weekday,
        "is_holiday": h.is_holiday,
        "holiday_name": h.holiday_name
    } for h in holidays]

# ----------------------------
# 수동 실행용 엔드포인트
# ----------------------------
@router.get("/update")
def update_holidays(year: int, month: int, db: Session = Depends(get_db)):
    update_holidays_core(db, year, month)
    return {"status": "ok", "updated": f"{year}-{month:02d}"}
