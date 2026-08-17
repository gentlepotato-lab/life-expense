"""
상대(돈을 돌려준 사람/조직) 관리.

분할 편집 중에 이름만으로 즉석 등록할 수 있고(get-or-create),
Settings 화면에서 목록을 정리할 수도 있다.
"""
from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy import func

from app.deps import SessionDep
from app.models import Counterpart, CounterpartCategory, EntrySplit

router = APIRouter()


@router.get("")
def list_counterparts(include_inactive: bool = False, db: SessionDep = Depends()):
    q = db.query(Counterpart)
    if not include_inactive:
        q = q.filter(Counterpart.is_active == 1)
    rows = q.order_by(Counterpart.sort_order, Counterpart.name).all()
    return [c.to_dict() for c in rows]


@router.post("")
def create_counterpart(payload: dict, db: SessionDep = Depends()):
    """
    이름으로 등록한다. 같은 이름이 이미 있으면 그것을 돌려준다(get-or-create).
    분할 편집 중 인라인 생성에서 중복이 생기지 않도록 하기 위함이다.
    """
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="이름을 입력하세요.")

    existing = db.query(Counterpart).filter(Counterpart.name == name).first()
    if existing:
        # 껐던 상대를 다시 쓰는 경우 되살린다
        if existing.is_active != 1:
            existing.is_active = 1
            db.commit()
        return existing.to_dict()

    row = Counterpart(
        name=name,
        category_id=(payload.get("category_id") or None),
        memo=(payload.get("memo") or None),
        sort_order=payload.get("sort_order") or 0,
        is_active=1,
    )
    try:
        db.add(row)
        db.commit()
        db.refresh(row)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    return row.to_dict()


@router.put("/{counterpart_id}")
def update_counterpart(counterpart_id: int, payload: dict, db: SessionDep = Depends()):
    row = db.query(Counterpart).filter(Counterpart.counterpart_id == counterpart_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="counterpart not found")

    if "name" in payload:
        name = (payload.get("name") or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="이름을 입력하세요.")
        dup = (
            db.query(Counterpart)
            .filter(Counterpart.name == name, Counterpart.counterpart_id != counterpart_id)
            .first()
        )
        if dup:
            raise HTTPException(status_code=400, detail="이미 같은 이름이 있습니다.")
        row.name = name

    if "category_id" in payload:
        row.category_id = payload.get("category_id") or None
    if "memo" in payload:
        row.memo = payload.get("memo") or None
    if "sort_order" in payload:
        row.sort_order = payload.get("sort_order") or 0
    if "is_active" in payload:
        row.is_active = 1 if payload.get("is_active") else 0

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    return row.to_dict()


@router.delete("/{counterpart_id}")
def delete_counterpart(counterpart_id: int, db: SessionDep = Depends()):
    """
    쓰인 적이 있으면 지우지 않고 비활성으로 돌린다.
    (분할 쪽 FK 는 SET NULL 이라 지워도 금액은 남지만, 누구였는지가 사라지므로)
    """
    row = db.query(Counterpart).filter(Counterpart.counterpart_id == counterpart_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="counterpart not found")

    used = db.query(EntrySplit).filter(EntrySplit.counterpart_id == counterpart_id).count()

    try:
        if used:
            row.is_active = 0
            db.commit()
            return {"status": "deactivated", "used_count": used}
        db.delete(row)
        db.commit()
        return {"status": "deleted"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# 구분(분류) — 사용자가 늘릴 수 있다
# ═══════════════════════════════════════════════════════════════

# 아바타·점에 쓰는 색. 화면(colorPalette.ts)과 같은 순서로 맞춰 둔다.
PALETTE = [
    "indigo", "teal", "amber", "rose", "violet",
    "sky", "lime", "orange", "cyan", "slate",
]


def _next_color(db) -> str:
    """아직 쓰이지 않은 색을 앞에서부터 고른다. 다 쓰면 처음으로 돌아간다"""
    used = {c.color for c in db.query(CounterpartCategory).all() if c.color}
    for c in PALETTE:
        if c not in used:
            return c
    return PALETTE[db.query(CounterpartCategory).count() % len(PALETTE)]


@router.get("/categories")
def list_categories(db: SessionDep = Depends()):
    rows = (
        db.query(CounterpartCategory)
        .filter(CounterpartCategory.is_active == 1)
        .order_by(CounterpartCategory.sort_order, CounterpartCategory.category_id)
        .all()
    )
    return [c.to_dict() for c in rows]


@router.post("/categories")
def create_category(payload: dict, db: SessionDep = Depends()):
    """
    구분을 새로 만든다. 색은 비어 있으면 아직 안 쓰인 것으로 자동 배정한다.
    대부분은 색을 고를 일 없이 이름만 적으면 된다.
    """
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="이름을 입력하세요.")

    existing = db.query(CounterpartCategory).filter(CounterpartCategory.name == name).first()
    if existing:
        if existing.is_active != 1:
            existing.is_active = 1
            db.commit()
        return existing.to_dict()

    nxt = db.query(func.coalesce(func.max(CounterpartCategory.sort_order), 0)).scalar() or 0
    row = CounterpartCategory(
        name=name,
        emoji=(payload.get("emoji") or None),
        color=(payload.get("color") or _next_color(db)),
        sort_order=nxt + 1,
        is_active=1,
    )
    try:
        db.add(row)
        db.commit()
        db.refresh(row)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    return row.to_dict()


@router.post("/categories/save")
def save_categories(payload: list[dict], db: SessionDep = Depends()):
    """이모지·색·순서를 한 번에 반영한다"""
    for i, item in enumerate(payload):
        row = (
            db.query(CounterpartCategory)
            .filter(CounterpartCategory.category_id == item["category_id"])
            .first()
        )
        if not row:
            continue
        if "emoji" in item:
            row.emoji = item.get("emoji") or None
        if "color" in item:
            row.color = item.get("color") or None
        # 보내 준 배열 순서를 그대로 순서로 삼는다
        row.sort_order = item.get("sort_order", i + 1)
    db.commit()
    return {"status": "ok"}


@router.delete("/categories/{category_id}")
def delete_category(category_id: int, db: SessionDep = Depends()):
    """쓰이고 있으면 지우지 않는다. 결제 수단 쪽과 같은 규칙이다"""
    used = db.query(Counterpart).filter(Counterpart.category_id == category_id).count()
    if used:
        return {"error": "IN_USE", "used_count": used}

    row = (
        db.query(CounterpartCategory)
        .filter(CounterpartCategory.category_id == category_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="category not found")

    try:
        db.delete(row)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    return {"status": "deleted"}
