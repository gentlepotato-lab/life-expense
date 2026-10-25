import requests
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date
from calendar import monthrange
from app.deps import get_db
from app.models import Holiday
from app.routers.action_logs import 바깥적기
import os
import time
import xml.etree.ElementTree as ET
import urllib.parse

router = APIRouter()

KASI_KEY = os.getenv("KASI_API_KEY")

# 기록에 적는 이름. 관리자 사이트의 외부 API 목록과 같은 글이어야 한다
# (app/routers/admin.py의 바깥들).
특일정보 = "한국천문연구원 특일 정보"


# 공휴일을 묻는 자리.
특일정보주소 = (
    "http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo"
)


def 특일정보URL(year: int, month: int, 열쇠: str | None) -> str:
    """
    그 달을 묻는 주소.

    열쇠를 주면 붙이고 주지 않으면 뺀 채로 만든다. 기록에 적는 쪽이 뺀 것을
    쓴다(app/routers/action_logs.py의 바깥적기). 주소를 두 번 적지 않으려고
    한 곳에서 짓는다. 두 곳에 적으면 물음표 뒤가 언젠가 어긋난다.
    """
    묶음 = [
        f"pageNo=1",
        f"numOfRows=100",
        f"solYear={year}",
        f"solMonth={month:02d}",
    ]
    if 열쇠:
        묶음.insert(0, f"serviceKey={열쇠}")
    return f"{특일정보주소}?{'&'.join(묶음)}"


def fetch_kasi_holidays(year: int, month: int):
    """공공데이터에서 그 달의 공휴일을 받는다.

    (성공 여부, 목록)을 돌려준다. 성공 여부를 따로 두는 까닭은 "조회 실패"와
    "그 달에 공휴일이 없음"을 구분해야 하기 때문이다. 둘을 같게 보면 API가
    멈춘 날 설날이나 추석이 평일로 저장되고, 정기 내역의 휴일 처리가 통째로
    어긋난다.
    """
    url = 특일정보URL(year, month, KASI_KEY)
    
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

    조회를 먼저 하고 성공했을 때만 테이블을 고친다. 예전에는 반대였다. 월 전체를
    주말만 휴일로 되돌려 커밋한 다음 API 결과로 덮었는데, 그 사이 조회가
    실패하면 덮을 것이 없어 이미 알고 있던 공휴일까지 평일로 남았다.
    """
    print(f"\n[update_holidays_core] Starting update for {year}-{month:02d}")
    days = monthrange(year, month)[1]

    # 바깥에 묻는 자리라 걸린 시간과 결과를 적는다. 관리자 사이트의 외부 API가
    # 이것을 센다(app/routers/action_logs.py의 바깥적기). 적는 일은 탈을
    # 삼키므로 여기서 더 살필 것이 없다.
    잰때 = time.monotonic()
    ok, items = fetch_kasi_holidays(year, month)
    바깥적기(
        db,
        특일정보,
        f"{year}-{month:02d} 공휴일 받기",
        int((time.monotonic() - 잰때) * 1000),
        200 if ok else 500,
        "GET",
        # 열쇠만 빼고 보낸 그대로 적는다. 물음표 뒤의 solYear 와 solMonth 가
        # 어느 달을 물었는지를 말한다.
        특일정보URL(year, month, None),
    )

    if not ok:
        # 조회가 안 되면 알고 있던 것을 그대로 둔다. 다만 아직 한 줄도 없는
        # 달이면 주말만이라도 채운다. 있던 값을 덮지는 않는다.
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

    # (2) 받은 공휴일만 True로 override
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
