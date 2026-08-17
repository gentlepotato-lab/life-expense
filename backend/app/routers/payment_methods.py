from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from app.deps import SessionDep

# 자리는 main.py 에서 /api/payment-methods 로 붙인다
router = APIRouter()

# 목록 조회 — 자원 제 자리
@router.get("")
def list_methods(db: SessionDep = Depends()):
    rows = db.execute(text("""
        SELECT p.method_id
             , p.method_name
             , p.category_id
             -- 구분 이름·이모지는 분류 표에서 그대로 가져온다.
             -- 이름이 바뀌어도 FK 로 따라오므로 끊기지 않는다.
             , c.name  AS category
             , c.emoji AS category_emoji
             , p.is_active
             , p.sort_order
          FROM life_expense.payment_methods p
          LEFT JOIN life_expense.payment_method_categories c
                 ON c.category_id = p.category_id
      ORDER BY p.sort_order ASC, p.method_id ASC
    """)).mappings().all()
    return [dict(r) for r in rows]

# 단일 추가
@router.post("/add")
def add_method(
    name: str = Query(...),
    # 만들 때 바로 구분을 정할 수 있게 한다. 없으면 "구분 없음" 으로 들어간다.
    category_id: int | None = Query(None),
    db: SessionDep = Depends(),
):
    next_sort = db.execute(text("""
        SELECT COALESCE(MAX(sort_order), 0) + 1 AS nxt
          FROM life_expense.payment_methods
    """)).scalar_one()

    res = db.execute(text("""
        INSERT INTO life_expense.payment_methods (method_name, category_id, sort_order)
             VALUES (:name, :category_id, :sort)
          RETURNING method_id
    """), {"name": name, "category_id": category_id, "sort": next_sort}).fetchone()

    db.commit()
    return {"method_id": res.method_id}

# 전체 저장 → 이름 수정 + 구분 지정 + 정렬 순서 변경
@router.post("/save")
def save_methods(payload: list[dict], db: SessionDep = Depends()):
    for item in payload:
        # "키가 없다"(그대로 두기)와 "빈 값이다"(구분 없음으로 지우기)는 다르다.
        # COALESCE 로는 둘을 구분할 수 없어 플래그를 따로 넘긴다.
        has_category = "category_id" in item
        cat_id = item.get("category_id") or None

        db.execute(text("""
            UPDATE life_expense.payment_methods
               SET method_name = :name,
                   category_id = CASE WHEN :has_category THEN :cat_id ELSE category_id END,
                   is_active   = :is_active,
                   sort_order  = :sort
             WHERE method_id = :id
        """), {
            "id": item["method_id"],
            "name": item["method_name"],
            "sort": item["sort_order"],
            "has_category": has_category,
            "cat_id": cat_id,
            "is_active": 1 if item.get("is_active", 1) else 0,
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

# ─── 구분(분류) ────────────────────────────────────────────────
@router.get("/categories")
def list_categories(db: SessionDep = Depends()):
    """결제 수단의 구분 목록. 이모지도 이 행에 들어 있다"""
    rows = db.execute(text("""
        SELECT category_id, name, emoji, sort_order, is_active
          FROM life_expense.payment_method_categories
         WHERE is_active = 1
      ORDER BY sort_order ASC, category_id ASC
    """)).mappings().all()
    return [dict(r) for r in rows]


@router.post("/categories")
def create_category(payload: dict, db: SessionDep = Depends()):
    """구분을 새로 만든다. 같은 이름이 있으면 그것을 돌려준다(get-or-create)"""
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="이름을 입력하세요.")

    row = db.execute(text("""
        SELECT category_id, name, emoji, sort_order, is_active
          FROM life_expense.payment_method_categories
         WHERE name = :name
    """), {"name": name}).mappings().first()

    if row:
        # 껐던 구분을 다시 쓰는 경우 되살린다
        if not row["is_active"]:
            db.execute(text("""
                UPDATE life_expense.payment_method_categories
                   SET is_active = 1, updated_at = now()
                 WHERE category_id = :id
            """), {"id": row["category_id"]})
            db.commit()
        return dict(row)

    nxt = db.execute(text("""
        SELECT COALESCE(MAX(sort_order), 0) + 1
          FROM life_expense.payment_method_categories
    """)).scalar_one()

    created = db.execute(text("""
        INSERT INTO life_expense.payment_method_categories (name, emoji, sort_order)
             VALUES (:name, :emoji, :sort)
          RETURNING category_id, name, emoji, sort_order, is_active
    """), {
        "name": name,
        "emoji": (payload.get("emoji") or None),
        "sort": nxt,
    }).mappings().first()
    db.commit()
    return dict(created)


@router.delete("/categories/{category_id}")
def delete_category(category_id: int, db: SessionDep = Depends()):
    """쓰이고 있으면 지우지 않는다. 결제 수단 삭제와 같은 규칙이다"""
    used = db.execute(text("""
        SELECT count(*) FROM life_expense.payment_methods
         WHERE category_id = :id
    """), {"id": category_id}).scalar_one()

    if used:
        return {"error": "IN_USE", "used_count": used}

    db.execute(text("""
        DELETE FROM life_expense.payment_method_categories
         WHERE category_id = :id
    """), {"id": category_id})
    db.commit()
    return {"status": "deleted"}


@router.post("/categories/save")
def save_categories(payload: list[dict], db: SessionDep = Depends()):
    """구분의 이모지와 순서를 저장한다. 늘리고 줄이는 일은 다른 엔드포인트가 한다"""
    for i, item in enumerate(payload):
        db.execute(text("""
            UPDATE life_expense.payment_method_categories
               SET emoji = :emoji,
                   sort_order = :sort,
                   updated_at = now()
             WHERE category_id = :id
        """), {
            "id": item["category_id"],
            "emoji": (item.get("emoji") or None),
            # 보내 준 배열 순서를 그대로 순서로 삼는다
            "sort": item.get("sort_order", i + 1),
        })
    db.commit()
    return {"status": "ok"}
