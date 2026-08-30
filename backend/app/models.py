from app.deps import Base
from sqlalchemy import Column, Integer, String, Numeric, Date, ForeignKey, SmallInteger, TIMESTAMP, func, UniqueConstraint, DateTime
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

# Base = declarative_base()

class CategoryL1(Base):
    __tablename__ = "categories_lvl1"
    cat1_id = Column(Integer, primary_key=True)
    cat1_name = Column(String, unique=True, nullable=False)
    emoji = Column(String(16))              # 묶음 머리말에 붙는 이모지
    sort_order = Column(Integer, default=0, nullable=True)
    is_active = Column(SmallInteger, nullable=False, default=1)   # 0이면 고르는 목록에서 뺀다.
    blur_flag = Column(SmallInteger, nullable=False, default=0)     # 1이면 금액을 덮는다.
    exclude_flag = Column(SmallInteger, nullable=False, default=0)  # 1이면 집계에서 뺀다.

class CategoryL2(Base):
    __tablename__ = "categories_lvl2"
    cat2_id = Column(Integer, primary_key=True)
    cat2_name = Column(String, nullable=False)
    cat1_id = Column(Integer, ForeignKey("categories_lvl1.cat1_id"), nullable=False)
    # cat1_name = Column(String, nullable=False)
    sort_order = Column(Integer, default=0, nullable=True)
    blur_flag = Column(SmallInteger, default=0, nullable=False)
    inout = Column(SmallInteger, nullable=True)
    is_active = Column(SmallInteger, nullable=False, default=1)   # 0이면 고르는 목록에서 뺀다.
    exclude_flag = Column(SmallInteger, nullable=False, default=0)  # 1이면 집계에서 뺀다.

class CategoryL3(Base):
    __tablename__ = "categories_lvl3"
    cat3_id = Column(Integer, primary_key=True)
    cat3_name = Column(String, nullable=False)
    cat2_id = Column(Integer, ForeignKey("categories_lvl2.cat2_id"), nullable=False)
    sort_order = Column(Integer, default=0, nullable=True)
    is_active = Column(SmallInteger, nullable=False, default=1)   # 0이면 고르는 목록에서 뺀다.
    blur_flag = Column(SmallInteger, nullable=False, default=0)     # 1이면 금액을 덮는다.
    exclude_flag = Column(SmallInteger, nullable=False, default=0)  # 1이면 집계에서 뺀다.

class PaymentMethod(Base):
    __tablename__ = "payment_methods"
    method_id = Column(Integer, primary_key=True, autoincrement=True)
    method_name = Column(String, nullable=False, unique=True)
    # 구분은 payment_method_categories 행을 가리킨다.
    category_id = Column(Integer, ForeignKey("payment_method_categories.category_id", ondelete="SET NULL"))
    # 카드 연회비. 카드가 아닌 것은 비워 둔다.
    annual_fee = Column(Numeric(14, 2))
    sort_order = Column(Integer, default=0, nullable=True)

class Entry(Base):
    __tablename__ = "entries"
    entry_id = Column(Integer, primary_key=True, autoincrement=True)
    tx_date = Column(Date, nullable=False)
    cat1_id = Column(Integer, ForeignKey("categories_lvl1.cat1_id"))
    cat2_id = Column(Integer, ForeignKey("categories_lvl2.cat2_id"))
    inout = Column(SmallInteger, nullable=False)
    amount = Column(Numeric(14,2), nullable=False)
    pay_method = Column(Integer, ForeignKey("payment_methods.method_id"))
    memo = Column(String)
    created_at = Column(TIMESTAMP, server_default=func.now())
    # updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    cat3_id = Column(Integer, ForeignKey("categories_lvl3.cat3_id"), nullable=True)
    # place_name = Column(String, nullable=True)
    # place_lat = Column(Numeric(10,6), nullable=True)
    # place_lng = Column(Numeric(10,6), nullable=True)
    place_id = Column(Integer, ForeignKey("places.place_id"), nullable=True)
    place = relationship("Place", back_populates="entries")

    def to_dict(self):
        return {
            "entry_id": self.entry_id,
            "tx_date": str(self.tx_date),
            "cat1_id": self.cat1_id,
            "cat2_id": self.cat2_id,
            "inout": self.inout,
            "amount": float(self.amount),
            "pay_method": self.pay_method,
            "memo": self.memo,
        }

class Place(Base):
    __tablename__ = "places"
    __table_args__ = (
        UniqueConstraint("lat", "lng", name="uniq_place_lat_lng"),
    )

    place_id = Column(Integer, primary_key=True, autoincrement=True)
    place_name = Column(String, nullable=False)

    kakao_id = Column(String, nullable=True)
    category_l1 = Column(String, nullable=True)
    category_l2 = Column(String, nullable=True)
    category_l3 = Column(String, nullable=True)
    category_group_code = Column(String, nullable=True)
    category_group_name = Column(String, nullable=True)

    phone = Column(String, nullable=True)
    address_name = Column(String, nullable=True)
    road_address_name = Column(String, nullable=True)
    place_url = Column(String, nullable=True)

    city = Column(String, nullable=True)
    district = Column(String, nullable=True)
    town = Column(String, nullable=True)

    lat = Column(Numeric(10,6), nullable=True)
    lng = Column(Numeric(10,6), nullable=True)

    created_at = Column(TIMESTAMP, server_default=func.now())

    entries = relationship("Entry", back_populates="place")

class PendingEntry(Base):
    __tablename__ = "pending_entries"

    entry_id = Column(Integer, primary_key=True, autoincrement=True)
    tx_date = Column(Date, nullable=False)
    cat1_id = Column(Integer, nullable=True)
    cat2_id = Column(Integer, nullable=True)
    cat3_id = Column(Integer, nullable=True)
    inout = Column(SmallInteger, nullable=False)
    amount = Column(Numeric(14,2), nullable=False)
    pay_method = Column(Integer, nullable=True)
    memo = Column(String, nullable=True)

    place_id = Column(Integer, ForeignKey("places.place_id"), nullable=True)

    created_at = Column(TIMESTAMP, server_default=func.now())
    sended = Column(Integer, default=0, nullable=False)

    def to_dict(self):
        return {
            "entry_id": self.entry_id,
            "tx_date": str(self.tx_date),
            "cat1_id": self.cat1_id,
            "cat2_id": self.cat2_id,
            "cat3_id": self.cat3_id,
            "inout": self.inout,
            "amount": float(self.amount),
            "pay_method": self.pay_method,
            "memo": self.memo,

            "place_id": self.place_id,
            "place_name": self.place_name,
            "kakao_id": self.kakao_id,
            "address_name": self.address_name,
            "road_address_name": self.road_address_name,
            "phone": self.phone,
            "category_name": self.category_name,
            "category_group_code": self.category_group_code,
            "category_group_name": self.category_group_name,
            "place_url": self.place_url,
            "place_lat": self.place_lat,
            "place_lng": self.place_lng,

            "sended": self.sended,
        }

class Holiday(Base):
    __tablename__ = "holidays"

    dt = Column(Date, primary_key=True)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    day = Column(Integer, nullable=False)
    weekday = Column(Integer, nullable=False)

    # 0/1 ?? ??? > ?? ?? true?? 1
    is_holiday = Column(Integer, nullable=False, default=0)

    holiday_name = Column(String, nullable=True)

    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class ScheduledEntry(Base):
    __tablename__ = "scheduled_entries"

    schedule_id = Column(Integer, primary_key=True, autoincrement=True)
    
    # 스케줄 설정
    day_of_month = Column(Integer, nullable=False)  # 매월 몇 일(1-31)
    hour = Column(Integer, nullable=False)  # 몇 시(0-23)
    minute = Column(Integer, nullable=False)  # 몇 분(0-59)
    
    # 휴일 처리 옵션: 'before', 'on', 'after'
    holiday_handling = Column(String, nullable=False, default='on')
    
    # 다음 실행 일시
    next_run_at = Column(DateTime, nullable=True)
    
    # 지출 내역 정보
    cat1_id = Column(Integer, ForeignKey("categories_lvl1.cat1_id"), nullable=True)
    cat2_id = Column(Integer, ForeignKey("categories_lvl2.cat2_id"), nullable=True)
    cat3_id = Column(Integer, ForeignKey("categories_lvl3.cat3_id"), nullable=True)
    inout = Column(SmallInteger, nullable=False)
    amount = Column(Numeric(14,2), nullable=False)
    pay_method = Column(Integer, ForeignKey("payment_methods.method_id"), nullable=True)
    memo = Column(String, nullable=True)
    place_id = Column(Integer, ForeignKey("places.place_id"), nullable=True)
    
    # 활성화 여부
    is_active = Column(SmallInteger, default=1, nullable=False)    # 1: 활성, 0: 비활성
    
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class Counterpart(Base):
    """돈을 돌려준 상대(사람/조직)"""
    __tablename__ = "counterparts"

    counterpart_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    # 구분은 counterpart_categories 행을 가리킨다.
    category_id = Column(Integer, ForeignKey("counterpart_categories.category_id", ondelete="SET NULL"))
    memo = Column(String(200))
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(SmallInteger, nullable=False, default=1)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    def to_dict(self):
        return {
            "counterpart_id": self.counterpart_id,
            "name": self.name,
            "category_id": self.category_id,
            "memo": self.memo,
            "sort_order": self.sort_order,
            "is_active": self.is_active,
        }


class EntrySplit(Base):
    """
    지출 한 건에서 돌려받은 몫.
    entries.amount는 결제 총액 그대로 두고, 실지출은 amount - SUM(splits)로 본다.
    분할은 자기 자신을 다시 쪼갤 수 없으므로 깊이는 항상 1이다.
    """
    __tablename__ = "entry_splits"

    split_id = Column(Integer, primary_key=True, autoincrement=True)
    entry_id = Column(Integer, ForeignKey("entries.entry_id", ondelete="CASCADE"), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    split_type = Column(String(20), nullable=False, default="reimbursed")
    counterpart_id = Column(Integer, ForeignKey("counterparts.counterpart_id", ondelete="SET NULL"))
    memo = Column(String(200))
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    def to_dict(self):
        return {
            "split_id": self.split_id,
            "entry_id": self.entry_id,
            "amount": float(self.amount),
            "split_type": self.split_type,
            "counterpart_id": self.counterpart_id,
            "memo": self.memo,
        }


class PendingEntrySplit(Base):
    """
    Pending 단계의 분할. entry_splits와 같은 모양이다.
    전송(send)할 때 entry_splits로 복사된다.
    """
    __tablename__ = "pending_entry_splits"

    split_id = Column(Integer, primary_key=True, autoincrement=True)
    pending_id = Column(Integer, ForeignKey("pending_entries.entry_id", ondelete="CASCADE"), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    split_type = Column(String(20), nullable=False, default="reimbursed")
    counterpart_id = Column(Integer, ForeignKey("counterparts.counterpart_id", ondelete="SET NULL"))
    memo = Column(String(200))
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    def to_dict(self):
        return {
            "split_id": self.split_id,
            "pending_id": self.pending_id,
            "amount": float(self.amount),
            "split_type": self.split_type,
            "counterpart_id": self.counterpart_id,
            "memo": self.memo,
        }


class ScheduledEntrySplit(Base):
    """
    스케줄에 걸어 두는 분할 템플릿.
    스케줄러가 PendingEntry를 만들 때 pending_entry_splits로 복사된다.
    매달 나가는 지출의 N빵 설정을 한 번만 해 두면 계속 따라온다.
    """
    __tablename__ = "scheduled_entry_splits"

    split_id = Column(Integer, primary_key=True, autoincrement=True)
    schedule_id = Column(Integer, ForeignKey("scheduled_entries.schedule_id", ondelete="CASCADE"), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    split_type = Column(String(20), nullable=False, default="reimbursed")
    counterpart_id = Column(Integer, ForeignKey("counterparts.counterpart_id", ondelete="SET NULL"))
    memo = Column(String(200))
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    def to_dict(self):
        return {
            "split_id": self.split_id,
            "schedule_id": self.schedule_id,
            "amount": float(self.amount),
            "split_type": self.split_type,
            "counterpart_id": self.counterpart_id,
            "memo": self.memo,
        }


class PaymentMethodCategory(Base):
    """
    결제 수단의 구분.
    Categories의 중분류처럼 행으로 두어야 이모지를 그 행에 담고,
    나중에 구분별로 집계할 때 그대로 조인할 수 있다.
    """
    __tablename__ = "payment_method_categories"

    category_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(40), nullable=False, unique=True)
    emoji = Column(String(16))
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(SmallInteger, nullable=False, default=1)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    def to_dict(self):
        return {
            "category_id": self.category_id,
            "name": self.name,
            "emoji": self.emoji,
            "sort_order": self.sort_order,
            "is_active": self.is_active,
        }


class CounterpartCategory(Base):
    """
    상대의 구분. 사용자가 늘릴 수 있다.

    color는 헥사값이 아니라 팔레트 토큰 이름('indigo' 등)이다.
    화면의 색을 조정할 때 DB를 건드리지 않기 위해서다.
    """
    __tablename__ = "counterpart_categories"

    category_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(40), nullable=False, unique=True)
    emoji = Column(String(16))
    color = Column(String(20))
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(SmallInteger, nullable=False, default=1)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    def to_dict(self):
        return {
            "category_id": self.category_id,
            "name": self.name,
            "emoji": self.emoji,
            "color": self.color,
            "sort_order": self.sort_order,
            "is_active": self.is_active,
        }
class CardTier(Base):
    """
    카드 실적 구간.

    구간 하나에 혜택이 여럿 붙으므로 혜택은 card_benefits로 따로 뺐다.
    한 행에 몰아 담으면 나중에 하나만 고치거나 순서를 바꿀 수가 없다.
    """
    __tablename__ = "card_tiers"

    tier_id = Column(Integer, primary_key=True, autoincrement=True)
    method_id = Column(Integer, ForeignKey("payment_methods.method_id", ondelete="CASCADE"), nullable=False)
    threshold = Column(Numeric(14, 2), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())


class CardBenefit(Base):
    """
    구간 하나가 주는 혜택 한 줄.

    content는 항목 이름, memo는 그 옆에 적는 상세다 —
    "커피 할인" 만으로는 어느 가게에서 얼마인지가 남지 않는다.
    """
    __tablename__ = "card_benefits"

    benefit_id = Column(Integer, primary_key=True, autoincrement=True)
    tier_id = Column(Integer, ForeignKey("card_tiers.tier_id", ondelete="CASCADE"), nullable=False)
    content = Column(String(200), nullable=False)
    memo = Column(String(200))
    # 월간 통합 할인한도. 없는 혜택도 있어 비울 수 있다.
    limit_amount = Column(Numeric(14, 2))
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())


class CardBenefitTarget(Base):
    """
    혜택 하나가 걸리는 대상.

    "디지털 구독 할인" 아래에 OTT → 넷플릭스·유튜브프리미엄, 음원 → 멜론·지니
    처럼 영역과 가맹점이 짝으로 붙는다. 영역 구분이 없는 혜택도 있어 area는 비울 수 있다.
    """
    __tablename__ = "card_benefit_targets"

    target_id = Column(Integer, primary_key=True, autoincrement=True)
    benefit_id = Column(Integer, ForeignKey("card_benefits.benefit_id", ondelete="CASCADE"), nullable=False)
    area = Column(String(60))
    stores = Column(String(400), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())


class CategoryGoal(Base):
    """
    분류별 목표 금액 — "안쓴이 도전".

    지출에 거는 목표라 덜 쓰면 이기는 것이다. 중·소·세 어느 단에나
    걸 수 있고, 채운 것 중 가장 깊은 단이 그 목표의 대상이다.
    겹쳐 걸어도 된다 — 그때는 서로 나누지 않고 저마다 제 가지 아래를 통째로 센다.
    """
    __tablename__ = "category_goals"

    goal_id = Column(Integer, primary_key=True, autoincrement=True)
    cat1_id = Column(Integer, ForeignKey("categories_lvl1.cat1_id", ondelete="CASCADE"), nullable=False)
    cat2_id = Column(Integer, ForeignKey("categories_lvl2.cat2_id", ondelete="CASCADE"))
    cat3_id = Column(Integer, ForeignKey("categories_lvl3.cat3_id", ondelete="CASCADE"))
    amount = Column(Numeric(14, 2), nullable=False)
    # 왜 이 목표를 걸었는지 — 금액만으로는 남지 않는다.
    memo = Column(String(200))
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())


class ChartCard(Base):
    """
    씀씀이 화면의 그림 카드 — 차례와 켜짐.

    그림 자체는 코드가 들고 있고 표에는 열쇠와 차례만 담는다. 그래야 그림을
    새로 만들거나 고쳐도 표를 건드릴 일이 없다.
    """
    __tablename__ = "chart_cards"

    card_key = Column(String(40), primary_key=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(SmallInteger, nullable=False, default=1)
    # 1이면 반 칸, 2면 한 줄을 다 쓴다. 좁은 화면은 이 값과 상관없이 한 줄에 하나씩이다
    span = Column(SmallInteger, nullable=False, default=1)
    created_at = Column(TIMESTAMP, server_default=func.now())
