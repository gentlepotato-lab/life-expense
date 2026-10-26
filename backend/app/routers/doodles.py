"""
애니메이션 문구.

안내 줄 쪽지와 앞머리 화면이 번갈아 띄우는 것들이다. 읽기만 하는 자리다.
켜고 끄는 것은 관리자 사이트가 맡는다(app/routers/admin.py).

화면은 못 받아 오면 코드에 있는 열 가지를 쓴다. 서버가 죽어도 쪽지는
돌아야 하기 때문이다(frontend/src/pages/components/PenMark.tsx).
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text

from app.deps import SessionDep

# 자리는 main.py에서 /api/doodles로 붙인다.
router = APIRouter()


@router.get("")
def list_doodles(db: SessionDep = Depends()):
    """
    켜진 문구를 차례대로 돌려준다.

    갈래를 나누지 않고 한 줄로 늘어놓아 보낸다. 화면이 켜진 것을 전부
    늘어놓고 1/전체로 뽑기 때문이다. 갈래로 먼저 나누면 그림 하나하나가
    글자보다 여덟 배 드물어진다.
    """
    rows = db.execute(text("""
        SELECT d.item_key
             , d.kind
             , d.label
          FROM life_expense.doodles d
         WHERE d.is_active = 1
      ORDER BY d.sort_order ASC, d.item_key ASC
    """)).mappings().all()

    return [{
        "item_key": r["item_key"],
        "kind": r["kind"],
        "label": r["label"],
    } for r in rows]
