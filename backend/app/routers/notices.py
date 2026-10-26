"""
공지사항.

홈 맨 위에 한 줄 띠로 뜬다. 적고 고치는 것은 관리자 사이트가
맡는다(app/routers/admin.py).

읽은 표시도 여기서 맡는다. 어디까지 읽었는지는 쓰는 사람마다 다르므로
prefs_app에 담는다. 브라우저에 담으면 기기마다 달라져서 폰에서 읽은 것이
PC에서 또 뜬다.

/api/profile/prefs는 제 열쇠 목록(PREF_KEYS)만 받고 내려보내므로 이 열쇠는
그쪽에 끼어들지 않는다. 서로 모르는 채로 같은 테이블을 쓴다.

공지가 하나도 없으면 빈 목록을 돌려준다. 화면은 그때 띠를 아예 그리지
않으므로 홈이 지금과 한 픽셀도 다르지 않다.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text

from app.deps import SessionDep

# 자리는 main.py에서 /api/notices로 붙인다.
router = APIRouter()

# 어디까지 읽었는지를 담는 열쇠. 번호는 늘어나기만 하므로 이 하나로
# "아직 안 읽은 것"을 가릴 수 있다.
READ_KEY = "notice_read"

# 다시 안 읽음으로 돌린 공지 번호들. 읽은 자리는 "여기까지"라는 금 하나뿐이라
# 한 건만 되돌릴 수가 없다. 그 금은 그대로 두고 예외만 여기 든다.
#
# 번호를 쉼표로 이어 담는다. JSON으로 담지 않는 까닭은 prefs_app이 글 한 줄을
# 드는 자리이고, 여기 드는 것이 수 몇 개뿐이기 때문이다.
UNREAD_KEY = "notice_unread"


def _글꺼내기(db, 열쇠: str) -> str:
    row = db.execute(text("""
        SELECT pref_value
          FROM life_expense.prefs_app
         WHERE pref_key = :k
    """), {"k": 열쇠}).scalar()
    return row or ""


def _담기(db, 열쇠: str, 값: str) -> None:
    db.execute(text("""
        INSERT INTO life_expense.prefs_app (pref_key, pref_value)
             VALUES (:k, :v)
        ON CONFLICT (pref_key) DO UPDATE
                SET pref_value = EXCLUDED.pref_value
                  , updated_at = now()
    """), {"k": 열쇠, "v": 값})


def _읽은번호(db) -> int:
    try:
        return int(_글꺼내기(db, READ_KEY))
    except (TypeError, ValueError):
        return 0


def _안읽음들(db) -> set[int]:
    """다시 안 읽음으로 돌린 번호들."""
    난것 = set()
    for 조각 in _글꺼내기(db, UNREAD_KEY).split(","):
        조각 = 조각.strip()
        if not 조각:
            continue
        try:
            난것.add(int(조각))
        except ValueError:
            continue
    return 난것


@router.get("")
def list_notices(
    today: str = Query(..., min_length=10, max_length=10, description="YYYY-MM-DD. 부르는 쪽의 날짜"),
    db: SessionDep = Depends(),
):
    """
    오늘 걸렸고 아직 안 읽은 공지를 차례대로 돌려준다.

    오늘 날짜는 부르는 쪽이 보낸다. 잔소리와 같은 까닭이다. 서버 시각대를
    믿으면 폰이 자정을 넘길 때 하루 어긋난다.

    뜨는 기간은 비울 수 있다. 시작이 비면 처음부터, 끝이 비면 끝없이 뜬다.
    """
    rows = db.execute(text("""
        SELECT n.notice_id
             , n.title
             , n.body
             , n.start_on
             , n.end_on
          FROM life_expense.notices n
         WHERE n.is_active = 1
           AND (n.notice_id > :read OR n.notice_id = ANY(:unread))
           AND (n.start_on IS NULL OR n.start_on <= CAST(:today AS date))
           AND (n.end_on   IS NULL OR n.end_on   >= CAST(:today AS date))
      ORDER BY n.sort_order ASC, n.notice_id DESC
    """), {
        "today": today,
        "read": _읽은번호(db),
        # 다시 안 읽음으로 돌린 것은 금 아래여도 띄운다.
        "unread": list(_안읽음들(db)) or [0],
    }).mappings().all()

    return [{
        "notice_id": r["notice_id"],
        "title": r["title"],
        "body": r["body"],
        "start_on": str(r["start_on"]) if r["start_on"] else None,
        "end_on": str(r["end_on"]) if r["end_on"] else None,
    } for r in rows]


@router.get("/all")
def list_all_notices(
    today: str = Query(..., min_length=10, max_length=10, description="YYYY-MM-DD. 부르는 쪽의 날짜"),
    db: SessionDep = Depends(),
):
    """
    지난 것까지 모두 돌려준다. 공지사항 화면이 쓴다.

    읽었는지는 가리지 않는다. 읽고 나면 띠가 다시 뜨지 않으므로, 다시 읽을
    자리가 따로 있어야 한다. 그 자리가 이 길이다.

    끝 날짜는 보지 않는다. 뜨는 기간이 지난 공지도 여기서는 읽을 수 있어야
    한다. 시작 날짜는 본다. 아직 뜰 때가 아닌 공지를 미리 보일 까닭은
    없다. 꺼 둔 공지는 내보내지 않는다.

    차례는 새것부터다. 띠는 sort_order를 앞세우지만 여기는 읽은 것을
    되짚는 자리라, 최근 것이 위에 서는 쪽이 찾기 쉽다.

    읽은 자리도 함께 적어 보낸다. 화면이 안 읽은 것에 표를 단다.
    """
    읽은것 = _읽은번호(db)
    안읽음 = _안읽음들(db)
    rows = db.execute(text("""
        SELECT n.notice_id
             , n.title
             , n.body
             , n.start_on
             , n.end_on
             , n.created_at::date AS created_on
          FROM life_expense.notices n
         WHERE n.is_active = 1
           AND (n.start_on IS NULL OR n.start_on <= CAST(:today AS date))
      ORDER BY n.notice_id DESC
    """), {"today": today}).mappings().all()

    return [{
        "notice_id": r["notice_id"],
        "title": r["title"],
        "body": r["body"],
        "start_on": str(r["start_on"]) if r["start_on"] else None,
        "end_on": str(r["end_on"]) if r["end_on"] else None,
        "created_on": str(r["created_on"]) if r["created_on"] else None,
        "unread": r["notice_id"] > 읽은것 or r["notice_id"] in 안읽음,
    } for r in rows]


@router.put("/read")
def mark_read(payload: dict, db: SessionDep = Depends()):
    """
    여기까지 읽었다고 적는다.

    뒤로 물리지 않는다. 이미 적힌 번호보다 작은 것이 와도 그대로 둔다.
    기기 둘에서 번갈아 읽을 때 읽은 자리가 되감기면 안 된다.
    """
    try:
        번호 = int(payload.get("notice_id"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="읽은 공지 번호가 없습니다.")

    db.execute(text("""
        INSERT INTO life_expense.prefs_app (pref_key, pref_value)
             VALUES (:k, :v)
        ON CONFLICT (pref_key) DO UPDATE
                SET pref_value = GREATEST(
                        life_expense.prefs_app.pref_value::integer, EXCLUDED.pref_value::integer
                    )::text
                  , updated_at = now()
    """), {"k": READ_KEY, "v": str(번호)})

    # 그 번호까지의 예외는 걷는다. 읽었다고 적은 뒤에도 예외가 남아 있으면
    # 띠가 그 공지를 다시 띄운다.
    남은것 = {i for i in _안읽음들(db) if i > 번호}
    _담기(db, UNREAD_KEY, ",".join(str(i) for i in sorted(남은것)))
    db.commit()
    return {"notice_read": _읽은번호(db)}


@router.put("/unread")
def mark_unread(payload: dict, db: SessionDep = Depends()):
    """
    한 건만 다시 안 읽음으로 돌린다.

    읽은 자리는 "여기까지"라는 금 하나뿐이라, 그 금을 내리면 그보다 새로운
    공지까지 함께 안 읽음이 된다. 그래서 금은 그대로 두고 이 번호만 예외로
    적는다. 돌린 공지는 홈의 띠에 다시 뜬다.
    """
    try:
        번호 = int(payload.get("notice_id"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="공지 번호가 없습니다.")

    _담기(db, UNREAD_KEY, ",".join(str(i) for i in sorted(_안읽음들(db) | {번호})))
    db.commit()
    return {"ok": True}
