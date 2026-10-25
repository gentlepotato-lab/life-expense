"""
행동 기록. 적기만 하는 자리.

화면이 모아 보낸 줄을 받아 적는다. 읽는 길은 여기 없다. 보는 것은 관리자
페이지가 암호 뒤에서 맡는다(app/routers/admin.py). 적기만 열려 있으므로
주소를 아는 사람이 할 수 있는 일은 쓸데없는 줄을 보태는 것뿐이다.

갈래 넷만 받는다.
  view    화면별 드나든 수. 라우터가 경로 바뀔 때 보낸다.
  feature 기능별 쓰임. 영수증, 묶음, 엑셀을 쓸 때 보낸다.
  error   오류와 느린 요청. axios 인터셉터가 보낸다.
  api     바깥에 묻는 요청. 브라우저가 바로 부르는 것만 보낸다(카카오 지도).
          서버를 거치는 요청은 서버가 저가 알므로 여기 오지 않는다.
          이 갈래만 방식(GET)과 주소를 함께 담는다. 주소에서는 열쇠가 든 값만
          걷는다(주소다듬기).

적고 고친 건수(write)는 받지 않는다. entries에 날짜 컬럼이 있어 거기서 세면
되고, 그래야 지난 것까지 소급해서 보인다.

기록 때문에 화면이 느려지거나 멈추면 안 된다. 그래서 한 번에 여럿을 받고,
한 줄이 어긋나도 나머지는 적는다.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text

from app.deps import SessionDep

# 자리는 main.py에서 /api/action-logs로 붙인다.
router = APIRouter()

# 받는 갈래. 여기 없는 것은 조용히 버린다. 테이블의 제약과 같은 목록이다.
KINDS = {"view", "feature", "error", "api"}

# 한 번에 받는 줄의 상한. 화면은 스무 줄마다 보내므로 넉넉하다. 이보다 많이
# 오면 앞에서부터 이만큼만 적는다.
MAX_ROWS = 100


# 주소에서 걷어 낼 값의 이름. 하나라도 들어 있으면 그 값을 통째로 뺀다.
# 화면도 같은 목록으로 거른다(frontend/src/utils/track.ts의 숨길이름).
숨길이름 = ("key", "secret", "token", "password", "pw", "auth", "sign")


def 주소다듬기(url: str | None) -> str | None:
    """
    기록에 적을 주소.

    **열쇠가 든 값만 걷고 나머지 물음표 뒤는 그대로 둔다.** 찾은 말(query)이
    「무엇을 하려고 불렀나」보다 자세해서 남긴다. 서버가 부르는 자리는
    serviceKey 가 붙고(app/routers/holidays.py), 카카오는 열쇠를 머리글로
    보내 주소에 없다.

    관리자 사이트는 쌓인 줄을 그대로 띄우므로, 열쇠가 섞여 들어가면 그 쪽을
    여는 사람이 값을 그대로 읽게 된다. 보내는 쪽에서도 한 번 거르지만
    (utils/track.ts), 적는 자리가 둘이라 한쪽만 믿지 않는다.
    """
    if not url:
        return None
    앞, 물음표, 뒤 = url.partition("?")
    if not 물음표:
        return 앞[:300]
    남길것 = [
        짝
        for 짝 in 뒤.split("&")
        if 짝.split("=")[0]
        and not any(h in 짝.split("=")[0].lower() for h in 숨길이름)
    ]
    return (f"{앞}?{'&'.join(남길것)}" if 남길것 else 앞)[:300]


def 바깥적기(
    db,
    name: str,
    한일: str,
    elapsed_ms: int | None,
    status: int | None,
    method: str | None = None,
    url: str | None = None,
) -> None:
    """
    서버가 바깥에 물어본 것을 적는다.

    브라우저가 바로 부르는 바깥은 화면이 적어 보내지만(utils/track.ts의
    바깥적기), 서버가 부르는 바깥은 여기서 적는다. 둘이 같은 갈래(api)로
    같은 테이블에 쌓여야 관리자 사이트가 한자리에서 센다.

    방식과 주소는 「어디로 보낸 요청인가」다. 이름과 한 일만으로는 느리거나
    물린 줄을 찾아도 어디를 들여다봐야 할지 알 수 없었다.

    적다가 터져도 부르는 쪽 일은 이미 끝난 뒤다. 그래서 탈을 삼킨다. 기록
    때문에 공휴일을 못 받는 일이 있어서는 안 된다.
    """
    try:
        db.execute(text("""
            INSERT INTO life_expense.action_logs
                        (kind, name, path, elapsed_ms, status, method, url)
                 VALUES ('api', :n, :p, :e, :s, :m, :u)
        """), {
            "n": name[:100],
            "p": 한일[:200],
            "e": elapsed_ms,
            "s": status,
            "m": (method or "")[:10] or None,
            "u": 주소다듬기(url),
        })
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass


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
        # 바깥 요청에만 담겨 온다. 나머지 갈래는 빈 값이다.
        # 주소는 받는 쪽에서도 열쇠를 걷는다. 보내는 쪽(utils/track.ts)이
        # 이미 걷지만, 적는 자리가 둘이라 한쪽만 믿지 않는다.
        "method": (str(줄.get("method"))[:10] if 줄.get("method") else None),
        "url": 주소다듬기(str(줄.get("url")) if 줄.get("url") else None),
    }


@router.post("")
def add_action_logs(payload: dict, db: SessionDep = Depends()):
    """
    모아 보낸 줄을 적는다.

    못 쓸 줄은 조용히 버리고 적은 수만 돌려준다. 화면은 이 답을 보지 않는다.
    기록이 실패해도 하던 일을 그대로 이어 가야 하기 때문이다.
    """
    온것 = payload.get("rows")
    if not isinstance(온것, list):
        return {"added": 0}

    쓸것 = [x for x in (_다듬기(r) for r in 온것[:MAX_ROWS] if isinstance(r, dict)) if x]
    if not 쓸것:
        return {"added": 0}

    db.execute(text("""
        INSERT INTO life_expense.action_logs
                    (kind, name, path, elapsed_ms, status, method, url)
             VALUES (:kind, :name, :path, :elapsed_ms, :status, :method, :url)
    """), 쓸것)
    db.commit()
    return {"added": len(쓸것)}
