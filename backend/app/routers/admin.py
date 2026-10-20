"""
관리자 페이지가 쓰는 자리.

site_prefs를 읽고 적는다. 읽는 길 하나만 암호 없이 연다 — 아래
GET /prefs가 그것이고, 공개 열쇠만 돌려준다. 꺼 놓은 메뉴 목록을 사용자
화면이 알아야 메뉴를 거를 수 있기 때문이다.

나머지는 암호를 받은 뒤에야 열린다. 암호와 토큰은 4단계에서 붙인다.
"""

import json

from fastapi import APIRouter, Depends
from sqlalchemy import text

from app.deps import SessionDep

# 자리는 main.py에서 /api/admin으로 붙인다.
router = APIRouter()

# 담는 설정. app_prefs의 PREF_KEYS와 같은 방식이다 — 여기 없는 열쇠는
# 받지 않는다. 화면이 잘못 보내도 테이블이 지저분해지지 않게 한다.
SITE_KEYS = {
    # 꺼 놓은 메뉴의 열쇠를 JSON 배열로 담는다. 켜진 것은 적지 않는다 —
    # 새 기능을 더했을 때 목록에 없다고 꺼져 버리면 안 되기 때문이다.
    # 비면 전부 켜짐이고, 그것이 지금 화면과 같은 상태다.
    "menu_off": "[]",
    # 관리자 암호의 해시. 4단계에서 쓴다. 절대 내려보내지 않는다.
    "admin_pw": "",
}

# 암호 없이 내려보내도 되는 열쇠. 사용자 화면이 읽어야 하는 것만 든다.
PUBLIC_KEYS = {"menu_off"}


def _값들(db, 열쇠들: set) -> dict:
    """적힌 값을 읽고, 없는 것은 기본값으로 채운다."""
    rows = db.execute(text("""
        SELECT pref_key, pref_value
          FROM life_expense.site_prefs
         WHERE pref_key = ANY(:keys)
    """), {"keys": list(열쇠들)}).mappings().all()
    적힌것 = {r["pref_key"]: r["pref_value"] for r in rows}
    return {k: 적힌것.get(k, SITE_KEYS[k]) for k in 열쇠들}


@router.get("/prefs")
def get_site_prefs(db: SessionDep = Depends()):
    """
    공개 열쇠만 돌려준다. 암호를 받지 않는다.

    사용자 화면이 메뉴를 거르려면 꺼 놓은 목록을 알아야 한다. 암호 뒤에
    두면 앱이 열릴 때마다 암호를 물어야 한다.

    menu_off는 글자로 담기므로 여기서 배열로 풀어 보낸다. 깨진 글이
    담겨 있어도 빈 배열로 돌려준다 — 메뉴가 통째로 사라지느니 전부 켜진
    채로 두는 편이 낫다.
    """
    값 = _값들(db, PUBLIC_KEYS)
    try:
        꺼진것 = json.loads(값["menu_off"])
        if not isinstance(꺼진것, list):
            꺼진것 = []
    except (ValueError, TypeError):
        꺼진것 = []

    return {"menu_off": [str(x) for x in 꺼진것]}
