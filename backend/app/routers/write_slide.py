"""쓰기 슬라이드(beta)가 쓰는 길.

시범으로 붙여 보는 기능이라 기존 라우터에 손을 대지 않고 이 파일 하나에
모아 둔다. 접으려면 main.py의 include_router 한 줄만 걷으면 된다.

읽기만 한다. 적는 일은 기존 쓰기와 같은 길(POST /api/entries)을 쓴다 —
적는 길이 둘이 되면 언젠가 한쪽만 고쳐진다.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text

from app.deps import SessionDep

router = APIRouter()

#: 빠른 입력에 내놓을 금액 개수. 화면이 다섯 칸으로 짜여 있다.
QUICK_N = 5


@router.get("/quick-amounts")
def quick_amounts(
    cat2_id: int | None = Query(None),
    db: SessionDep = Depends(),
):
    """그 소분류에서 자주 쓴 금액 다섯.

    1,000원으로 나눠떨어지는 것만 본다. 8,340원 같은 값은 빠른 입력으로
    눌러 봐야 어차피 고쳐야 하므로 자리만 차지한다.

    소분류를 안 넘기거나 그 소분류에 쌓인 것이 모자라면 전체에서 뽑아
    채운다 — 빈 칸이 생기면 다섯 칸짜리 줄이 들쭉날쭉해진다.
    """
    def 뽑기(where: str, params: dict) -> list[int]:
        rows = db.execute(text(f"""
            SELECT amount::bigint AS a, count(*) AS n
              FROM life_expense.entries
             WHERE inout = -1
               AND amount > 0
               AND amount % 1000 = 0
               {where}
             GROUP BY 1
             ORDER BY n DESC, a
             LIMIT :lim
        """), {**params, "lim": QUICK_N}).fetchall()
        return [int(r.a) for r in rows]

    고른것: list[int] = []
    if cat2_id is not None:
        고른것 = 뽑기("AND cat2_id = :cid", {"cid": cat2_id})

    if len(고른것) < QUICK_N:
        for a in 뽑기("", {}):
            if a not in 고른것:
                고른것.append(a)
            if len(고른것) >= QUICK_N:
                break

    return {"amounts": 고른것[:QUICK_N]}
