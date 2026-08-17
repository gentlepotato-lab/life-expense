from pydantic import BaseModel
from datetime import date, datetime

class EntryIn(BaseModel):
    tx_date: date
    cat1_id: int
    cat2_id: int
    inout: int
    amount: float
    pay_method: str
    memo: str | None = None
    cat3_id: int | None = None

    # 기본 장소 키
    place_id: int | None = None

    # 신규 장소 전달용 기본 필드
    place_name: str | None = None   # ← 예외 케이스 지원용
    place_lat: float | None = None  # ← 예외 케이스 지원용
    place_lng: float | None = None  # ← 예외 케이스 지원용

    # Kakao Place 메타 정보 전체
    kakao_id: str | None = None
    address_name: str | None = None
    road_address_name: str | None = None
    phone: str | None = None
    category_name: str | None = None
    category_group_code: str | None = None
    category_group_name: str | None = None
    place_url: str | None = None

class EntryOut(EntryIn):
    entry_id: int

class EntryUpdate(BaseModel):
    entry_id: int

    tx_date: date | None = None
    cat1_id: int | None = None
    cat2_id: int | None = None
    cat3_id: int | None = None
    inout: int | None = None
    amount: float | None = None
    pay_method: int | None = None
    memo: str | None = None

    # 장소 정보
    place_id: int | None = None
    place_name: str | None = None
    place_lat: float | None = None
    place_lng: float | None = None

    # Kakao 메타
    kakao_id: str | None = None
    address_name: str | None = None
    road_address_name: str | None = None
    phone: str | None = None
    category_name: str | None = None
    category_group_code: str | None = None
    category_group_name: str | None = None
    place_url: str | None = None

class PlaceIn(BaseModel):
    place_name: str
    lat: float
    lng: float

    kakao_id: str | None = None

    address_name: str | None = None
    road_address_name: str | None = None
    phone: str | None = None

    category_name: str | None = None
    category_group_code: str | None = None
    category_group_name: str | None = None

    place_url: str | None = None

class PendingEntryIn(BaseModel):
    tx_date: date
    cat1_id: int | None = None
    cat2_id: int | None = None
    cat3_id: int | None = None
    inout: int
    amount: float
    pay_method: int | None = None
    memo: str | None = None

class PendingEntryOut(PendingEntryIn):
    entry_id: int
    sended: bool

class HolidayOut(BaseModel):
    dt: date
    year: int
    month: int
    day: int
    weekday: int
    is_holiday: bool
    holiday_name: str | None = None

    class Config:
        orm_mode = True

class ScheduledEntryIn(BaseModel):
    day_of_month: int  # 1-31
    hour: int  # 0-23
    minute: int  # 0-59
    holiday_handling: str  # 'before', 'on', 'after'
    cat1_id: int | None = None
    cat2_id: int | None = None
    cat3_id: int | None = None
    inout: int
    amount: float
    pay_method: int | None = None
    memo: str | None = None
    place_id: int | None = None
    is_active: int = 1

class ScheduledEntryOut(ScheduledEntryIn):
    schedule_id: int
    next_run_at: datetime | None = None
    created_at: str
    updated_at: str | None = None

class ScheduledEntryUpdate(BaseModel):
    day_of_month: int | None = None
    hour: int | None = None
    minute: int | None = None
    holiday_handling: str | None = None
    cat1_id: int | None = None
    cat2_id: int | None = None
    cat3_id: int | None = None
    inout: int | None = None
    amount: float | None = None
    pay_method: int | None = None
    memo: str | None = None
    place_id: int | None = None
    is_active: int | None = None
