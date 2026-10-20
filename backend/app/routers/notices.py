"""
공지사항.

홈 맨 위에 한 줄 띠로 뜬다. 적고 고치는 것은 관리자 페이지가
맡는다(app/routers/admin.py).

읽은 표시도 여기서 맡는다. 어디까지 읽었는지는 쓰는 사람마다 다르므로
app_prefs에 담는다. 브라우저에 담으면 기기마다 달라져서 폰에서 읽은 것이
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


def _읽은번호(db) -> int:
    row = db.execute(text("""
        SELECT pref_value
          FROM life_expense.app_prefs
         WHERE pref_key = :k
    """), {"k": READ_KEY}).scalar()
    try:
        return int(row)
    except (TypeError, ValueError):
        return 0


@router.get("")
def list_notices(
    today: str = Query(..., min_length=10, max_length=10, description="YYYY-MM-DD — 부르는 쪽의 날짜"),
    db: SessionDep = Depends(),
):
    """
    오늘 걸렸고 아직 안 읽은 공지를 차례대로 돌려준다.

    오늘 날짜는 부르는 쪽이 보낸다. 잔소리와 같은 까닭이다 — 서버 시각대를
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
           AND n.notice_id > :read
           AND (n.start_on IS NULL OR n.start_on <= CAST(:today AS date))
           AND (n.end_on   IS NULL OR n.end_on   >= CAST(:today AS date))
      ORDER BY n.sort_order ASC, n.notice_id DESC
    """), {"today": today, "read": _읽은번호(db)}).mappings().all()

    return [{
        "notice_id": r["notice_id"],
        "title": r["title"],
        "body": r["body"],
        "start_on": str(r["start_on"]) if r["start_on"] else None,
        "end_on": str(r["end_on"]) if r["end_on"] else None,
    } for r in rows]


@router.put("/read")
def mark_read(payload: dict, db: SessionDep = Depends()):
    """
    여기까지 읽었다고 적는다.

    뒤로 물리지 않는다 — 이미 적힌 번호보다 작은 것이 와도 그대로 둔다.
    기기 둘에서 번갈아 읽을 때 읽은 자리가 되감기면 안 된다.
    """
    try:
        번호 = int(payload.get("notice_id"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="읽은 공지 번호가 없습니다.")

    db.execute(text("""
        INSERT INTO life_expense.app_prefs (pref_key, pref_value)
             VALUES (:k, :v)
        ON CONFLICT (pref_key) DO UPDATE
                SET pref_value = GREATEST(
                        life_expense.app_prefs.pref_value::integer, EXCLUDED.pref_value::integer
                    )::text
                  , updated_at = now()
    """), {"k": READ_KEY, "v": str(번호)})
    db.commit()
    return {"notice_read": _읽은번호(db)}
