"""
잔소리.

읽기만 한다. 부를 때 세고 돌려줄 뿐 어디에도 적지 않는다. 까닭은
app/nudgecalc.py 머리말에 적었다.

오늘 날짜는 부르는 쪽이 보낸다. 서버 시각대를 믿으면 폰이 자정을 넘길 때
하루 어긋난다.
"""

from fastapi import APIRouter, Depends, Query

from ..deps import SessionDep
from ..nudgecalc import 거르기, 모으기, 세기

router = APIRouter()


def _선택한것(fx: str | None) -> dict:
    """고정/변동 꼬리표를 되읽는다. 화면의 fxPickFrom()과 같은 차례다.

    고정 지출, 변동 지출, 고정 수입, 변동 수입 차례의 네 자다. 네 자가
    아니면 넷 다 켠 것으로 본다.
    """
    if not fx or len(fx) != 4:
        return {"fixOut": True, "varOut": True, "fixIn": True, "varIn": True}
    return {
        "fixOut": fx[0] == "1",
        "varOut": fx[1] == "1",
        "fixIn": fx[2] == "1",
        "varIn": fx[3] == "1",
    }


@router.get("")
def list_nudges(
    today: str = Query(..., min_length=10, max_length=10, description="YYYY-MM-DD. 부르는 쪽의 날짜"),
    fx: str | None = Query(None, min_length=4, max_length=4, description="고정/변동 꼬리표"),
    db: SessionDep = Depends(),
):
    모은것 = 모으기(db, today)
    추린것 = 거르기(모은것, _선택한것(fx))
    return {"today": today, "nudges": 세기(추린것, 모은것)}
