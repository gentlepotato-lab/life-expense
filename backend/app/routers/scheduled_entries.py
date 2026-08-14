from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text, func
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
import calendar
from app.deps import SessionDep
from app.models import ScheduledEntry, Holiday, PendingEntry, Place
from app.schemas import ScheduledEntryIn, ScheduledEntryOut, ScheduledEntryUpdate

router = APIRouter()

@router.get("")
def list_scheduled_entries(db: SessionDep = Depends()):
    """모든 스케줄된 항목 조회"""
    rows = db.query(ScheduledEntry).filter(ScheduledEntry.is_active == 1).all()

    # 화면에서 장소 이름을 보여 주기 위해 한 번에 조회해 매핑한다
    place_ids = {r.place_id for r in rows if r.place_id}
    place_names = {}
    if place_ids:
        for p in db.query(Place).filter(Place.place_id.in_(place_ids)).all():
            place_names[p.place_id] = p.place_name

    result = []
    for r in rows:
        result.append({
            "schedule_id": r.schedule_id,
            "day_of_month": r.day_of_month,
            "hour": r.hour,
            "minute": r.minute,
            "holiday_handling": r.holiday_handling,
            "next_run_at": str(r.next_run_at) if r.next_run_at else None,
            "cat1_id": r.cat1_id,
            "cat2_id": r.cat2_id,
            "cat3_id": r.cat3_id,
            "inout": r.inout,
            "amount": float(r.amount),
            "pay_method": r.pay_method,
            "memo": r.memo,
            "place_id": r.place_id,
            "place_name": place_names.get(r.place_id),
            "is_active": r.is_active,
            "created_at": str(r.created_at),
            "updated_at": str(r.updated_at) if r.updated_at else None,
        })
    return result

@router.post("")
def create_scheduled_entry(payload: ScheduledEntryIn, db: SessionDep = Depends()):
    """새 스케줄 항목 생성"""
    if not (1 <= payload.day_of_month <= 31):
        raise HTTPException(status_code=400, detail="day_of_month must be 1-31")
    if not (0 <= payload.hour <= 23):
        raise HTTPException(status_code=400, detail="hour must be 0-23")
    if not (0 <= payload.minute <= 59):
        raise HTTPException(status_code=400, detail="minute must be 0-59")
    if payload.holiday_handling not in ['before', 'on', 'after']:
        raise HTTPException(status_code=400, detail="holiday_handling must be 'before', 'on', or 'after'")
    
    # next_run_at 계산
    next_run_at = calculate_next_run_at(
        payload.day_of_month,
        payload.hour,
        payload.minute,
        payload.holiday_handling,
        db
    )
    
    new_schedule = ScheduledEntry(
        day_of_month=payload.day_of_month,
        hour=payload.hour,
        minute=payload.minute,
        holiday_handling=payload.holiday_handling,
        next_run_at=next_run_at,
        cat1_id=payload.cat1_id,
        cat2_id=payload.cat2_id,
        cat3_id=payload.cat3_id,
        inout=payload.inout,
        amount=payload.amount,
        pay_method=payload.pay_method,
        memo=payload.memo,
        place_id=payload.place_id,
        is_active=payload.is_active,
    )
    db.add(new_schedule)
    db.commit()
    db.refresh(new_schedule)
    return {"status": "ok", "schedule_id": new_schedule.schedule_id}

@router.put("/{schedule_id}")
def update_scheduled_entry(schedule_id: int, payload: ScheduledEntryUpdate, db: SessionDep = Depends()):
    """스케줄 항목 수정"""
    schedule = db.query(ScheduledEntry).filter(ScheduledEntry.schedule_id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    
    # next_run_at이 명시적으로 제공되지 않았고, 
    # day_of_month, hour, minute, holiday_handling 중 하나라도 변경되면 next_run_at 재계산
    if 'next_run_at' not in update_data and any(key in update_data for key in ['day_of_month', 'hour', 'minute', 'holiday_handling']):
        # 변경된 값 또는 기존 값 사용
        day = update_data.get('day_of_month', schedule.day_of_month)
        hour = update_data.get('hour', schedule.hour)
        minute = update_data.get('minute', schedule.minute)
        handling = update_data.get('holiday_handling', schedule.holiday_handling)
        
        update_data['next_run_at'] = calculate_next_run_at(day, hour, minute, handling, db)
    
    for key, value in update_data.items():
        setattr(schedule, key, value)
    
    db.commit()
    return {"status": "ok"}

@router.delete("/{schedule_id}")
def delete_scheduled_entry(schedule_id: int, db: SessionDep = Depends()):
    """스케줄 항목 삭제 → 비활성화"""
    schedule = db.query(ScheduledEntry).filter(ScheduledEntry.schedule_id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    schedule.is_active = 0
    db.commit()
    return {"status": "ok"}

def find_nearest_non_holiday(target_date: date, holiday_handling: str, db: Session) -> date:
    """휴일이 아닌 가장 가까운 날짜 찾기"""
    def is_holiday_date(d: date) -> bool:
        """주어진 날짜가 휴일인지 확인 (Holiday 테이블 또는 weekday 기반)"""
        h = db.query(Holiday).filter(Holiday.dt == d).first()
        if h:
            # Holiday 테이블에 데이터가 있으면 그 값 사용
            return h.is_holiday == 1
        else:
            # Holiday 테이블에 데이터가 없으면 주말(토요일=5, 일요일=6) 여부로 판단
            return d.weekday() in (5, 6)
    
    # target_date가 휴일인지 확인
    if not is_holiday_date(target_date):
        # 휴일이 아니면 그대로 반환
        return target_date
    
    # 휴일인 경우
    if holiday_handling == 'on':
        # 당일 처리 (휴일이어도 그대로)
        return target_date
    elif holiday_handling == 'before':
        # 휴일 전 가장 가까운 평일 찾기
        current = target_date
        for _ in range(30):  # 최대 30일 전까지 검색
            current = current - timedelta(days=1)
            if not is_holiday_date(current):
                return current
        return target_date  # 못 찾으면 원래 날짜 반환
    else:  # 'after'
        # 휴일 후 가장 가까운 평일 찾기
        current = target_date
        for _ in range(30):  # 최대 30일 후까지 검색
            current = current + timedelta(days=1)
            if not is_holiday_date(current):
                return current
        return target_date  # 못 찾으면 원래 날짜 반환

def calculate_next_run_at(
    day_of_month: int,
    hour: int,
    minute: int,
    holiday_handling: str,
    db: Session,
    base_date: date | None = None
) -> datetime:
    """
    다음 실행 일시를 계산하여 반환
    base_date가 None이면 오늘 날짜 기준으로 계산
    
    ★ 로직 순서 (중요):
    1. 원래 설정 날짜(day_of_month)가 과거인지 체크 (휴일 처리 전)
    2. 과거라면 다음 달로 이동
    3. 그 다음 휴일 처리 적용
    """
    now = datetime.now()
    if base_date is None:
        base_date = now.date()
    
    # 1단계: 이번 달의 원래 스케줄된 날짜 계산
    try:
        scheduled_date = date(base_date.year, base_date.month, day_of_month)
    except ValueError:
        # 유효하지 않은 날짜 (예: 2월 30일) - 다음 달로 이동
        if base_date.month == 12:
            scheduled_date = date(base_date.year + 1, 1, min(day_of_month, 31))
        else:
            next_month = base_date.month + 1
            scheduled_date = date(base_date.year, next_month, min(day_of_month, 31))
    
    # 2단계: 원래 날짜(휴일 처리 전)가 현재 시간보다 과거인지 체크
    scheduled_datetime = datetime.combine(scheduled_date, datetime.min.time().replace(hour=hour, minute=minute))
    
    if scheduled_datetime <= now:
        # 다음 달로 이동
        if scheduled_date.month == 12:
            scheduled_date = date(scheduled_date.year + 1, 1, day_of_month)
        else:
            try:
                scheduled_date = date(scheduled_date.year, scheduled_date.month + 1, day_of_month)
            except ValueError:
                # 유효하지 않은 날짜 (예: 2월 30일)
                last_day = calendar.monthrange(scheduled_date.year, scheduled_date.month + 1)[1]
                scheduled_date = date(scheduled_date.year, scheduled_date.month + 1, min(day_of_month, last_day))
    
    # 3단계: 휴일 처리 적용하여 실제 실행 날짜 결정
    target_date = find_nearest_non_holiday(scheduled_date, holiday_handling, db)
    
    # 4단계: 최종 DateTime 반환
    target_datetime = datetime.combine(target_date, datetime.min.time().replace(hour=hour, minute=minute))
    
    return target_datetime

def process_scheduled_entries(db: Session):
    """스케줄된 항목들을 처리하여 PendingEntries에 등록"""
    now = datetime.now()
    
    # 활성화된 스케줄 중 next_run_at이 현재 시간 이하인 것 모두 조회
    schedules = db.query(ScheduledEntry).filter(
        ScheduledEntry.is_active == 1,
        ScheduledEntry.next_run_at.isnot(None),
        ScheduledEntry.next_run_at <= now
    ).all()
    
    created_count = 0
    
    for schedule in schedules:
        # 중복 방지 확인
        target_date = schedule.next_run_at.date()
        existing = db.query(PendingEntry).filter(
            PendingEntry.tx_date == target_date,
            PendingEntry.cat1_id == schedule.cat1_id,
            PendingEntry.cat2_id == schedule.cat2_id,
            PendingEntry.amount == schedule.amount,
            PendingEntry.sended == 0
        ).first()
        
        if existing:
            # 다음 실행 일시 재계산 (한 달 후)
            schedule.next_run_at = calculate_next_run_at(
                schedule.day_of_month,
                schedule.hour,
                schedule.minute,
                schedule.holiday_handling,
                db,
                base_date=schedule.next_run_at.date() + timedelta(days=32)
            )
            continue
        
        # PendingEntry 생성
        new_pending = PendingEntry(
            tx_date=target_date,
            cat1_id=schedule.cat1_id,
            cat2_id=schedule.cat2_id,
            cat3_id=schedule.cat3_id,
            inout=schedule.inout,
            amount=schedule.amount,
            pay_method=schedule.pay_method,
            memo=schedule.memo,
            place_id=schedule.place_id,
            sended=0,
        )
        db.add(new_pending)
        created_count += 1
        
        # 다음 실행 일시 재계산 (한 달 후)
        schedule.next_run_at = calculate_next_run_at(
            schedule.day_of_month,
            schedule.hour,
            schedule.minute,
            schedule.holiday_handling,
            db,
            base_date=schedule.next_run_at.date() + timedelta(days=32)
        )
    
    if created_count > 0:
        db.commit()
    
    return created_count

@router.post("/migrate-next-run-at")
def migrate_next_run_at(db: SessionDep = Depends()):
    """기존 스케줄의 next_run_at을 계산하여 업데이트"""
    schedules = db.query(ScheduledEntry).filter(
        ScheduledEntry.is_active == 1,
        ScheduledEntry.next_run_at.is_(None)
    ).all()
    
    updated = 0
    for schedule in schedules:
        schedule.next_run_at = calculate_next_run_at(
            schedule.day_of_month,
            schedule.hour,
            schedule.minute,
            schedule.holiday_handling,
            db
        )
        updated += 1
    
    db.commit()
    return {"status": "ok", "updated": updated}