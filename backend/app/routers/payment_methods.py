from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from app.deps import SessionDep

router = APIRouter(prefix="/payment-methods")

# 목록 조회
@router.get("/list")
def list_methods(db: SessionDep = Depends()):
    rows = db.execute(text("""
        SELECT method_id, method_name, sort_order
          FROM life_expense.payment_methods
      ORDER BY sort_order ASC, method_id ASC
    """)).mappings().all()
    return [dict(r) for r in rows]

# 단일 추가
@router.post("/add")
def add_method(name: str = Query(...), db: SessionDep = Depends()):
    next_sort = db.execute(text("""
        SELECT COALESCE(MAX(sort_order), 0) + 1 AS nxt
          FROM life_expense.payment_methods
    """)).scalar_one()

    res = db.execute(text("""
        INSERT INTO life_expense.payment_methods (method_name, sort_order)
             VALUES (:name, :sort)
          RETURNING method_id
    """), {"name": name, "sort": next_sort}).fetchone()

    db.commit()
    return {"method_id": res.method_id}

# 전체 저장 → 이름 수정 + 정렬 순서 변경
@router.post("/save")
def save_methods(payload: list[dict], db: SessionDep = Depends()):
    for item in payload:
        db.execute(text("""
            UPDATE life_expense.payment_methods
               SET method_name = :name,
                   sort_order = :sort
             WHERE method_id = :id
        """), {
            "id": item["method_id"],
            "name": item["method_name"],
            "sort": item["sort_order"]
        })
    db.commit()
    return {"status": "ok"}

# 삭제
@router.delete("/delete")
def delete_method(method_id: int, db: SessionDep = Depends()):
    # entries 사용 중이면 막기...
    used = db.execute(text("""
        SELECT 1 FROM life_expense.entries
         WHERE pay_method = :id
         LIMIT 1
    """), {"id": method_id}).fetchone()

    if used:
        return {"error": "IN_USE"}

    db.execute(text("""
        DELETE FROM life_expense.payment_methods
         WHERE method_id = :id
    """), {"id": method_id})
    db.commit()

    return {"status": "deleted"}