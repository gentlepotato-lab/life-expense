from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from app.deps import SessionDep

# 자리는 main.py에서 /api/charts로 붙인다
router = APIRouter()


@router.get("/cards")
def list_cards(db: SessionDep = Depends()):
    """
    그림 카드의 차례와 켜짐.

    그림이 무엇인지는 화면이 안다. 여기는 열쇠와 차례만 돌려준다 — 표에 없는
    열쇠는 화면이 적어 둔 차례 그대로 맨 뒤에 세운다.
    """
    rows = db.execute(text("""
        SELECT card_key, sort_order, is_active, span
          FROM life_expense.chart_cards
      ORDER BY sort_order ASC, card_key ASC
    """)).mappings().all()
    return [dict(r) for r in rows]


@router.post("/cards")
def save_cards(payload: list[dict], db: SessionDep = Depends()):
    """
    차례와 켜짐을 통째로 갈아 끼운다.

    카드가 예닐곱뿐이고 한 건씩 견줘 고칠 이유가 없다. 열쇠를 가리키는 곳도
    없어 지우고 다시 넣어도 잃을 것이 없다.
    """
    try:
        db.execute(text("DELETE FROM life_expense.chart_cards"))
        for i, card in enumerate(payload):
            key = (card.get("card_key") or "").strip()
            if not key:
                raise HTTPException(status_code=400, detail="카드 열쇠가 비어 있습니다.")
            db.execute(text("""
                INSERT INTO life_expense.chart_cards (card_key, sort_order, is_active, span)
                     VALUES (:key, :sort, :on, :span)
            """), {"key": key, "sort": i + 1,
                    "on": 1 if card.get("is_active", 1) else 0,
                    "span": 2 if int(card.get("span", 1)) >= 2 else 1})
        db.commit()
        return {"status": "ok"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))
