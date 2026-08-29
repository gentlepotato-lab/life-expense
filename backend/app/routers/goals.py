from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from app.deps import SessionDep

# 자리는 main.py에서 /api/goals로 붙인다.
router = APIRouter()


@router.get("")
def list_goals(db: SessionDep = Depends()):
    """
    걸어 둔 목표를 분류 이름까지 붙여 돌려준다.

    이름을 함께 보내는 것은 화면이 분류 세 벌을 따로 받아 짝을 맞추지 않아도
    되게 하려는 것이다. 이름이 바뀌어도 FK로 따라오므로 어긋나지 않는다.
    """
    rows = db.execute(text("""
        SELECT g.goal_id
             , g.cat1_id, g.cat2_id, g.cat3_id
             , g.amount
             , g.memo
             , g.sort_order
             , c1.cat1_name AS cat1_name
             , c1.emoji     AS cat1_emoji
             , c2.cat2_name AS cat2_name
             , c3.cat3_name AS cat3_name
          FROM life_expense.category_goals g
          JOIN life_expense.categories_lvl1 c1 ON c1.cat1_id = g.cat1_id
          LEFT JOIN life_expense.categories_lvl2 c2 ON c2.cat2_id = g.cat2_id
          LEFT JOIN life_expense.categories_lvl3 c3 ON c3.cat3_id = g.cat3_id
      ORDER BY g.sort_order ASC, g.goal_id ASC
    """)).mappings().all()

    return [{
        "goal_id": r["goal_id"],
        "cat1_id": r["cat1_id"],
        "cat2_id": r["cat2_id"],
        "cat3_id": r["cat3_id"],
        "amount": float(r["amount"]),
        "memo": r["memo"],
        "sort_order": r["sort_order"],
        # "식비 > 점심" — 비어 있는 단은 건너뛴다.
        "path": " > ".join(
            x for x in (r["cat1_name"], r["cat2_name"], r["cat3_name"]) if x
        ),
        "emoji": r["cat1_emoji"],
    } for r in rows]


def _target(payload: dict) -> tuple[int, int | None, int | None]:
    """고른 분류를(중, 소, 세)로 갈라 낸다. 위 단을 건너뛴 것은 받지 않는다."""
    def num(key: str) -> int | None:
        raw = payload.get(key)
        if raw in (None, "", 0):
            return None
        return int(raw)

    cat1, cat2, cat3 = num("cat1_id"), num("cat2_id"), num("cat3_id")
    if cat1 is None:
        raise HTTPException(status_code=400, detail="중분류를 골라 주세요.")
    if cat3 is not None and cat2 is None:
        raise HTTPException(status_code=400, detail="세분류만 고를 수는 없습니다.")
    return cat1, cat2, cat3


def _amount(payload: dict) -> float:
    raw = payload.get("amount")
    if raw in (None, ""):
        raise HTTPException(status_code=400, detail="목표 금액을 적어 주세요.")
    try:
        value = float(raw)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="목표 금액이 숫자가 아닙니다.")
    if value <= 0:
        raise HTTPException(status_code=400, detail="목표 금액은 0보다 커야 합니다.")
    return value


@router.post("")
def add_goal(payload: dict, db: SessionDep = Depends()):
    """목표 하나를 새로 건다. 같은 분류에 이미 걸려 있으면 막는다."""
    cat1, cat2, cat3 = _target(payload)
    amount = _amount(payload)
    try:
        dup = db.execute(text("""
            SELECT 1
              FROM life_expense.category_goals
             WHERE cat1_id = :c1
               AND COALESCE(cat2_id, 0) = COALESCE(:c2, 0)
               AND COALESCE(cat3_id, 0) = COALESCE(:c3, 0)
        """), {"c1": cat1, "c2": cat2, "c3": cat3}).scalar()
        if dup:
            raise HTTPException(status_code=400, detail="이미 목표를 걸어 둔 분류입니다.")

        # 새 목표는 맨 뒤에 선다.
        nxt = db.execute(text("""
            SELECT COALESCE(MAX(sort_order), 0) + 1 FROM life_expense.category_goals
        """)).scalar()

        memo = (payload.get("memo") or "").strip() or None
        goal_id = db.execute(text("""
            INSERT INTO life_expense.category_goals
                        (cat1_id, cat2_id, cat3_id, amount, memo, sort_order)
                 VALUES (:c1, :c2, :c3, :amt, :memo, :sort)
              RETURNING goal_id
        """), {"c1": cat1, "c2": cat2, "c3": cat3, "amt": amount,
                "memo": memo, "sort": nxt}).scalar()
        db.commit()
        return {"goal_id": goal_id}
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/{goal_id}/amount")
def save_amount(goal_id: int, payload: dict, db: SessionDep = Depends()):
    """금액만 고친다 — 칸을 떠날 때 그 줄만 저장한다."""
    amount = _amount(payload)
    try:
        done = db.execute(text("""
            UPDATE life_expense.category_goals
               SET amount = :amt
             WHERE goal_id = :id
        """), {"amt": amount, "id": goal_id}).rowcount
        if not done:
            raise HTTPException(status_code=404, detail="없는 목표입니다.")
        db.commit()
        return {"ok": True}
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/{goal_id}/memo")
def save_memo(goal_id: int, payload: dict, db: SessionDep = Depends()):
    """한마디만 고친다 — 금액과 같은 방식으로, 칸을 떠날 때 그 줄만 저장한다."""
    memo = (payload.get("memo") or "").strip() or None
    try:
        done = db.execute(text("""
            UPDATE life_expense.category_goals
               SET memo = :memo
             WHERE goal_id = :id
        """), {"memo": memo, "id": goal_id}).rowcount
        if not done:
            raise HTTPException(status_code=404, detail="없는 목표입니다.")
        db.commit()
        return {"ok": True}
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/{goal_id}")
def remove_goal(goal_id: int, db: SessionDep = Depends()):
    try:
        done = db.execute(text("""
            DELETE FROM life_expense.category_goals WHERE goal_id = :id
        """), {"id": goal_id}).rowcount
        if not done:
            raise HTTPException(status_code=404, detail="없는 목표입니다.")
        db.commit()
        return {"ok": True}
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
