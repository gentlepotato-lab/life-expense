"""
공지사항.

홈 맨 위에 한 줄 띠로 뜬다. 읽기만 하는 자리다 — 적고 고치는 것은
관리자 페이지가 맡는다(app/routers/admin.py).

공지가 하나도 없으면 빈 목록을 돌려준다. 화면은 그때 띠를 아예 그리지
않으므로 홈이 지금과 한 픽셀도 다르지 않다.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text

from app.deps import SessionDep

# 자리는 main.py에서 /api/notices로 붙인다.
router = APIRouter()


@router.get("")
def list_notices(
    today: str = Query(..., min_length=10, max_length=10, description="YYYY-MM-DD — 부르는 쪽의 날짜"),
    db: SessionDep = Depends(),
):
    """
    오늘 걸린 공지를 차례대로 돌려준다.

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
           AND (n.start_on IS NULL OR n.start_on <= CAST(:today AS date))
           AND (n.end_on   IS NULL OR n.end_on   >= CAST(:today AS date))
      ORDER BY n.sort_order ASC, n.notice_id DESC
    """), {"today": today}).mappings().all()

    return [{
        "notice_id": r["notice_id"],
        "title": r["title"],
        "body": r["body"],
        "start_on": str(r["start_on"]) if r["start_on"] else None,
        "end_on": str(r["end_on"]) if r["end_on"] else None,
    } for r in rows]
