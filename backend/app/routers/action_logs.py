"""
행동 기록 — 적기만 하는 자리.

화면이 모아 보낸 줄을 받아 적는다. 읽는 길은 여기 없다. 보는 것은 관리자
페이지가 암호 뒤에서 맡는다(app/routers/admin.py). 적기만 열려 있으므로
주소를 아는 사람이 할 수 있는 일은 쓸데없는 줄을 보태는 것뿐이다.

갈래 셋만 받는다.
  view    화면별 드나든 수 — 라우터가 경로 바뀔 때 보낸다.
  feature 기능별 쓰임 — 영수증, 묶음, 엑셀을 쓸 때 보낸다.
  error   오류와 느린 요청 — axios 인터셉터가 보낸다.

적고 고친 건수(write)는 받지 않는다. entries에 날짜 칸이 있어 거기서 셈하면
되고, 그래야 지난 것까지 소급해서 보인다.

기록 때문에 화면이 느려지거나 멈추면 안 된다. 그래서 한 번에 여럿을 받고,
한 줄이 어긋나도 나머지는 적는다.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text

from app.deps import SessionDep

# 자리는 main.py에서 /api/action-logs로 붙인다.
router = APIRouter()

# 받는 갈래. 여기 없는 것은 조용히 버린다 — 테이블의 제약과 같은 목록이다.
KINDS = {"view", "feature", "error"}

# 한 번에 받는 줄의 상한. 화면은 스무 줄마다 보내므로 넉넉하다. 이보다 많이
# 오면 앞에서부터 이만큼만 적는다.
MAX_ROWS = 100


def _다듬기(줄: dict) -> dict | None:
    """한 줄을 테이블에 넣을 꼴로 만든다. 못 쓸 줄이면 빈 값을 돌려준다."""
    갈래 = str(줄.get("kind") or "")
    이름 = str(줄.get("name") or "").strip()
    if 갈래 not in KINDS or not 이름:
        return None

    def 수(열쇠: str):
        값 = 줄.get(열쇠)
        if 값 is None:
            return None
        try:
            return int(값)
        except (TypeError, ValueError):
            return None

    return {
        "kind": 갈래,
        "name": 이름[:100],
        "path": (str(줄.get("path"))[:200] if 줄.get("path") else None),
        "elapsed_ms": 수("elapsed_ms"),
        "status": 수("status"),
    }


@router.post("")
def add_action_logs(payload: dict, db: SessionDep = Depends()):
    """
    모아 보낸 줄을 적는다.

    못 쓸 줄은 조용히 버리고 적은 수만 돌려준다. 화면은 이 답을 보지 않는다 —
    기록이 실패해도 하던 일을 그대로 이어 가야 하기 때문이다.
    """
    온것 = payload.get("rows")
    if not isinstance(온것, list):
        return {"added": 0}

    쓸것 = [x for x in (_다듬기(r) for r in 온것[:MAX_ROWS] if isinstance(r, dict)) if x]
    if not 쓸것:
        return {"added": 0}

    db.execute(text("""
        INSERT INTO life_expense.action_logs (kind, name, path, elapsed_ms, status)
             VALUES (:kind, :name, :path, :elapsed_ms, :status)
    """), 쓸것)
    db.commit()
    return {"added": len(쓸것)}
