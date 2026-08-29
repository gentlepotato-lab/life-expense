from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, and_, text
from sqlalchemy.exc import IntegrityError
from app.deps import get_db, SessionLocal
from app.models import Place

router = APIRouter()

def _split_address(addr: str | None):
    if not addr:
        return None, None, None
    parts = addr.split()
    city = parts[0] if len(parts) > 0 else None
    district = parts[1] if len(parts) > 1 else None
    town = " ".join(parts[2:]) if len(parts) > 2 else None
    return city, district, town

def _split_category_name(cat: str | None):
    if not cat:
        return None, None, None
    parts = [p.strip() for p in cat.split(">")]
    c1 = parts[0] if len(parts) > 0 else None
    c2 = parts[1] if len(parts) > 1 else None
    c3 = parts[2] if len(parts) > 2 else None
    return c1, c2, c3

class PlaceIn(BaseModel):
    place_name: str
    lat: float | None = None
    lng: float | None = None

    address_name: str | None = None
    road_address_name: str | None = None
    phone: str | None = None

    kakao_id: str | None = None
    category_name: str | None = None
    category_group_code: str | None = None
    category_group_name: str | None = None
    place_url: str | None = None

    # 행정 구역 → 직접 받는 것이 아니라 계산을 위한 보조 필드로 유지
    city: str | None = None
    district: str | None = None
    town: str | None = None

@router.post("", status_code=201)
def create_place(payload: PlaceIn, db=Depends(get_db)):
    # ① kakao_id로 중복 검사
    if payload.kakao_id:
        row = db.execute(
            select(Place).where(Place.kakao_id == payload.kakao_id)
        ).scalar_one_or_none()
        if row:
            return {"place_id": row.place_id}
    
    # ② 좌표로 중복 검사(kakao_id가 없을 때만)
    if not payload.kakao_id and payload.lat is not None and payload.lng is not None:
        # 원래 좌표와 미세 조정된 좌표(±0.000001) 모두 확인
        from sqlalchemy import or_
        row = db.execute(
            select(Place).where(
                or_(
                    and_(
                        Place.lat == round(payload.lat, 6),
                        Place.lng == round(payload.lng, 6)
                    ),
                    and_(
                        Place.lat == round(payload.lat + 0.000001, 6),
                        Place.lng == round(payload.lng + 0.000001, 6)
                    ),
                    and_(
                        Place.lat == round(payload.lat - 0.000001, 6),
                        Place.lng == round(payload.lng - 0.000001, 6)
                    )
                )
            )
        ).scalar_one_or_none()
        if row:
            return {"place_id": row.place_id}
    
    # kakao_id가 있으면 좌표 미세 조정하여 새로 생성(같은 건물 내 다른 가게)
    if payload.kakao_id and payload.lat is not None and payload.lng is not None:
        # 기존에 같은 좌표의 장소가 있는지 확인(미세 조정 전)
        row = db.execute(
            select(Place).where(
                and_(
                    Place.lat == round(payload.lat, 6),
                    Place.lng == round(payload.lng, 6)
                )
            )
        ).scalar_one_or_none()
        if row:
            # 같은 좌표의 장소가 있으면 사용 가능한 좌표를 찾을 때까지 미세 조정
            base_lat = float(payload.lat)
            base_lng = float(payload.lng)
            offset = 0.000001
            max_attempts = 100  # 최대 100번 시도
            
            for attempt in range(max_attempts):
                # 다양한 방향으로 조정 시도
                offsets = [
                    (offset * (attempt + 1), offset * (attempt + 1)),  # +, +
                    (-offset * (attempt + 1), offset * (attempt + 1)),  # -, +
                    (offset * (attempt + 1), -offset * (attempt + 1)),  # +, -
                    (-offset * (attempt + 1), -offset * (attempt + 1)),  # -, -
                ]
                
                for lat_offset, lng_offset in offsets:
                    test_lat = round(base_lat + lat_offset, 6)
                    test_lng = round(base_lng + lng_offset, 6)
                    
                    # 해당 좌표가 사용 가능한지 확인
                    existing = db.execute(
                        select(Place).where(
                            and_(
                                Place.lat == test_lat,
                                Place.lng == test_lng
                            )
                        )
                    ).scalar_one_or_none()
                    
                    if not existing:
                        # 사용 가능한 좌표를 찾음
                        payload.lat = test_lat
                        payload.lng = test_lng
                        break
                else:
                    continue
                break

    # address_name 파싱
    # 주소 정보 분리
    addr = payload.address_name or payload.road_address_name
    city, district, town = _split_address(addr)

    # 업종 정보 분리
    cat_l1, cat_l2, cat_l3 = _split_category_name(payload.category_name)

    obj = Place(
        place_name=payload.place_name,

        # 필수 위치 정보
        lat=round(payload.lat, 6) if payload.lat else None,
        lng=round(payload.lng, 6) if payload.lng else None,

        # 행정 구역(address_name 기준)
        city=city,
        district=district,
        town=town,

        # Kakao 메타
        kakao_id=payload.kakao_id,
        address_name=payload.address_name,
        road_address_name=payload.road_address_name,
        phone=payload.phone,

        category_l1=cat_l1,
        category_l2=cat_l2,
        category_l3=cat_l3,
        category_group_code=payload.category_group_code,
        category_group_name=payload.category_group_name,

        place_url=payload.place_url,
    )

    try:
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return {"place_id": obj.place_id}

    except IntegrityError:
        db.rollback()

        # 새로운 세션으로 재조회(좌표로, 원래 좌표와 미세 조정된 좌표 모두 확인)
        if payload.lat is not None and payload.lng is not None:
            with SessionLocal() as new_db:
                # 원래 좌표와 미세 조정된 좌표(±0.000001) 모두 확인
                existing = new_db.execute(
                    select(Place).where(
                        or_(
                            and_(
                                Place.lat == round(payload.lat, 6),
                                Place.lng == round(payload.lng, 6)
                            ),
                            and_(
                                Place.lat == round(payload.lat + 0.000001, 6),
                                Place.lng == round(payload.lng + 0.000001, 6)
                            ),
                            and_(
                                Place.lat == round(payload.lat - 0.000001, 6),
                                Place.lng == round(payload.lng - 0.000001, 6)
                            )
                        )
                    )
                ).scalar_one_or_none()
                if existing:
                    return {"place_id": existing.place_id}

        raise HTTPException(status_code=409, detail="이미 등록된 장소입니다.")

    return {"place_id": obj.place_id}

@router.get("/search")
def search_places(q: str, db=Depends(get_db)):
    """저장된 장소를 이름으로 찾는다.

    순서는 최근에 간 곳 → 자주 간 곳 → 이름.
    정렬을 두지 않았을 때는 63번 간 카페가 네 번째에 놓이는 식이라
    한참 훑어야 했다.

    쓴 횟수와 마지막 날짜는 지출·대기에서 그때그때 세어 낸다.
    표에 세어 둔 값을 들고 있으면 내역을 고칠 때마다 맞춰 줘야 하고,
    한 번 어긋나면 되돌리기 어렵다. 2,800건 남짓이라 셀 때마다 세도 빠르다.

    정기는 빼 둔다 — 실제로 쓴 기록이 아니라 매달 도는 틀이라,
    한 줄을 1회로 세면 실제 다녀온 횟수와 어긋난다.

    대기는 아직 안 보낸 것(sended = 0)만 센다. 보내고 나면 지출에 같은 건이
    생기는데 대기 쪽 줄도 그대로 남아 있어서, 거르지 않으면 한 번 쓴 것이
    두 번으로 잡힌다.

    이름은 글자가 순서대로 들어 있기만 하면 걸린다.
    가게 이름은 `메가MGC커피 과천상상자이점` 인데 찾을 때는 `메가커피` 라고
    치게 되는데, 통째로 든 것만 찾으면 하나도 안 걸렸다.
    `%메%가%커%피%` 로 바꿔 두면 `스벅`→스타벅스, `맥날`→맥도날드 처럼
    앞 글자만 따서 부르는 이름도 걸린다.

    통째로 든 것을 먼저 세우고, 글자만 흩어져 든 것은 그 뒤에 붙인다.
    그래야 `카페` 로 찾을 때 이름에 `카페` 가 있는 곳이 밀리지 않는다.

    집계와 바깥 조인이 섞여 ORM 으로는 오히려 읽기 어려워 raw SQL을 쓴다.
    """
    kw = q.strip()

    def esc(s: str) -> str:
        """LIKE에서 뜻을 가지는 글자를 그냥 글자로 만든다."""
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

    # 통째로 든 것
    whole = f"%{esc(kw)}%"
    # 글자가 순서대로만 들어 있으면 되는 것. 띄어쓰기는 무시한다.
    letters = [esc(c) for c in kw if not c.isspace()]
    loose = "%" + "%".join(letters) + "%" if letters else "%"

    rows = db.execute(
        text(
            """
            SELECT p.place_id, p.place_name, p.city, p.district, p.town,
                   p.lat, p.lng
            FROM life_expense.places p
            LEFT JOIN (
                SELECT place_id,
                       COUNT(*)   AS used_count,
                       MAX(tx_date) AS last_used
                FROM (
                    SELECT place_id, tx_date
                    FROM life_expense.entries
                    WHERE place_id IS NOT NULL
                    UNION ALL
                    SELECT place_id, tx_date
                    FROM life_expense.pending_entries
                    WHERE place_id IS NOT NULL
                      AND sended = 0
                ) x
                GROUP BY place_id
            ) u ON u.place_id = p.place_id
            WHERE p.place_name ILIKE :loose ESCAPE '\\'
            ORDER BY CASE WHEN p.place_name ILIKE :whole ESCAPE '\\'
                          THEN 0 ELSE 1 END,
                     u.last_used DESC NULLS LAST,
                     COALESCE(u.used_count, 0) DESC,
                     p.place_name
            """
        ),
        {"whole": whole, "loose": loose},
    ).mappings().all()

    return [
        {
            "place_id": r["place_id"],
            "place_name": r["place_name"],
            "address": f"{r['city'] or ''} {r['district'] or ''} {r['town'] or ''}".strip(),
            "lat": r["lat"],
            "lng": r["lng"],
        }
        for r in rows
    ]

@router.get("/exists")
def check_place_exists(lat: float, lng: float, db=Depends(get_db)):

    from decimal import Decimal

    lat6 = Decimal(str(round(lat, 6)))
    lng6 = Decimal(str(round(lng, 6)))

    row = db.execute(
        select(Place).where(
            and_(
                Place.lat == lat6,
                Place.lng == lng6,
            )
        )
    ).scalar_one_or_none()

    if row:
        return {"place_id": row.place_id}
    return {"place_id": None}

@router.get("/exists-by-kakao")
def exists_by_kakao(kakao_id: str, db=Depends(get_db)):
    row = db.execute(
        select(Place).where(Place.kakao_id == kakao_id)
    ).scalar_one_or_none()

    if row:
        return {"place_id": row.place_id}
    return {"place_id": None}
