from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text, func
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
import calendar
from app.deps import SessionDep
from app.models import (
    ScheduledEntry, Holiday, PendingEntry, Place,
    ScheduledEntrySplit, PendingEntrySplit,
)
from app.schemas import ScheduledEntryIn, ScheduledEntryOut, ScheduledEntryUpdate
from app.routers.splits import copy_splits

router = APIRouter()

# `말일`을 가리키는 day_of_month 값.
#
# 달마다 끝 날이 달라 하나의 숫자로는 적을 수 없다. 1~31 바깥의 값을 하나
# 정해 두고 셈할 때 그 달의 끝 날로 바꿔 쓴다. 0이 아니라 32인 것은, 0이
# 화면 쪽에서 "안 고름"과 구별되지 않기 때문이다.
LAST_DAY = 32


def day_in_month(year: int, month: int, day_of_month: int) -> int:
    """그 달에서 실제로 쓸 날. 말일이면 그 달의 끝 날로 바꾼다."""
    if day_of_month >= LAST_DAY:
        return calendar.monthrange(year, month)[1]
    return day_of_month

@router.get("")
def list_scheduled_entries(
    include_hidden: int = Query(0),
    db: SessionDep = Depends(),
):
    """모든 스케줄된 항목 조회

    감춘 항목은 기본으로 빼고 준다. 달력 · 씀씀이 · 잔소리도 이 길을 쓰는데,
    감춘 것은 앞으로 안 오는 것이라 거기에 섞이면 안 된다. 정기 내역 화면만
    `감춘 항목 보기`를 켰을 때 include_hidden으로 함께 받아 간다.
    """
    q = db.query(ScheduledEntry)
    if not include_hidden:
        q = q.filter(ScheduledEntry.is_active == 1)
    rows = q.all()

    # 화면에서 장소 이름을 보여 주기 위해 한 번에 조회해 매핑한다.
    place_ids = {r.place_id for r in rows if r.place_id}
    place_names = {}
    if place_ids:
        for p in db.query(Place).filter(Place.place_id.in_(place_ids)).all():
            place_names[p.place_id] = p.place_name

    # 분할 합계도 한 번에 모은다(스케줄은 건수가 적어 단순 집계로 충분하다).
    split_agg: dict[int, tuple[float, int]] = {}
    # 달력이 "함께한 상대"로 걸러 낼 때 쓸 상대 ID도 함께 모은다.
    cp_agg: dict[int, list[int]] = {}
    for s in db.query(ScheduledEntrySplit).all():
        amt, cnt = split_agg.get(s.schedule_id, (0.0, 0))
        split_agg[s.schedule_id] = (amt + float(s.amount), cnt + 1)
        if s.counterpart_id is not None:
            ids = cp_agg.setdefault(s.schedule_id, [])
            if s.counterpart_id not in ids:
                ids.append(s.counterpart_id)

    result = []
    for r in rows:
        split_amount, split_count = split_agg.get(r.schedule_id, (0.0, 0))
        result.append({
            "split_amount": split_amount,
            "net_amount": float(r.amount) - split_amount,
            "split_count": split_count,
            "counterpart_ids": cp_agg.get(r.schedule_id, []),
            "schedule_id": r.schedule_id,
            "day_of_month": r.day_of_month,
            "hour": r.hour,
            "minute": r.minute,
            "holiday_handling": r.holiday_handling,
            "interval_months": r.interval_months,
            "anchor_ym": r.anchor_ym,
            "end_ym": r.end_ym,
            "remaining": r.remaining,
            "skip_ym": r.skip_ym,
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
            "perf_exclude": r.perf_exclude,
            "fixed_flag": r.fixed_flag,
            "is_active": r.is_active,
            "created_at": str(r.created_at),
            "updated_at": str(r.updated_at) if r.updated_at else None,
        })
    return result

@router.post("")
def create_scheduled_entry(payload: ScheduledEntryIn, db: SessionDep = Depends()):
    """새 스케줄 항목 생성"""
    if not (1 <= payload.day_of_month <= LAST_DAY):
        raise HTTPException(
            status_code=400,
            detail=f"day_of_month must be 1-31 or {LAST_DAY}(말일)",
        )
    if not (0 <= payload.hour <= 23):
        raise HTTPException(status_code=400, detail="hour must be 0-23")
    if not (0 <= payload.minute <= 59):
        raise HTTPException(status_code=400, detail="minute must be 0-59")
    if payload.holiday_handling not in ['before', 'on', 'after']:
        raise HTTPException(status_code=400, detail="holiday_handling must be 'before', 'on', or 'after'")
    validate_span(
        payload.interval_months, payload.anchor_ym, payload.end_ym,
        payload.remaining, payload.skip_ym,
    )

    # 격월 이상인데 첫 달을 안 적어 주면 이 달을 첫 달로 삼는다. 박자를
    # 정할 것이 없으면 주기가 뜻을 잃기 때문이다.
    anchor_ym = payload.anchor_ym
    if payload.interval_months > 1 and not anchor_ym:
        today = datetime.now().date()
        anchor_ym = _ym(today.year, today.month)

    # next_run_at 계산
    next_run_at = calculate_next_run_span(
        payload.day_of_month,
        payload.hour,
        payload.minute,
        payload.holiday_handling,
        db,
        interval_months=payload.interval_months,
        anchor_ym=anchor_ym,
        end_ym=payload.end_ym,
        skip_ym=payload.skip_ym,
    )

    new_schedule = ScheduledEntry(
        day_of_month=payload.day_of_month,
        hour=payload.hour,
        minute=payload.minute,
        holiday_handling=payload.holiday_handling,
        interval_months=payload.interval_months,
        anchor_ym=anchor_ym,
        end_ym=payload.end_ym,
        remaining=payload.remaining,
        skip_ym=payload.skip_ym,
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

@router.put("/{schedule_id}/perf-exclude")
def set_perf_exclude(schedule_id: int, value: int = Query(...), db: SessionDep = Depends()):
    """카드 실적에서 뺄지를 켜고 끈다. 지출 · 대기와 같은 자리다.

    여기서 켜 두면 이 스케줄이 대기 내역으로 나갈 때마다 표가 따라간다.
    """
    result = db.execute(text("""
        UPDATE life_expense.scheduled_entries
           SET perf_exclude = :v
         WHERE schedule_id = :id
    """), {"v": 1 if value else 0, "id": schedule_id})
    db.commit()
    return {"status": "ok", "updated": result.rowcount}

@router.put("/{schedule_id}/fixed")
def set_fixed(schedule_id: int, value: str = Query(...), db: SessionDep = Depends()):
    """이 건이 고정인지 변동인지를 손으로 정한다. 지출 내역과 같은 자리다."""
    v = None if value == "" else (1 if value in ("1", "true", "fixed") else 0)
    result = db.execute(text("""
        UPDATE life_expense.scheduled_entries
           SET fixed_flag = :v
         WHERE schedule_id = :id
    """), {"v": v, "id": schedule_id})
    db.commit()
    return {"status": "ok", "updated": result.rowcount}

@router.put("/{schedule_id}")
def update_scheduled_entry(schedule_id: int, payload: ScheduledEntryUpdate, db: SessionDep = Depends()):
    """스케줄 항목 수정"""
    schedule = db.query(ScheduledEntry).filter(ScheduledEntry.schedule_id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    
    update_data = payload.model_dump(exclude_unset=True)

    # 다음 실행 일시를 다시 셈해야 하는 자리들. 주기 넷이 늘었다.
    WHEN_KEYS = [
        'day_of_month', 'hour', 'minute', 'holiday_handling',
        'interval_months', 'anchor_ym', 'end_ym', 'skip_ym',
    ]

    # 바뀐 값과 지금 값을 섞어 놓고 한꺼번에 따진다. 주기만 고치고 끝은
    # 그대로 두는 경우가 흔해, 보내지 않은 칸은 지금 값으로 메워야 한다.
    def now_or_new(key):
        return update_data.get(key, getattr(schedule, key))

    # 감출지 말지가 다음 실행 일시를 가른다. 그래서 주기 · 날짜보다 먼저 본다 —
    # 감춘 줄에 예정일이 남아 있으면 안 오는데 날짜만 서 있는 자리가 된다.
    hidden_now = update_data.get('is_active', schedule.is_active) == 0
    unhiding = update_data.get('is_active') == 1 and schedule.is_active == 0

    if hidden_now:
        # 감춘다 — 언제 오는가는 볼 것이 없다. 다른 칸을 함께 고쳤어도 그렇다.
        validate_span(
            now_or_new('interval_months'), now_or_new('anchor_ym'),
            now_or_new('end_ym'), now_or_new('remaining'), now_or_new('skip_ym'),
        )
        update_data['next_run_at'] = None
    elif unhiding or any(key in update_data for key in WHEN_KEYS):
        interval = now_or_new('interval_months')
        anchor = now_or_new('anchor_ym')
        validate_span(
            interval, anchor, now_or_new('end_ym'),
            now_or_new('remaining'), now_or_new('skip_ym'),
        )
        # 격월 이상으로 바꾸면서 첫 달을 안 적어 주면 이 달로 잡는다.
        if interval and interval > 1 and not anchor:
            today = datetime.now().date()
            anchor = _ym(today.year, today.month)
            update_data['anchor_ym'] = anchor

        update_data['next_run_at'] = calculate_next_run_span(
            now_or_new('day_of_month'),
            now_or_new('hour'),
            now_or_new('minute'),
            now_or_new('holiday_handling'),
            db,
            interval_months=interval or 1,
            anchor_ym=anchor,
            end_ym=now_or_new('end_ym'),
            skip_ym=now_or_new('skip_ym'),
        )
    elif 'remaining' in update_data:
        # 횟수만 고친 경우다. 0으로 내리면 멈추고, 0에서 올리면 다시 걸어 준다.
        validate_span(
            schedule.interval_months, schedule.anchor_ym, schedule.end_ym,
            update_data['remaining'], schedule.skip_ym,
        )
        if update_data['remaining'] == 0:
            update_data['next_run_at'] = None
        elif schedule.next_run_at is None:
            update_data['next_run_at'] = calculate_next_run_span(
                schedule.day_of_month, schedule.hour, schedule.minute,
                schedule.holiday_handling, db,
                interval_months=schedule.interval_months or 1,
                anchor_ym=schedule.anchor_ym,
                end_ym=schedule.end_ym,
                skip_ym=schedule.skip_ym,
            )

    for key, value in update_data.items():
        setattr(schedule, key, value)
    
    db.commit()
    return {"status": "ok"}

@router.delete("/{schedule_id}")
def delete_scheduled_entry(schedule_id: int, db: SessionDep = Depends()):
    """스케줄 항목을 아주 지운다.

    예전에는 is_active를 0으로 내려 두고 월례 청소가 나중에 지웠다. 이제
    is_active 0은 "감춤"이라는 다른 뜻을 지니므로, 지우는 일은 여기서 끝낸다.
    되돌릴 수 없다 — 잠시 치워 두려는 것이라면 감추기를 쓴다.

    함께 걸린 몫(scheduled_entry_splits)은 FK가 ON DELETE CASCADE라 따라
    지워진다. 이미 대기 · 지출로 나간 내역은 이 표를 가리키지 않으므로
    그대로 남는다 — 지난 기록이 사라지지는 않는다.
    """
    schedule = db.query(ScheduledEntry).filter(ScheduledEntry.schedule_id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    db.delete(schedule)
    db.commit()
    return {"status": "ok"}

def find_nearest_non_holiday(target_date: date, holiday_handling: str, db: Session) -> date:
    """휴일이 아닌 가장 가까운 날짜 찾기"""
    def is_holiday_date(d: date) -> bool:
        """주어진 날짜가 휴일인지 확인(Holiday 테이블 또는 weekday 기반)"""
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
        # 당일 처리(휴일이어도 그대로)
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

def _first_of_next_month(d: date) -> date:
    """다음 달 1일.

    다음 실행일을 구할 때의 출발점이다. 예전에는 32일을 더했는데,
    31일짜리 스케줄이 7월 31일에 돌면 8월 1일이 아니라 9월 1일로 건너뛰어
    8월을 통째로 잃었다(9월에는 31일이 없어 다시 10월로 밀렸다).
    달의 첫날로 옮기면 며칠짜리 달이든 한 달씩만 정확히 나아간다.
    """
    return date(d.year + 1, 1, 1) if d.month == 12 else date(d.year, d.month + 1, 1)


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
    
    ★ 로직 순서(중요):
    1. 원래 설정 날짜(day_of_month)가 과거인지 체크(휴일 처리 전)
    2. 과거라면 다음 달로 이동
    3. 그 다음 휴일 처리 적용
    """
    now = datetime.now()
    if base_date is None:
        base_date = now.date()
    
    # 1단계: 이번 달의 원래 스케줄된 날짜 계산
    #        말일이면 그 달의 끝 날로 바꿔 둔다 — 1~31은 값이 그대로라
    #        지금까지의 셈이 달라지지 않는다.
    try:
        scheduled_date = date(
            base_date.year,
            base_date.month,
            day_in_month(base_date.year, base_date.month, day_of_month),
        )
    except ValueError:
        # 유효하지 않은 날짜(예: 2월 30일) - 다음 달로 이동
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
            scheduled_date = date(
                scheduled_date.year + 1,
                1,
                day_in_month(scheduled_date.year + 1, 1, day_of_month),
            )
        else:
            try:
                scheduled_date = date(
                    scheduled_date.year,
                    scheduled_date.month + 1,
                    day_in_month(scheduled_date.year, scheduled_date.month + 1, day_of_month),
                )
            except ValueError:
                # 유효하지 않은 날짜(예: 2월 30일)
                last_day = calendar.monthrange(scheduled_date.year, scheduled_date.month + 1)[1]
                scheduled_date = date(scheduled_date.year, scheduled_date.month + 1, min(day_of_month, last_day))
    
    # 3단계: 휴일 처리 적용하여 실제 실행 날짜 결정
    target_date = find_nearest_non_holiday(scheduled_date, holiday_handling, db)

    # 3.5단계: 당겨진 날짜가 과거로 넘어갔으면 다음 달로 미룬다.
    #
    # 2단계는 휴일 처리 **전** 날짜로 과거인지 따진다. 그런데 '휴일 전'은
    # 날짜를 앞으로 당기므로, 원래 날짜는 아직 안 왔는데 당겨진 날짜는 이미
    # 지나 있을 수 있다 — 매월 25일·휴일 전인 스케줄을 추석(2026-09-24~26)
    # 앞의 9월 23일 오후에 고치면 "9월 23일 오전 10시"가 나왔다. 이미 지난
    # 자리라 스케줄러가 매분 다시 집어 들고, 화면에도 지난 날로 적힌다.
    #
    # 실제로 도는 시각은 당겨진 날짜이므로 그 값으로 다시 따진다. 한 달을
    # 미루고 휴일 처리를 다시 걸어, 앞으로 올 자리가 나올 때까지 되풀이한다.
    # 열세 번으로 끊는 것은 한 해를 넘기면 더 볼 것이 없기 때문이다.
    for _ in range(13):
        moment = datetime.combine(
            target_date, datetime.min.time().replace(hour=hour, minute=minute)
        )
        if moment > now:
            break
        nxt = _first_of_next_month(scheduled_date)
        scheduled_date = date(
            nxt.year, nxt.month, day_in_month(nxt.year, nxt.month, day_of_month)
        )
        target_date = find_nearest_non_holiday(scheduled_date, holiday_handling, db)

    # 4단계: 최종 DateTime 반환
    target_datetime = datetime.combine(target_date, datetime.min.time().replace(hour=hour, minute=minute))

    return target_datetime

# ── 주기 · 끝 · 건너뛰기 ────────────────────────────────────────────────
#
# 위의 calculate_next_run_at은 "매월 N일"만 안다. 격월 · 분기 · 반년 · 매년과
# 끝나는 달 · 남은 횟수 · 한 번 건너뛰기는 그 위에 얹는다.
#
# 매월이면서 끝도 건너뜀도 없는 스케줄은 아래 calculate_next_run_span이 손대지
# 않고 위 함수로 그대로 흘려보낸다. 지금까지 돌던 스케줄의 셈이 한 톨도
# 달라지지 않게 하려는 것이다 — 달력 셈은 잔가지가 많아, 고쳐 쓰는 것보다
# 건드리지 않는 편이 확실하다.


#: 화면에 이름표가 있는 주기만 받는다. 5개월처럼 어중간한 값이 들어오면
#: 카드에 뭐라고 적을지가 없다. DB의 CHECK와 같은 목록이다.
INTERVALS = (1, 2, 3, 6, 12)


def _ym(year: int, month: int) -> str:
    """'YYYYMM'. 글자로 담아도 대소 비교가 곧 시간 순서다."""
    return f"{year:04d}{month:02d}"


def _is_ym(v: str | None) -> bool:
    return bool(v) and len(v) == 6 and v.isdigit() and 1 <= int(v[4:]) <= 12


def validate_span(
    interval_months: int | None,
    anchor_ym: str | None,
    end_ym: str | None,
    remaining: int | None,
    skip_ym: str | None,
) -> None:
    """주기 · 끝 · 건너뛰기를 따져 본다. DB의 CHECK보다 앞서 걸러 낸다.

    셋 다 None이면 볼 것이 없다 — 지금까지의 매월 스케줄이 그 자리다.
    """
    if interval_months is not None and interval_months not in INTERVALS:
        raise HTTPException(
            status_code=400,
            detail=f"interval_months must be one of {INTERVALS}",
        )
    for name, v in (("anchor_ym", anchor_ym), ("end_ym", end_ym), ("skip_ym", skip_ym)):
        if v is not None and not _is_ym(v):
            raise HTTPException(status_code=400, detail=f"{name} must be 'YYYYMM'")
    if remaining is not None and remaining < 0:
        raise HTTPException(status_code=400, detail="remaining must be 0 or more")
    if remaining is not None and end_ym is not None:
        raise HTTPException(
            status_code=400,
            detail="remaining and end_ym cannot be used together",
        )


def _ym_step(year: int, month: int, n: int) -> tuple[int, int]:
    """n달 뒤의 연 · 월."""
    t = year * 12 + (month - 1) + n
    return t // 12, t % 12 + 1


def _month_aligned(year: int, month: int, anchor_ym: str | None, interval_months: int) -> bool:
    """그 달이 주기의 박자에 맞는가.

    격월이 홀수 달인지 짝수 달인지는 첫 달(anchor_ym)이 정한다. 첫 달보다
    앞선 달은 아직 시작 전이라 맞지 않는 것으로 본다.
    """
    if interval_months <= 1:
        return True
    if not anchor_ym:
        return True
    gap = (year * 12 + month) - (int(anchor_ym[:4]) * 12 + int(anchor_ym[4:]))
    return gap >= 0 and gap % interval_months == 0


def calculate_next_run_span(
    day_of_month: int,
    hour: int,
    minute: int,
    holiday_handling: str,
    db: Session,
    base_date: date | None = None,
    interval_months: int = 1,
    anchor_ym: str | None = None,
    end_ym: str | None = None,
    skip_ym: str | None = None,
) -> datetime | None:
    """다음 실행 일시. 더 올 자리가 없으면 None을 준다.

    None은 "끝났다"는 뜻이다. 부르는 쪽은 next_run_at을 비워 두면 된다 —
    비어 있는 줄은 스케줄러가 집어 들지 않으므로 그것으로 멈춘다.
    """
    # 지금까지와 똑같은 스케줄은 손대지 않는다.
    if interval_months <= 1 and not end_ym and not skip_ym:
        return calculate_next_run_at(
            day_of_month, hour, minute, holiday_handling, db, base_date
        )

    now = datetime.now()
    if base_date is None:
        base_date = now.date()

    at = datetime.min.time().replace(hour=hour, minute=minute)
    year, month = base_date.year, base_date.month

    # 매월이면 열세 달, 매년이면 열세 해를 본다. 그 안에 자리가 없으면
    # 앞으로도 없다 — 끝나는 달에 걸렸거나 날이 없는 달만 이어진 것이다.
    for _ in range(13 * max(1, interval_months)):
        ym = _ym(year, month)
        if end_ym and ym > end_ym:
            return None

        if _month_aligned(year, month, anchor_ym, interval_months) and ym != skip_ym:
            try:
                nominal = date(year, month, day_in_month(year, month, day_of_month))
            except ValueError:
                # 그 달에 없는 날(2월 31일 따위)이다. 건너뛴다.
                nominal = None

            if nominal is not None and datetime.combine(nominal, at) > now:
                # 휴일 처리는 날짜를 앞뒤로 민다. 당겨진 날이 이미 지났으면
                # 이 달은 놓친 것이니 다음 자리를 본다.
                target = find_nearest_non_holiday(nominal, holiday_handling, db)
                moment = datetime.combine(target, at)
                if moment > now:
                    return moment

        year, month = _ym_step(year, month, 1)

    return None


def _advance(schedule: ScheduledEntry, db: Session) -> datetime | None:
    """한 건이 나간 뒤(또는 건너뛴 뒤) 다음 자리를 셈한다.

    남은 횟수가 다 되면 None이다. 줄은 그대로 두고 next_run_at만 비운다 —
    끝난 할부가 소리 없이 사라지면 무엇이 끝났는지 알 길이 없다.
    """
    if schedule.remaining is not None and schedule.remaining <= 0:
        return None
    return calculate_next_run_span(
        schedule.day_of_month,
        schedule.hour,
        schedule.minute,
        schedule.holiday_handling,
        db,
        base_date=_first_of_next_month(schedule.next_run_at.date()),
        interval_months=schedule.interval_months or 1,
        anchor_ym=schedule.anchor_ym,
        end_ym=schedule.end_ym,
        skip_ym=schedule.skip_ym,
    )


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
    # 만든 것은 없어도 다음 실행 일시만 고쳐 둔 경우를 따로 센다 — 아래 커밋
    # 조건에 쓴다.
    fixed_count = 0

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
            # 다음 실행 일시 재계산(다음 주기)
            schedule.next_run_at = _advance(schedule, db)
            if schedule.next_run_at is None:
                schedule.is_active = 0
            fixed_count += 1
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
            perf_exclude=schedule.perf_exclude,
            fixed_flag=schedule.fixed_flag,
            sended=0,
        )
        db.add(new_pending)
        db.flush()                  # entry_id를 받아야 분할을 붙일 수 있다.
        copy_splits(db, ScheduledEntrySplit, "schedule_id", schedule.schedule_id,
                    PendingEntrySplit, "pending_id", new_pending.entry_id)
        created_count += 1

        # 남은 횟수는 실제로 한 건이 나간 이 자리에서만 준다. 중복 막이로
        # 건너뛴 자리에서 깎으면 나가지도 않은 회차를 쓴 셈이 된다.
        if schedule.remaining is not None and schedule.remaining > 0:
            schedule.remaining -= 1

        # 건너뛰기 표는 한 번 쓰고 버린다. 건너뛴 다음 회차가 실제로 나간
        # 이 자리에서 스스로 꺼진다 — 달이 바뀌었다고 지우면 아직 오지도
        # 않은 회차를 두고 표를 먼저 떼는 셈이라, 매년처럼 사이가 먼
        # 스케줄에서는 무엇을 건너뛴 것인지 알 길이 없어진다.
        if schedule.skip_ym and schedule.skip_ym < _ym(target_date.year, target_date.month):
            schedule.skip_ym = None

        # 다음 실행 일시 재계산(다음 주기)
        schedule.next_run_at = _advance(schedule, db)

        # 더 올 자리가 없으면 그 자리에서 저절로 감춘다. 끝난 줄이 목록에
        # 그냥 남아 있으면 "안 오는데 목록엔 있는" 어정쩡한 자리가 된다.
        # 지우지 않는 것은 무엇이 언제까지 나갔는지가 기록이기 때문이다.
        if schedule.next_run_at is None:
            schedule.is_active = 0

    # 만든 것이 없어도 고쳐 둔 것이 있으면 담아야 한다. 예전에는 만든 것만
    # 보고 커밋해서, 중복 막이로 건너뛰며 다시 셈해 둔 다음 실행 일시가
    # 세션이 닫힐 때 버려졌다 — 같은 스케줄을 매분 다시 집어 드는 꼴이었고,
    # 다른 스케줄이 같은 분에 걸려 커밋이 일어날 때만 우연히 고쳐졌다.
    if created_count > 0 or fixed_count > 0:
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
    skipped = 0
    for schedule in schedules:
        # 비어 있는 next_run_at은 이제 두 가지를 뜻한다 — 아직 셈하지 않았거나,
        # 다 끝났거나. 끝난 줄을 여기서 다시 채우면 남은 횟수가 0인 할부가
        # 되살아난다. 끝난 표가 붙어 있으면 그대로 둔다.
        if schedule.remaining is not None and schedule.remaining <= 0:
            skipped += 1
            continue
        if schedule.end_ym and schedule.end_ym < _ym(datetime.now().year, datetime.now().month):
            skipped += 1
            continue

        schedule.next_run_at = calculate_next_run_span(
            schedule.day_of_month,
            schedule.hour,
            schedule.minute,
            schedule.holiday_handling,
            db,
            interval_months=schedule.interval_months or 1,
            anchor_ym=schedule.anchor_ym,
            end_ym=schedule.end_ym,
            skip_ym=schedule.skip_ym,
        )
        updated += 1

    db.commit()
    return {"status": "ok", "updated": updated, "skipped": skipped}
