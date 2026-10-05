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
    """공공데이터에서 그 달의 공휴일을 받는다.

    (성공 여부, 목록)을 돌려준다. 성공 여부를 따로 두는 까닭은 "조회 실패"와
    "그 달에 공휴일이 없음"을 구분해야 하기 때문이다. 둘을 같게 보면 API가
    멈춘 날 설날이나 추석이 평일로 저장되고, 정기 내역의 휴일 처리가 통째로
    어긋난다.
    """
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

    # 응답이 없으면 무한정 기다리지 않는다. 스케줄러가 매일 부르는 자리라
    # 한 번 묶이면 그 작업이 통째로 멈춘다.
    try:
        r = requests.get(url, timeout=10)
    except requests.RequestException as e:
        print(f"[fetch_kasi_holidays] 조회 실패: {str(e)}")
        return False, []

    if r.status_code != 200:
        print(f"[fetch_kasi_holidays] 조회 실패: HTTP {r.status_code}")
        return False, []

    text = r.text.strip()

    # 1) JSON 시도
    try:
        js = r.json()
        items = js["response"]["body"].get("items")
        if not items:
            return True, []
        items = items.get("item", [])
        if isinstance(items, dict):
            items = [items]
        result = []
        for it in items:
            dt = it["locdate"]
            d = date(int(dt[:4]), int(dt[4:6]), int(dt[6:8]))
            result.append((d, it.get("dateName")))
        return True, result
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
        return True, items
    except Exception as e:
        print(f"[fetch_kasi_holidays] JSON/XML 파싱 실패: {str(e)}")
        print(f"[fetch_kasi_holidays] Response text: {text[:500]}")
        return False, []

# ----------------------------
# 핵심 업데이트 로직 → 스케줄러 + API 공동 사용
# ----------------------------
def update_holidays_core(db: Session, year: int, month: int) -> bool:
    """그 달의 휴일을 다시 적재한다. 반영했으면 True.

    조회를 먼저 하고 성공했을 때만 표를 고친다. 예전에는 반대였다. 월 전체를
    주말만 휴일로 되돌려 커밋한 다음 API 결과로 덮었는데, 그 사이 조회가
    실패하면 덮을 것이 없어 이미 알고 있던 공휴일까지 평일로 남았다.
    """
    print(f"\n[update_holidays_core] Starting update for {year}-{month:02d}")
    days = monthrange(year, month)[1]

    ok, items = fetch_kasi_holidays(year, month)

    if not ok:
        # 조회가 안 되면 알고 있던 것을 그대로 둔다. 다만 아직 한 줄도 없는
        # 달이면 주말만이라도 채워 둔다. 있던 값을 덮지는 않는다.
        has_row = db.query(Holiday).filter(
            Holiday.year == year, Holiday.month == month
        ).first()
        if not has_row:
            for day in range(1, days + 1):
                d = date(year, month, day)
                weekday = d.weekday()
                db.add(Holiday(
                    dt=d, year=year, month=month, day=day, weekday=weekday,
                    is_holiday=1 if weekday in (5, 6) else 0,
                    holiday_name=None,
                ))
            db.commit()
            print(f"[update_holidays_core] 조회 실패. 주말만 채웠다 {year}-{month:02d}")
        else:
            print(f"[update_holidays_core] 조회 실패. 기존 값을 그대로 둔다 {year}-{month:02d}")
        return False

    # (1) 월 전체 날짜 insert 또는 update
    for day in range(1, days + 1):
        d = date(year, month, day)
        weekday = d.weekday()

        row = db.query(Holiday).filter(Holiday.dt == d).first()
        is_weekend = 1 if weekday in (5, 6) else 0  # 토(5), 일(6)

        if row:
            # 기존 row 업데이트(휴일은 아래에서 다시 정확하게 덮어씀)
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

    # (2) 받아 둔 공휴일만 True로 override
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
    return True


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
    ok = update_holidays_core(db, year, month)
    # 조회가 안 되면 알려 준다. ok로만 돌려주면 공휴일이 빠진 채로
    # 반영된 줄 알게 된다.
    return {
        "status": "ok" if ok else "fetch_failed",
        "updated": f"{year}-{month:02d}",
    }
