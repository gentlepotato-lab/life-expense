from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy import text
from app.deps import get_db, SessionDep
from app.models import PendingEntry, CategoryL1, CategoryL2, CategoryL3, PaymentMethod, Place
import pandas as pd
from io import BytesIO

router = APIRouter()

from typing import Optional, List
from pydantic import BaseModel, ConfigDict, field_validator

class PendingUpdate(BaseModel):
    model_config = ConfigDict(extra="allow")

    entry_id: Optional[int] = None

    tx_date: Optional[str] = None
    cat1_id: Optional[int] = None
    cat2_id: Optional[int] = None
    cat3_id: Optional[int] = None
    inout: Optional[int] = None
    amount: Optional[float] = None
    pay_method: Optional[int] = None
    memo: Optional[str] = None

    place_id: Optional[int] = None
    place_name: Optional[str] = None
    place_lat: Optional[float] = None
    place_lng: Optional[float] = None
    kakao_id: Optional[str] = None
    address_name: Optional[str] = None
    road_address_name: Optional[str] = None
    phone: Optional[str] = None
    category_name: Optional[str] = None
    category_group_code: Optional[str] = None
    category_group_name: Optional[str] = None
    place_url: Optional[str] = None

    @field_validator("*", mode="before")
    def empty_to_none(cls, v):
        if v in ("", "null", None):
            return None
        return v

# -------------------------
# 공통 처리 유틸 추가(Entries와 동일)
# -------------------------

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

def load_meta_maps(db):
    cat1_map = {r.cat1_name: r.cat1_id for r in db.query(CategoryL1).all()}
    cat2_map = {(r.cat1_id, r.cat2_name): r.cat2_id for r in db.query(CategoryL2).all()}
    cat3_map = {(r.cat2_id, r.cat3_name): r.cat3_id for r in db.query(CategoryL3).all()}
    pay_map = {r.method_name: r.method_id for r in db.query(PaymentMethod).all()}

    return cat1_map, cat2_map, cat3_map, pay_map

@router.post("/import")
async def import_pending_entries(
    file: UploadFile = File(...),
    db: SessionDep = Depends()
):

    # 1) 엑셀 읽기
    file_bytes = await file.read()
    df = pd.read_excel(BytesIO(file_bytes))

    required_cols = ["날짜", "중분류", "소분류", "세분류", "IN/OUT", "결제 수단", "금액", "메모"]
    for col in required_cols:
        if col not in df.columns:
            return {"error": f"Excel에 '{col}' 컬럼이 없습니다."}

    # 2) 메타 매핑 로딩
    cat1_map, cat2_map, cat3_map, pay_map = load_meta_maps(db)

    # 3) 변환된 row 리스트
    inserted = 0

    for _, row in df.iterrows():
        # 중분류 → cat1_id
        c1 = cat1_map.get(str(row["중분류"]).strip())
        c2 = None
        c3 = None

        if c1:
            # 소분류 → cat2_id
            c2 = cat2_map.get((c1, str(row["소분류"]).strip()))

            if c2:
                # 세분류 → cat3_id
                c3 = cat3_map.get((c2, str(row["세분류"]).strip()))

        # IN/OUT 변환
        inout = 1 if str(row["IN/OUT"]).upper() == "IN" else -1

        # 결제 수단 이름 → method_id
        pay = pay_map.get(str(row["결제 수단"]).strip())

        # 메모 NaN 처리
        memo_value = row.get("메모")
        memo = None if pd.isna(memo_value) else str(memo_value)
        
        new_item = PendingEntry(
            tx_date=row["날짜"],
            cat1_id=c1,
            cat2_id=c2,
            cat3_id=c3,
            inout=inout,
            amount=row["금액"],
            pay_method=pay,
            memo=memo
        )

        db.add(new_item)
        inserted += 1

    db.commit()
    return {"status": "ok", "inserted": inserted}

@router.get("")
def list_pending_entries(db: SessionDep = Depends()):
    sql = text("""
        SELECT p.*
             , pl.place_name
             , pl.lat AS place_lat
             , pl.lng AS place_lng
             , pl.kakao_id
             , pl.address_name
             , pl.road_address_name
             , pl.phone
             , pl.category_l1
             , pl.category_l2
             , pl.category_l3
             , pl.category_group_code
             , pl.category_group_name
             , pl.place_url
             , COALESCE(vn.split_amount, 0) AS split_amount
             , COALESCE(vn.net_amount, p.amount) AS net_amount
             , COALESCE(vn.split_count, 0) AS split_count
             -- 화면에서 "함께한 상대"로 걸러 낼 수 있도록 상대 ID를 함께 보낸다.
             -- 목록을 한 번만 읽고 화면에서 거르는 구조라, 행마다 들려 있어야 한다.
             , COALESCE(
                   (SELECT array_agg(DISTINCT s.counterpart_id)
                      FROM life_expense.pending_entry_splits s
                     WHERE s.pending_id = p.entry_id
                       AND s.counterpart_id IS NOT NULL),
                   '{}'
               ) AS counterpart_ids
        FROM life_expense.pending_entries p
        LEFT JOIN life_expense.places pl
               ON p.place_id = pl.place_id
        LEFT JOIN life_expense.v_pending_entries_net vn
               ON vn.entry_id = p.entry_id
        WHERE p.sended = 0
        ORDER BY p.tx_date DESC, p.entry_id DESC
    """)

    rows = db.execute(sql).mappings().all()
    return [dict(r) for r in rows]

from app.models import Entry, EntrySplit, PendingEntrySplit
from app.routers.splits import copy_splits


def _carry_splits(db, pending_id: int, entry_id: int) -> None:
    """Pending의 분할을 새로 만든 Entry로 옮겨 적는다."""
    copy_splits(db, PendingEntrySplit, "pending_id", pending_id,
                EntrySplit, "entry_id", entry_id)

@router.post("/send/{entry_id}")
def send_pending(entry_id: int, db: SessionDep = Depends()):

    p = db.get(PendingEntry, entry_id)
    if not p:
        return {"error": "not found"}

    new_entry = Entry(
        tx_date=p.tx_date,
        cat1_id=p.cat1_id,
        cat2_id=p.cat2_id,
        cat3_id=p.cat3_id,
        inout=p.inout,
        amount=float(p.amount),
        pay_method=p.pay_method,
        memo=p.memo,
        place_id=p.place_id  # ← ← ← 중요: 기존 장소 그대로 전달
    )

    db.add(new_entry)
    db.flush()                      # entry_id를 받아야 분할을 붙일 수 있다.
    _carry_splits(db, p.entry_id, new_entry.entry_id)
    p.sended = True
    db.commit()

    return {"status": "ok", "entry_id": new_entry.entry_id}

@router.post("/send-all")
def send_all_pending(db: SessionDep = Depends()):
    """모든 pending entries를 entries로 전송(sended = 0인 항목만)"""
    
    # sended = 0인 모든 pending entries 조회
    pending_items = db.query(PendingEntry).filter(PendingEntry.sended == 0).all()
    
    if not pending_items:
        return {"status": "ok", "sent_count": 0, "message": "전송할 항목이 없습니다."}
    
    sent_count = 0
    
    for p in pending_items:
        # Entry 생성
        new_entry = Entry(
            tx_date=p.tx_date,
            cat1_id=p.cat1_id,
            cat2_id=p.cat2_id,
            cat3_id=p.cat3_id,
            inout=p.inout,
            amount=float(p.amount),
            pay_method=p.pay_method,
            memo=p.memo,
            place_id=p.place_id
        )
        
        db.add(new_entry)
        db.flush()                  # entry_id를 받아야 분할을 붙일 수 있다.
        _carry_splits(db, p.entry_id, new_entry.entry_id)
        p.sended = True
        sent_count += 1
    
    db.commit()
    
    return {"status": "ok", "sent_count": sent_count}

class SendFilteredRequest(BaseModel):
    entry_ids: List[int]

@router.post("/send-filtered")
def send_filtered_pending(payload: SendFilteredRequest, db: SessionDep = Depends()):
    """필터링된 pending entries를 entries로 전송"""
    
    if not payload.entry_ids:
        return {"status": "ok", "sent_count": 0, "message": "전송할 항목이 없습니다."}
    
    # 지정된 entry_ids에 해당하는 pending entries 조회
    pending_items = db.query(PendingEntry).filter(
        PendingEntry.entry_id.in_(payload.entry_ids),
        PendingEntry.sended == 0
    ).all()
    
    if not pending_items:
        return {"status": "ok", "sent_count": 0, "message": "전송할 항목이 없습니다."}
    
    sent_count = 0
    
    for p in pending_items:
        # Entry 생성
        new_entry = Entry(
            tx_date=p.tx_date,
            cat1_id=p.cat1_id,
            cat2_id=p.cat2_id,
            cat3_id=p.cat3_id,
            inout=p.inout,
            amount=float(p.amount),
            pay_method=p.pay_method,
            memo=p.memo,
            place_id=p.place_id
        )
        
        db.add(new_entry)
        db.flush()                  # entry_id를 받아야 분할을 붙일 수 있다.
        _carry_splits(db, p.entry_id, new_entry.entry_id)
        p.sended = True
        sent_count += 1
    
    db.commit()
    
    return {"status": "ok", "sent_count": sent_count}

from typing import List

# ⚠ bulk 라우트를 먼저 선언해야 /bulk가 /{entry_id} 보다 우선 매칭됨
@router.put("/bulk")
def bulk_update_pending(payload: List[PendingUpdate], db: SessionDep = Depends()):
    """
    여러 PendingEntry를 한 번에 저장하는 bulk 업데이트
    """
    for item in payload:
        row = item.model_dump()
        entry_id = row.get("entry_id")
        if not entry_id:
            continue

        # ---- 장소 처리 로직 ----
        place_id = row.get("place_id")
        kakao_id = row.get("kakao_id")
        lat = row.get("place_lat")
        lng = row.get("place_lng")

        # ① 기존 place_id 유지
        if place_id:
            pass

        # ② kakao_id로 검색
        elif kakao_id:
            exists = db.execute(text("""
                SELECT place_id FROM life_expense.places
                WHERE kakao_id = :kid LIMIT 1
            """), {"kid": kakao_id}).fetchone()
            if exists:
                place_id = exists.place_id

        # ③ 좌표로 검색(kakao_id가 없을 때만)
        if not place_id and not kakao_id and lat and lng:
            # 원래 좌표와 미세 조정된 좌표(±0.000001) 모두 확인
            exists = db.execute(text("""
                SELECT place_id, kakao_id FROM life_expense.places
                WHERE (
                    (ROUND(lat::numeric, 6) = ROUND(CAST(:lat AS numeric), 6)
                     AND ROUND(lng::numeric, 6) = ROUND(CAST(:lng AS numeric), 6))
                    OR
                    (ROUND(lat::numeric, 6) = ROUND(CAST(:lat AS numeric) + 0.000001, 6)
                     AND ROUND(lng::numeric, 6) = ROUND(CAST(:lng AS numeric) + 0.000001, 6))
                    OR
                    (ROUND(lat::numeric, 6) = ROUND(CAST(:lat AS numeric) - 0.000001, 6)
                     AND ROUND(lng::numeric, 6) = ROUND(CAST(:lng AS numeric) - 0.000001, 6))
                )
                LIMIT 1
            """), {"lat": lat, "lng": lng}).fetchone()
            
            if exists:
                place_id = exists.place_id
        
        # kakao_id가 있으면 좌표 미세 조정하여 새로 생성(같은 건물 내 다른 가게)
        if not place_id and kakao_id and lat and lng:
            # 기존에 같은 좌표의 장소가 있는지 확인(미세 조정 전)
            exists_original = db.execute(text("""
                SELECT place_id FROM life_expense.places
                 WHERE ROUND(lat::numeric, 6) = ROUND(CAST(:lat AS numeric), 6)
                   AND ROUND(lng::numeric, 6) = ROUND(CAST(:lng AS numeric), 6)
                 LIMIT 1
            """), {"lat": lat, "lng": lng}).fetchone()
            
            if exists_original:
                # 같은 좌표의 장소가 있으면 사용 가능한 좌표를 찾을 때까지 미세 조정
                base_lat = float(lat)
                base_lng = float(lng)
                offset = 0.000001
                max_attempts = 100
                
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
                        exists_test = db.execute(text("""
                            SELECT place_id FROM life_expense.places
                             WHERE ROUND(lat::numeric, 6) = ROUND(CAST(:lat AS numeric), 6)
                               AND ROUND(lng::numeric, 6) = ROUND(CAST(:lng AS numeric), 6)
                             LIMIT 1
                        """), {"lat": test_lat, "lng": test_lng}).fetchone()
                        
                        if not exists_test:
                            # 사용 가능한 좌표를 찾음
                            lat = test_lat
                            lng = test_lng
                            break
                    else:
                        continue
                    break

        # ④ 그래도 없으면 신규 장소 생성
        if not place_id and lat and lng:
            addr = row.get("address_name") or row.get("road_address_name")
            city, district, town = _split_address(addr)

            c1, c2, c3 = _split_category_name(row.get("category_name"))

            new_place = Place(
                place_name=row.get("place_name"),
                lat=lat,
                lng=lng,

                city=city,
                district=district,
                town=town,

                kakao_id=kakao_id,
                address_name=row.get("address_name"),
                road_address_name=row.get("road_address_name"),
                phone=row.get("phone"),

                category_l1=c1,
                category_l2=c2,
                category_l3=c3,
                category_group_code=row.get("category_group_code"),
                category_group_name=row.get("category_group_name"),

                place_url=row.get("place_url"),
            )

            db.add(new_place)
            db.flush()
            place_id = new_place.place_id

        # 최종 place_id 적용
        row["place_id"] = place_id

        # ---- UPDATE 실행 ----
        sql = text("""
            UPDATE life_expense.pending_entries
               SET tx_date=:tx_date,
                   cat1_id=:cat1_id,
                   cat2_id=:cat2_id,
                   cat3_id=:cat3_id,
                   inout=:inout,
                   amount=:amount,
                   pay_method=:pay_method,
                   memo=:memo,
                   place_id=:place_id
             WHERE entry_id=:entry_id
        """)

        sql_params = {
            "entry_id": row["entry_id"],
            "tx_date": row.get("tx_date"),
            "cat1_id": row.get("cat1_id"),
            "cat2_id": row.get("cat2_id"),
            "cat3_id": row.get("cat3_id"),
            "inout": row.get("inout"),
            "amount": row.get("amount"),
            "pay_method": row.get("pay_method"),
            "memo": row.get("memo"),
            "place_id": row.get("place_id"),
        }

        db.execute(sql, sql_params)

    db.commit()
    return {"updated": True, "count": len(payload)}


@router.put("/{entry_id}")
def update_pending(entry_id: int, payload: PendingUpdate, db: SessionDep = Depends()):
    """
    Pending 항목 수정(장소 정보 포함) - 단건
    """

    place_id = payload.place_id
    kakao_id = payload.kakao_id
    lat = payload.place_lat
    lng = payload.place_lng

    # ① 기존 place_id가 있으면 그걸 우선 유지
    if place_id:
        pass

    # ② kakao_id로 기존 장소 검색
    elif kakao_id:
        exists = db.execute(text("""
            SELECT place_id
              FROM life_expense.places
             WHERE kakao_id = :kid
             LIMIT 1
        """), {"kid": kakao_id}).fetchone()

        if exists:
            place_id = exists.place_id

    # ③ 위에서 못 찾으면 좌표 기반 검색
    if not place_id and lat and lng:
        exists = db.execute(text("""
            SELECT place_id
              FROM life_expense.places
             WHERE ROUND(lat::numeric, 6) = ROUND(CAST(:lat AS numeric), 6)
               AND ROUND(lng::numeric, 6) = ROUND(CAST(:lng AS numeric), 6)
             LIMIT 1
        """), {"lat": lat, "lng": lng}).fetchone()

        if exists:
            place_id = exists.place_id

    # ④ 그래도 없으면 신규 장소 생성
    if not place_id and lat and lng:
        addr = payload.address_name or payload.road_address_name
        city, district, town = _split_address(addr)

        c1, c2, c3 = _split_category_name(payload.category_name)

        new_place = Place(
            place_name=payload.place_name,
            lat=lat,
            lng=lng,

            city=city,
            district=district,
            town=town,

            kakao_id=kakao_id,
            address_name=payload.address_name,
            road_address_name=payload.road_address_name,
            phone=payload.phone,

            category_l1=c1,
            category_l2=c2,
            category_l3=c3,
            category_group_code=payload.category_group_code,
            category_group_name=payload.category_group_name,

            place_url=payload.place_url,
        )
        db.add(new_place)
        db.flush()
        place_id = new_place.place_id

    # ⑤ pending_entries UPDATE
    sql = text("""
        UPDATE life_expense.pending_entries
           SET tx_date=:tx_date,
               cat1_id=:cat1_id,
               cat2_id=:cat2_id,
               cat3_id=:cat3_id,
               inout=:inout,
               amount=:amount,
               pay_method=:pay_method,
               memo=:memo,
               place_id=:place_id
         WHERE entry_id=:entry_id
    """)

    params = {
        "entry_id": entry_id,
        "tx_date": payload.tx_date,
        "cat1_id": payload.cat1_id,
        "cat2_id": payload.cat2_id,
        "cat3_id": payload.cat3_id,
        "inout": payload.inout,
        "amount": payload.amount,
        "pay_method": payload.pay_method,
        "memo": payload.memo,
        "place_id": place_id,
    }

    db.execute(sql, params)
    db.commit()

    return {"updated": True}

@router.delete("/{entry_id}")
def delete_pending(entry_id: int, db: SessionDep = Depends()):
    db.execute(
        text("DELETE FROM life_expense.pending_entries WHERE entry_id = :id"),
        {"id": entry_id}
    )
    db.commit()
    return {"deleted": True}
