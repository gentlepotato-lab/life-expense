from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select, text
from datetime import date
import pandas as pd
from io import BytesIO
from app.models import Entry, Place
from app.schemas import EntryIn, EntryOut, EntryUpdate
from app.deps import get_db, SessionDep

router = APIRouter()

# 주소(지번/도로명) → city / district / town 분리
def _split_address(addr: str | None):
    if not addr:
        return None, None, None
    parts = addr.split()
    city = parts[0] if len(parts) > 0 else None
    district = parts[1] if len(parts) > 1 else None
    town = " ".join(parts[2:]) if len(parts) > 2 else None
    return city, district, town

# Kakao category_name: "대분류 > 중분류 > 소분류" 분리
def _split_category_name(cat: str | None):
    if not cat:
        return None, None, None
    parts = [p.strip() for p in cat.split(">")]
    c1 = parts[0] if len(parts) > 0 else None
    c2 = parts[1] if len(parts) > 1 else None
    c3 = parts[2] if len(parts) > 2 else None
    return c1, c2, c3

@router.get("")
def list_entries(start: date, end: date, db=Depends(get_db)):
    rows = db.scalars(select(Entry).where(Entry.tx_date.between(start, end))).all()
    return [r.to_dict() for r in rows]

@router.put("/bulk")
def update_entries_bulk(rows: list[dict], db: SessionDep = Depends()):
    updated = 0

    for r in rows:

        # ----------------------------
        # ① Place 처리 우선순위:
        #    1) kakao_id 기준 통합
        #    2) kakao_id 없으면 좌표로 통합
        # ----------------------------
        place_id = r.get("place_id")
        kakao_id = r.get("kakao_id")

        place_lat = r.get("place_lat")
        place_lng = r.get("place_lng")

        # >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
        # >>> ADD: place_id 우선 처리 (기존 장소 사용 또는 갱신)
        # >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
        if place_id:
            # Stored Place는 절대 업데이트하지 않음
            r["place_id"] = place_id
            goto_update_entry = True

            r["place_id"] = place_id
            goto_update_entry = True
        else:
            goto_update_entry = False
        # >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
        # >>> END ADD
        # >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

        # >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
        # >>> ADD: 1) kakao_id로 기존 찾기
        # >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
        if not goto_update_entry and kakao_id:
            exists = db.execute(text("""
                SELECT place_id FROM life_expense.places
                 WHERE kakao_id = :kid
                 LIMIT 1
            """), {"kid": kakao_id}).fetchone()

            if exists:
                place_id = exists.place_id

                db.execute(text("""
                    UPDATE life_expense.places
                       SET kakao_id = COALESCE(:kid, kakao_id),
                           place_name = :place_name,
                           address_name = :address_name,
                           road_address_name = :road_address_name,
                           phone = :phone,
                           category_l1 = :c1,
                           category_l2 = :c2,
                           category_l3 = :c3,
                           category_group_code = :cg_code,
                           category_group_name = :cg_name,
                           place_url = :place_url
                     WHERE place_id = :pid
                """), {
                    "kid": kakao_id,
                    "place_name": r.get("place_name"),
                    "lat": place_lat,
                    "lng": place_lng,
                    "address_name": r.get("address_name"),
                    "road_address_name": r.get("road_address_name"),
                    "phone": r.get("phone"),
                    "c1": _split_category_name(r.get("category_name"))[0],
                    "c2": _split_category_name(r.get("category_name"))[1],
                    "c3": _split_category_name(r.get("category_name"))[2],
                    "cg_code": r.get("category_group_code"),
                    "cg_name": r.get("category_group_name"),
                    "place_url": r.get("place_url"),
                    "pid": place_id
                })

                goto_update_entry = True
            # kakao_id로 검색했는데 없으면 좌표 비교로 진행
        # >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
        # >>> END ADD
        # >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

        # >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
        # >>> ADD: 2) lat/lng 동일한 기존 장소 찾기 (kakao_id가 없을 때만)
        # >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
        # kakao_id가 있으면 좌표 검색 건너뛰기 (같은 건물 내 다른 가게 구분)
        if not goto_update_entry and not kakao_id and place_lat and place_lng:
            # 원래 좌표와 미세 조정된 좌표(±0.000001) 모두 확인
            exists = db.execute(text("""
                SELECT place_id, kakao_id, lat, lng
                  FROM life_expense.places
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
            """), {"lat": place_lat, "lng": place_lng}).fetchone()

            if exists:
                place_id = exists.place_id

                db.execute(text("""
                    UPDATE life_expense.places
                       SET kakao_id = COALESCE(:kid, kakao_id),
                           place_name = :place_name,
                           address_name = :address_name,
                           road_address_name = :road_address_name,
                           phone = :phone,
                           category_l1 = :c1,
                           category_l2 = :c2,
                           category_l3 = :c3,
                           category_group_code = :cg_code,
                           category_group_name = :cg_name,
                           place_url = :place_url
                     WHERE place_id = :pid
                """), {
                    "kid": kakao_id,
                    "place_name": r.get("place_name"),
                    "lat": place_lat,
                    "lng": place_lng,
                    "address_name": r.get("address_name"),
                    "road_address_name": r.get("road_address_name"),
                    "phone": r.get("phone"),
                    "c1": _split_category_name(r.get("category_name"))[0],
                    "c2": _split_category_name(r.get("category_name"))[1],
                    "c3": _split_category_name(r.get("category_name"))[2],
                    "cg_code": r.get("category_group_code"),
                    "cg_name": r.get("category_group_name"),
                    "place_url": r.get("place_url"),
                    "pid": place_id
                })

                goto_update_entry = True
        # >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
        # >>> END ADD
        # >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

        # ------------------------------------------------------
        # (3) 신규 장소 INSERT
        # ------------------------------------------------------
        if (
            not goto_update_entry and
            r.get("place_name") and
            place_lat and place_lng
        ):
            # kakao_id가 있으면 좌표 검색 건너뛰고 바로 생성 (같은 건물 내 다른 가게 구분)
            if not kakao_id:
                # kakao_id가 없을 때만 좌표로 검색 (원래 좌표와 미세 조정된 좌표 모두 확인)
                exists = db.execute(text("""
                    SELECT place_id, kakao_id
                      FROM life_expense.places
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
                """), {"lat": place_lat, "lng": place_lng}).fetchone()

                if exists:
                    place_id = exists.place_id
            
            # kakao_id가 있으면 좌표 미세 조정하여 새로 생성 (같은 건물 내 다른 가게)
            if not place_id and kakao_id:
                # 기존에 같은 좌표의 장소가 있는지 확인 (미세 조정 전)
                exists_original = db.execute(text("""
                    SELECT place_id FROM life_expense.places
                     WHERE ROUND(lat::numeric, 6) = ROUND(CAST(:lat AS numeric), 6)
                       AND ROUND(lng::numeric, 6) = ROUND(CAST(:lng AS numeric), 6)
                     LIMIT 1
                """), {"lat": place_lat, "lng": place_lng}).fetchone()
                
                if exists_original:
                    # 같은 좌표의 장소가 있으면 사용 가능한 좌표를 찾을 때까지 미세 조정
                    base_lat = float(place_lat)
                    base_lng = float(place_lng)
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
                                place_lat = test_lat
                                place_lng = test_lng
                                break
                        else:
                            continue
                        break
            
            if not place_id:
                addr = r.get("address_name") or r.get("road_address_name")
                city, district, town = _split_address(addr)

                c1, c2, c3 = _split_category_name(r.get("category_name"))

                new_place = Place(
                    place_name=r.get("place_name"),
                    lat=place_lat,
                    lng=place_lng,
                    city=city,
                    district=district,
                    town=town,
                    kakao_id=r.get("kakao_id"),
                    address_name=r.get("address_name"),
                    road_address_name=r.get("road_address_name"),
                    phone=r.get("phone"),
                    category_l1=c1,
                    category_l2=c2,
                    category_l3=c3,
                    category_group_code=r.get("category_group_code"),
                    category_group_name=r.get("category_group_name"),
                    place_url=r.get("place_url"),
                )
                db.add(new_place)
                db.flush()
                place_id = new_place.place_id

        # ----------------------------
        # ② entries 업데이트
        # ----------------------------
        sql = text("""
            UPDATE life_expense.entries
               SET tx_date = :tx_date,
                   cat1_id = :cat1_id,
                   cat2_id = :cat2_id,
                   cat3_id = :cat3_id,
                   inout = :inout,
                   amount = :amount,
                   pay_method = :pay_method,
                   memo = :memo,
                   place_id = :place_id
             WHERE entry_id = :entry_id
        """)

        r["place_id"] = place_id
        db.execute(sql, r)
        updated += 1

    db.commit()

    db.execute(text("""
        DELETE FROM life_expense.places p
              WHERE NOT EXISTS (SELECT 1 FROM life_expense.entries e WHERE e.place_id = p.place_id)
                    AND NOT EXISTS (SELECT 1 FROM life_expense.pending_entries pe WHERE pe.place_id = p.place_id)
    """))
    db.commit()

    return {"updated": updated}

@router.get("/export")
def export_entries(start: date, end: date, fmt: str = Query("xlsx"), db=Depends(get_db)):
    rows = db.scalars(select(Entry).where(Entry.tx_date.between(start, end))).all()
    df = pd.DataFrame([r.to_dict() for r in rows])
    bio = BytesIO()
    if fmt == "csv":
        csv = df.to_csv(index=False).encode()
        return Response(csv, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=entries.csv"})
    with pd.ExcelWriter(bio, engine="openpyxl") as w:
        df.to_excel(w, index=False, sheet_name="Entries")
    return Response(bio.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=entries.xlsx"})

# 월별 조회 (YYYY-MM 형식)
@router.get("/month")
def get_entries_by_month(ym: str, db: SessionDep = Depends()):
    """
    yyyy-mm 형식(예: '2025-10')의 데이터를 조회
    """
    # SQL은 필요에 따라 백엔드에서 자유롭게 변경 가능
    sql = text(f"""
          SELECT e.*
                 , c3.cat3_name
                 , p.place_name
                 -- 돌려받은 몫을 뺀 실지출. 정의는 v_entries_net 한 곳에만 둔다
                 , COALESCE(vn.split_amount, 0) AS split_amount
                 , COALESCE(vn.net_amount, e.amount) AS net_amount
                 , COALESCE(vn.split_count, 0) AS split_count
            FROM life_expense.entries e
                     LEFT JOIN
                 life_expense.categories_lvl3 c3
                     ON e.cat3_id = c3.cat3_id
                     LEFT JOIN
                 life_expense.places p
                     ON e.place_id = p.place_id
                     LEFT JOIN
                 life_expense.v_entries_net vn
                     ON vn.entry_id = e.entry_id
           WHERE TO_CHAR(e.tx_date, 'YYYY-MM') = :ym
        ORDER BY e.tx_date DESC, e.entry_id DESC
    """)
    rows = db.execute(sql, {"ym": ym}).mappings().all()
    return [dict(r) for r in rows]

# 단일 삭제
@router.delete("/{entry_id}")
def delete_entry(entry_id: int, db: SessionDep = Depends()):
    sql = text("DELETE FROM life_expense.entries WHERE entry_id = :entry_id")
    result = db.execute(sql, {"entry_id": entry_id})
    db.commit()

    # life_expense.entries에서 사용하지 않는 place_id를 life_expense.places에서 제거
    db.execute(text("""
        DELETE FROM life_expense.places p
              WHERE NOT EXISTS (
                                  SELECT 1
                                    FROM life_expense.entries e
                                   WHERE e.place_id = p.place_id
                               )
    """))
    db.commit()
    return {"deleted": result.rowcount}

@router.post("")
def add_entries(payload: list[EntryIn], db: SessionDep = Depends()):
    for item in payload:

        # 기본적으로 place_id 우선 사용
        place_id = item.place_id

        # 만약 place_id는 없지만 name + 좌표가 넘어온 경우 → 중복 검사 후 생성
        if not place_id and item.place_name and item.place_lat and item.place_lng:
            # ① kakao_id로 검색
            if item.kakao_id:
                exists = db.execute(text("""
                    SELECT place_id FROM life_expense.places
                    WHERE kakao_id = :kid LIMIT 1
                """), {"kid": item.kakao_id}).fetchone()
                if exists:
                    place_id = exists.place_id
            
            # ② 좌표로 검색 (kakao_id가 없을 때만)
            if not place_id and not item.kakao_id:
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
                """), {"lat": item.place_lat, "lng": item.place_lng}).fetchone()
                if exists:
                    place_id = exists.place_id
            
            # kakao_id가 있으면 좌표 미세 조정하여 새로 생성 (같은 건물 내 다른 가게)
            if not place_id and item.kakao_id:
                # 기존에 같은 좌표의 장소가 있는지 확인 (미세 조정 전)
                exists_original = db.execute(text("""
                    SELECT place_id FROM life_expense.places
                     WHERE ROUND(lat::numeric, 6) = ROUND(CAST(:lat AS numeric), 6)
                       AND ROUND(lng::numeric, 6) = ROUND(CAST(:lng AS numeric), 6)
                     LIMIT 1
                """), {"lat": item.place_lat, "lng": item.place_lng}).fetchone()
                
                if exists_original:
                    # 같은 좌표의 장소가 있으면 사용 가능한 좌표를 찾을 때까지 미세 조정
                    base_lat = float(item.place_lat)
                    base_lng = float(item.place_lng)
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
                                item.place_lat = test_lat
                                item.place_lng = test_lng
                                break
                        else:
                            continue
                        break
            
            # ③ 그래도 없으면 신규 장소 생성
            if not place_id:
                # 주소/업종 분리
                addr = item.address_name or item.road_address_name
                city, district, town = _split_address(addr)

                cat_l1, cat_l2, cat_l3 = _split_category_name(item.category_name)

                new_place = Place(
                    place_name=item.place_name,

                    # 위치
                    lat=item.place_lat,
                    lng=item.place_lng,    # ← place_llng 버그 수정

                    # 행정 구역
                    city=city,
                    district=district,
                    town=town,

                    # Kakao 메타
                    kakao_id=item.kakao_id,
                    address_name=item.address_name,
                    road_address_name=item.road_address_name,
                    phone=item.phone,

                    category_l1=cat_l1,
                    category_l2=cat_l2,
                    category_l3=cat_l3,
                    category_group_code=item.category_group_code,
                    category_group_name=item.category_group_name,

                    place_url=item.place_url,
                )
                db.add(new_place)
                db.flush()
                place_id = new_place.place_id

        new_entry = Entry(
            tx_date=item.tx_date,
            cat1_id=item.cat1_id,
            cat2_id=item.cat2_id,
            cat3_id=item.cat3_id,
            inout=item.inout,
            amount=item.amount,
            pay_method=item.pay_method,
            memo=item.memo,
            place_id=place_id,
        )
        db.add(new_entry)

    db.commit()

    # life_expense.entries에서 사용하지 않는 place_id를 life_expense.places에서 제거
    db.execute(text("""
        DELETE FROM life_expense.places p
              WHERE NOT EXISTS (SELECT 1 FROM life_expense.entries e WHERE e.place_id = p.place_id)
                    AND NOT EXISTS (SELECT 1 FROM life_expense.pending_entries pe WHERE pe.place_id = p.place_id)
    """))
    db.commit()
    return {"status": "ok"}

# >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
# >>> ADD: 배열 필터링 처리 기능
# >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
def _parse_int_list(raw: str | None):
    """JSON 문자열 또는 '1,2,3' 형태를 리스트[int]로 변환"""
    if not raw:
        return None
    raw = raw.strip()
    raw = raw.replace("[", "").replace("]", "").replace('"', "")
    if not raw:
        return None
    return [int(x) for x in raw.split(",") if x.strip().isdigit()]

def _parse_str_list(raw: str | None):
    """JSON 문자열 또는 'CARD,CASH' 형태를 리스트[str]로 변환"""
    if not raw:
        return None
    raw = raw.strip()
    raw = raw.replace("[", "").replace("]", "").replace('"', "")
    if not raw:
        return None
    return [x.strip() for x in raw.split(",") if x.strip()]
# >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
# >>> END OF ADD
# >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

@router.get("/filter")
def filter_entries(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    # >>> ADD: 배열을 문자열(raw)로 받도록 변경
    cat1: str | None = Query(None),
    cat2: str | None = Query(None),
    cat3: str | None = Query(None),
    pay: str | None = Query(None),
    # >>> END ADD
    memo: str | None = Query(None),
    db: SessionDep = Depends()
):
    sql = """
        SELECT e.*
               , c3.cat3_name
               , p.place_name
               -- 돌려받은 몫을 뺀 실지출. 정의는 v_entries_net 한 곳에만 둔다
               , COALESCE(vn.split_amount, 0) AS split_amount
               , COALESCE(vn.net_amount, e.amount) AS net_amount
               , COALESCE(vn.split_count, 0) AS split_count
          FROM life_expense.entries e
                   LEFT JOIN
               life_expense.categories_lvl3 c3
                   ON e.cat3_id = c3.cat3_id
                   LEFT JOIN
               life_expense.places p
                   ON e.place_id = p.place_id
                   LEFT JOIN
               life_expense.v_entries_net vn
                   ON vn.entry_id = e.entry_id
         WHERE 1 = 1
    """

    params = {}

    if date_from:
        sql += " AND e.tx_date >= :date_from"
        params["date_from"] = date_from
    if date_to:
        sql += " AND e.tx_date <= :date_to"
        params["date_to"] = date_to

    # >>>>>>>>>>>>>>>>>>>>>>>>>>>
    # >>> cat1/cat2/cat3/pay 배열 처리
    # >>>>>>>>>>>>>>>>>>>>>>>>>>>

    # 중분류
    cat1_list = _parse_int_list(cat1)
    if cat1_list:
        sql += " AND e.cat1_id = ANY(:cat1_list)"
        params["cat1_list"] = cat1_list

    # 소분류
    cat2_list = _parse_int_list(cat2)
    if cat2_list:
        sql += " AND e.cat2_id = ANY(:cat2_list)"
        params["cat2_list"] = cat2_list

    # 세분류
    cat3_list = _parse_int_list(cat3)
    if cat3_list:
        sql += " AND e.cat3_id = ANY(:cat3_list)"
        params["cat3_list"] = cat3_list

    # 결제 수단
    pay_list = _parse_str_list(pay)
    if pay_list:
        sql += " AND e.pay_method = ANY(:pay_list)"
        params["pay_list"] = pay_list

    # >>>>>>>>>>>>>>>>>>>>>>>>>>>
    # >>> END
    # >>>>>>>>>>>>>>>>>>>>>>>>>>>

    if memo:
        sql += " AND e.memo LIKE :memo"
        params["memo"] = f"%{memo}%"

    sql += " ORDER BY e.tx_date DESC, e.entry_id DESC"

    rows = db.execute(text(sql), params).mappings().all()
    return [dict(r) for r in rows]