"""
분류(3뎁스) — 중분류 · 소분류 · 세분류.

자리는 main.py 에서 /api/categories 로 붙인다.
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models import CategoryL1, CategoryL2, CategoryL3
from app.deps import get_db

router = APIRouter()

@router.get("/lvl1")
def cat1(db=Depends(get_db)):
    rows = db.execute(
        select(CategoryL1.cat1_id, CategoryL1.cat1_name, CategoryL1.emoji,
               CategoryL1.is_active)
        .order_by(CategoryL1.sort_order)
    ).all()
    # 감춘 것도 함께 준다. 지난 내역이 그 분류를 가리키고 있어 이름을 찾으려면
    # 목록에 있어야 하기 때문이다. 고르는 목록에서 빼는 일은 화면이 한다.
    return [{"id": i, "name": n, "emoji": e, "is_active": a} for i, n, e, a in rows]

@router.get("/lvl2")
def cat2(cat1_id: int | None = Query(None), db=Depends(get_db)):
    """
    cat1_id가 주어지면 해당 중분류에 속한 소분류만,
    주어지지 않으면 전체 소분류를 정렬 순서대로 반환...
    """
    stmt = select(
        CategoryL2.cat2_id,
        CategoryL2.cat2_name,
        CategoryL2.cat1_id,
        CategoryL2.blur_flag,
        CategoryL2.inout,
        CategoryL2.is_active
    ).order_by(CategoryL2.cat1_id, CategoryL2.sort_order)

    if cat1_id:
        stmt = stmt.where(CategoryL2.cat1_id == cat1_id)

    rows = db.execute(stmt).all()
    return [
        {"id": i, "name": n, "cat1_id": c1, "blur": b, "inout": io, "is_active": a}
        for i, n, c1, b, io, a in rows
    ]

@router.get("/lvl3")
def cat3(cat2_id: int | None = Query(None), db=Depends(get_db)):
    stmt = select(
        CategoryL3.cat3_id,
        CategoryL3.cat3_name,
        CategoryL3.cat2_id,
        CategoryL3.is_active,
    ).order_by(CategoryL3.cat2_id, CategoryL3.sort_order)

    if cat2_id is not None:
        stmt = stmt.where(CategoryL3.cat2_id == cat2_id)

    rows = db.execute(stmt).all()
    return [{"id": i, "name": n, "cat2_id": c2, "is_active": a} for i, n, c2, a in rows]

@router.post("/add/lvl3")
def add_cat3(cat2_id: int = Query(...), name: str = Query(...), db=Depends(get_db)):
    existing = db.query(CategoryL3).filter(
        CategoryL3.cat2_id == cat2_id,
        CategoryL3.cat3_name == name
    ).first()
    if existing:
        return {"status": "exists"}

    max_order = db.query(CategoryL3.sort_order)\
        .filter(CategoryL3.cat2_id == cat2_id)\
        .order_by(CategoryL3.sort_order.desc()).first()

    next_order = (max_order[0] if max_order else 0) + 1
    new = CategoryL3(cat3_name=name, cat2_id=cat2_id, sort_order=next_order)

    db.add(new)
    db.commit()
    db.refresh(new)

    return {"status": "ok", "cat3_id": new.cat3_id, "cat3_name": new.cat3_name}

@router.post("/save")
def save_categories(payload: dict, db: Session = Depends(get_db)):
    cat1_list = payload.get("cat1", [])
    cat2_list = payload.get("cat2", [])
    cat3_list = payload.get("cat3", [])

    id_map_cat1 = {}

    # 중분류 처리 (신규 + 기존)
    for item in cat1_list:
        cid = item["cat1_id"]
        if isinstance(cid, str) and cid.startswith("new_"):
            new = CategoryL1(
                cat1_name=item["cat1_name"],
                sort_order=item["sort_order"],
                emoji=(item.get("emoji") or None),
            )
            db.add(new)
            db.flush()
            id_map_cat1[cid] = new.cat1_id
        else:
            update_data = {
                "cat1_name": item["cat1_name"],
                "sort_order": item["sort_order"],
            }
            if "is_active" in item:
                update_data["is_active"] = 1 if item["is_active"] else 0
            # 키가 없으면 그대로 두고, 빈 값이면 지운다
            if "emoji" in item:
                update_data["emoji"] = item.get("emoji") or None
            db.query(CategoryL1).filter(CategoryL1.cat1_id == cid).update(update_data)

    # 소분류 처리 (신규 + 기존)
    for item in cat2_list:
        cid = item["cat2_id"]
        parent = id_map_cat1.get(item["cat1_id"], item["cat1_id"])
        
        # inout 값 검증: -1 또는 1만 허용
        inout_value = item.get("inout")
        if inout_value is not None and inout_value not in (-1, 1):
            raise HTTPException(status_code=400, detail="inout 값은 -1(지출) 또는 1(수입)만 허용됩니다.")

        if isinstance(cid, str) and cid.startswith("new_"):
            new = CategoryL2(
                cat2_name=item["cat2_name"],
                cat1_id=parent,
                sort_order=item["sort_order"],
                inout=inout_value
            )
            db.add(new)
        else:
            update_data = {
                "cat2_name": item["cat2_name"],
                "cat1_id": parent,
                "sort_order": item["sort_order"]
            }
            if "is_active" in item:
                update_data["is_active"] = 1 if item["is_active"] else 0
            if "inout" in item:
                update_data["inout"] = inout_value
            db.query(CategoryL2).filter(CategoryL2.cat2_id == cid).update(update_data)

    # 세분류 처리
    for item in cat3_list:
        cid = item["cat3_id"]
        parent = item["cat2_id"]

        if isinstance(cid, str) and cid.startswith("new_"):
            new = CategoryL3(
                cat3_name=item["cat3_name"],
                cat2_id=parent,
                sort_order=item["sort_order"]
            )
            db.add(new)
        else:
            update3 = {
                "cat3_name": item["cat3_name"],
                "cat2_id": parent,
                "sort_order": item["sort_order"],
            }
            if "is_active" in item:
                update3["is_active"] = 1 if item["is_active"] else 0
            db.query(CategoryL3).filter(CategoryL3.cat3_id == cid).update(update3)

    db.commit()
    return {"status": "ok"}

@router.post("/add/lvl1")
def add_cat1(
    name: str = Query(...),
    db: Session = Depends(get_db)
):
    max_order = db.query(CategoryL1.sort_order)\
        .order_by(CategoryL1.sort_order.desc()).first()
    next_order = (max_order[0] if max_order else 0) + 1

    new_item = CategoryL1(cat1_name=name, sort_order=next_order)
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return {
        "cat1_id": new_item.cat1_id,
        "cat1_name": new_item.cat1_name
    }

@router.post("/add/lvl2")
def add_cat2(
    cat1_id: int = Query(...),
    name: str = Query(...),
    inout: int | None = Query(None),
    db: Session = Depends(get_db)
):
    # inout 값 검증: -1 또는 1만 허용
    if inout is not None and inout not in (-1, 1):
        raise HTTPException(status_code=400, detail="inout 값은 -1(지출) 또는 1(수입)만 허용됩니다.")
    
    # 중복 체크
    existing = db.query(CategoryL2).filter(
        CategoryL2.cat1_id == cat1_id,
        CategoryL2.cat2_name == name
    ).first()
    if existing:
        return {"status": "exists"}

    max_order = db.query(CategoryL2.sort_order)\
        .filter(CategoryL2.cat1_id == cat1_id)\
        .order_by(CategoryL2.sort_order.desc()).first()
    next_order = (max_order[0] if max_order else 0) + 1

    new_item = CategoryL2(cat1_id=cat1_id, cat2_name=name, sort_order=next_order, inout=inout)
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return {
        "status": "ok",
        "cat2_id": new_item.cat2_id,
        "cat2_name": new_item.cat2_name,
        "cat1_id": new_item.cat1_id
    }

@router.delete("/delete/lvl1")
def delete_cat1(cat1_id: int, db: Session = Depends(get_db)):
    try:
        # 하위 소분류 먼저 삭제
        db.query(CategoryL2).filter(CategoryL2.cat1_id == cat1_id).delete()
        # 중분류 삭제
        db.query(CategoryL1).filter(CategoryL1.cat1_id == cat1_id).delete()
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="USED_CATEGORY")

    return {"status": "ok"}

@router.delete("/delete/lvl2")
def delete_cat2(cat2_id: int, db: Session = Depends(get_db)):
    # 1) entries 테이블에서 사용 여부 확인
    used = db.execute(text("""
        SELECT 1
          FROM life_expense.entries
         WHERE cat2_id = :cid
         LIMIT 1
    """), {"cid": cat2_id}).fetchone()

    if used:
        raise HTTPException(status_code=409, detail="USED_CATEGORY")

    # 2) 세분류 먼저 삭제
    db.query(CategoryL3).filter(CategoryL3.cat2_id == cat2_id).delete()

    # 3) 소분류 삭제
    db.query(CategoryL2).filter(CategoryL2.cat2_id == cat2_id).delete()
    db.commit()

    return {"status": "ok"}

@router.delete("/delete/lvl3")
def delete_cat3(cat3_id: int, db: Session = Depends(get_db)):
    used = db.execute(text("""
        SELECT 1
          FROM life_expense.entries
         WHERE cat3_id = :cid
         LIMIT 1
    """), {"cid": cat3_id}).fetchone()

    if used:
        raise HTTPException(status_code=409, detail="USED_CATEGORY")

    db.query(CategoryL3).filter(CategoryL3.cat3_id == cat3_id).delete()
    db.commit()
    return {"status": "ok"}

@router.post("/blur/set")
def set_blur(
    cat1_id: int = Query(...),
    cat2_id: int = Query(...),
    enabled: bool = Query(...),
    db: Session = Depends(get_db)
):
    db.query(CategoryL2).filter(
        CategoryL2.cat1_id == cat1_id,
        CategoryL2.cat2_id == cat2_id
    ).update({"blur_flag": 1 if enabled else 0})
    db.commit()
    return {"status": "ok"}
