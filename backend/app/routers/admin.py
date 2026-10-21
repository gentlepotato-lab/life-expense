"""
관리자 페이지가 쓰는 자리.

site_prefs를 읽고 적고, 대시보드가 볼 셈을 돌려준다. 읽는 길 하나만 암호
없이 연다 — 아래 GET /prefs가 그것이고, 공개 열쇠만 돌려준다. 꺼 놓은 메뉴
목록을 사용자 화면이 알아야 메뉴를 거를 수 있기 때문이다.

나머지는 토큰을 받은 뒤에야 열린다. 토큰은 POST /login으로 받는다.

분명히 적는다. **이것은 자물쇠지 인증이 아니다.** 주소를 숨기고 암호 한 겹
두는 정도이고, 여럿이 쓰게 될 때 제대로 된 로그인으로 바꿔야 한다.
"""

import hashlib
import hmac
import json
import os
import secrets
import uuid
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
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
    # 관리자 암호의 해시. 절대 내려보내지 않는다.
    "admin_pw": "",
}

# 암호 없이 내려보내도 되는 열쇠. 사용자 화면이 읽어야 하는 것만 든다.
PUBLIC_KEYS = {"menu_off"}

# 해시를 짓는 값. 파이썬 기본만 쓴다 — 새 의존성을 들이지 않는다.
PW_ROUNDS = 200_000
PW_ALGO = "sha256"

# 토큰이 사는 시간. 한나절을 넘기면 켜 놓은 창에서 그대로 열린다.
TOKEN_HOURS = 8

# 처음 들어갈 때 쓰는 암호. 환경 변수에 적지 않았으면 들어갈 수 없다.
# 들어가서 바꾸는 것이 먼저다.
FIRST_PW_ENV = "EXPENSE_ADMIN_PW"


def _해시(암호: str, 소금: str) -> str:
    """암호를 되돌릴 수 없는 꼴로 짓는다."""
    쇠 = hashlib.pbkdf2_hmac(PW_ALGO, 암호.encode("utf-8"), 소금.encode("utf-8"), PW_ROUNDS)
    return f"{PW_ALGO}${PW_ROUNDS}${소금}${쇠.hex()}"


def _맞나(암호: str, 적힌것: str) -> bool:
    """적힌 해시와 맞는지 본다. 글자를 한 자씩 견주지 않는다."""
    try:
        알고, 돌림, 소금, _ = 적힌것.split("$")
        돌림 = int(돌림)
    except (ValueError, AttributeError):
        return False
    쇠 = hashlib.pbkdf2_hmac(알고, 암호.encode("utf-8"), 소금.encode("utf-8"), 돌림)
    return hmac.compare_digest(f"{알고}${돌림}${소금}${쇠.hex()}", 적힌것)


def _값들(db, 열쇠들: set) -> dict:
    """적힌 값을 읽고, 없는 것은 기본값으로 채운다."""
    rows = db.execute(text("""
        SELECT pref_key, pref_value
          FROM life_expense.site_prefs
         WHERE pref_key = ANY(:keys)
    """), {"keys": list(열쇠들)}).mappings().all()
    적힌것 = {r["pref_key"]: r["pref_value"] for r in rows}
    return {k: 적힌것.get(k, SITE_KEYS[k]) for k in 열쇠들}


def _적기(db, 열쇠: str, 값: str) -> None:
    db.execute(text("""
        INSERT INTO life_expense.site_prefs (pref_key, pref_value)
             VALUES (:k, :v)
        ON CONFLICT (pref_key) DO UPDATE
                SET pref_value = EXCLUDED.pref_value
                  , updated_at = now()
    """), {"k": 열쇠, "v": 값})


def 문지기(db, token: str | None) -> None:
    """토큰이 살아 있는지 본다. 아니면 401로 막는다."""
    if not token:
        raise HTTPException(status_code=401, detail="관리자 비밀번호가 필요합니다.")
    산것 = db.execute(text("""
        SELECT 1
          FROM life_expense.admin_sessions
         WHERE token = :t AND expires_at > now()
    """), {"t": token}).scalar()
    if not 산것:
        raise HTTPException(status_code=401, detail="관리자 비밀번호가 필요합니다.")


def 토큰(x_admin_token: str | None = Header(default=None), db: SessionDep = Depends()):
    """토큰을 받아 들이는 딸림. 막히면 이 자리에서 401이 난다."""
    문지기(db, x_admin_token)
    return x_admin_token


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


@router.get("/state")
def admin_state(db: SessionDep = Depends()):
    """
    암호를 걸어 놓았는지만 알린다. 암호 자체는 내려보내지 않는다.

    화면은 이 답으로 "암호를 처음 정하는 자리"와 "암호를 묻는 자리" 가운데
    어느 쪽을 그릴지 고른다.
    """
    적힌것 = _값들(db, {"admin_pw"})["admin_pw"]
    첫암호 = os.environ.get(FIRST_PW_ENV, "")
    return {"걸림": bool(적힌것), "첫암호있나": bool(첫암호)}


@router.post("/login")
def admin_login(payload: dict, db: SessionDep = Depends()):
    """
    암호를 받고 토큰을 돌려준다.

    아직 암호를 정하지 않았으면 환경 변수의 첫 암호로 들어간다. 그것도
    없으면 아무도 못 들어간다 — 암호가 비어 있는 채로 열리면 주소를 아는
    사람이 그대로 들어온다.
    """
    암호 = str(payload.get("password") or "")
    if not 암호:
        raise HTTPException(status_code=400, detail="비밀번호를 넣어 주세요.")

    적힌것 = _값들(db, {"admin_pw"})["admin_pw"]
    if 적힌것:
        맞음 = _맞나(암호, 적힌것)
    else:
        첫암호 = os.environ.get(FIRST_PW_ENV, "")
        맞음 = bool(첫암호) and hmac.compare_digest(암호, 첫암호)

    if not 맞음:
        raise HTTPException(status_code=401, detail="비밀번호가 맞지 않습니다.")

    새토큰 = secrets.token_urlsafe(32)[:64]
    db.execute(text("""
        INSERT INTO life_expense.admin_sessions (token, expires_at)
             VALUES (:t, :e)
    """), {"t": 새토큰, "e": datetime.now() + timedelta(hours=TOKEN_HOURS)})
    # 지난 토큰은 들어올 때마다 걷는다. 따로 청소를 돌릴 만큼 쌓이지 않는다.
    db.execute(text("DELETE FROM life_expense.admin_sessions WHERE expires_at <= now()"))
    db.commit()
    return {"token": 새토큰, "hours": TOKEN_HOURS}


@router.post("/logout")
def admin_logout(x_admin_token: str | None = Header(default=None), db: SessionDep = Depends()):
    """토큰을 걷는다. 없는 토큰이 와도 탈이 아니다."""
    if x_admin_token:
        db.execute(text("DELETE FROM life_expense.admin_sessions WHERE token = :t"), {"t": x_admin_token})
        db.commit()
    return {"ok": True}


@router.put("/password")
def set_admin_password(payload: dict, _: str = Depends(토큰), db: SessionDep = Depends()):
    """
    암호를 새로 정한다. 들어와 있는 사람만 바꿀 수 있다.

    짧은 암호는 받지 않는다. 자물쇠 한 겹뿐이라 그 한 겹이라도 성해야 한다.
    """
    새것 = str(payload.get("password") or "")
    if len(새것) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 여덟 자 이상이어야 합니다.")

    _적기(db, "admin_pw", _해시(새것, secrets.token_hex(16)))
    # 암호를 바꾸면 들어와 있던 자리를 모두 걷는다. 남의 기기에 열린 채로
    # 두지 않으려는 가름이다.
    db.execute(text("DELETE FROM life_expense.admin_sessions"))
    db.commit()
    return {"ok": True}


@router.get("/stats")
def admin_stats(
    frm: str | None = None,
    to: str | None = None,
    days: int | None = None,
    _: str = Depends(토큰),
    db: SessionDep = Depends(),
):
    """
    대시보드가 볼 것을 한 번에 돌려준다.

    화면이 따로따로 물으면 기간을 바꿀 때마다 요청이 그만큼 나간다. 셈이
    싸므로 한 번에 모아 보낸다.

    기간은 날짜 두 개로 받는다(frm, to). 둘 다 그날을 품는다. 날짜로 받아야
    화면이 고른 기간을 그대로 되비칠 수 있다. 예전처럼 days만 받으면 화면은
    "최근 30일"이라고만 적을 수 있고, 그 서른 날이 언제부터 언제까지인지는
    서버만 안다.

    days도 그대로 받는다. 아직 날짜를 안 보내는 쪽이 있을 때를 위해서다. 둘 다
    없으면 이번 달이다.

    쓰고 수정한 건수(write)만 action_logs가 아니라 entries에서 센다. 날짜 칸이
    있어 거기서 셈하면 지난 것까지 소급해서 보인다.
    """
    오늘 = date.today()
    if frm and to:
        try:
            첫날 = date.fromisoformat(frm)
            끝날 = date.fromisoformat(to)
        except ValueError:
            raise HTTPException(status_code=400, detail="기간을 날짜로 보내 주세요.")
        if 끝날 < 첫날:
            raise HTTPException(status_code=400, detail="끝 날짜가 시작 날짜보다 앞섭니다.")
    elif days:
        날수 = max(1, min(int(days), 365))
        끝날 = 오늘
        첫날 = 오늘 - timedelta(days=날수 - 1)
    else:
        첫날 = 오늘.replace(day=1)
        끝날 = 오늘

    # 하루를 더해 끝날까지 품는다. created_at은 시각까지 있어 그냥 <= 로
    # 견주면 그날 낮에 쌓인 것이 빠진다.
    날 = (끝날 - 첫날).days + 1
    틈 = {"frm": 첫날.isoformat(), "to": (끝날 + timedelta(days=1)).isoformat(),
          "txto": 끝날.isoformat()}

    화면 = db.execute(text("""
        SELECT name, count(*) AS n
          FROM life_expense.action_logs
         WHERE kind = 'view'
           AND created_at >= CAST(:frm AS date)
           AND created_at < CAST(:to AS date)
      GROUP BY name
      ORDER BY n DESC, name ASC
         LIMIT 20
    """), 틈).mappings().all()

    기능 = db.execute(text("""
        SELECT name, count(*) AS n
          FROM life_expense.action_logs
         WHERE kind = 'feature'
           AND created_at >= CAST(:frm AS date)
           AND created_at < CAST(:to AS date)
      GROUP BY name
      ORDER BY n DESC, name ASC
         LIMIT 20
    """), 틈).mappings().all()

    # 느린 요청과 실패한 요청. 둘을 갈라 센다.
    #
    # 가르는 잣대는 status 다. 화면 쪽 인터셉터가 둘을 다른 자리에서 적는다
    # (frontend/src/api/client.ts). 끝난 요청이 1초를 넘기면 그때의 status 를
    # 그대로 적으므로 200대가 들어오고, 물린 요청은 400대나 500대가 들어온다.
    # 아예 닿지 못한 요청은 status 가 비어 있어 이쪽도 실패로 센다.
    #
    # 한 요청이 느리면서 물리기도 하면 실패 쪽으로만 간다. 적는 자리가 하나라
    # 겹쳐 세지 않는다.
    느림조건 = "status IS NOT NULL AND status < 400"
    실패조건 = "status IS NULL OR status >= 400"

    def 탈모으기(조건: str, 차례: str):
        return db.execute(text(f"""
            SELECT name
                 , count(*) AS n
                 , max(elapsed_ms) AS worst
                 , max(status) AS status
              FROM life_expense.action_logs
             WHERE kind = 'error'
               AND ({조건})
               AND created_at >= CAST(:frm AS date)
               AND created_at < CAST(:to AS date)
          GROUP BY name
          ORDER BY {차례}
             LIMIT 20
        """), 틈).mappings().all()

    # 느린 쪽은 가장 느린 것부터, 실패한 쪽은 가장 잦은 것부터 본다.
    느린것 = 탈모으기(느림조건, "worst DESC NULLS LAST, n DESC")
    실패것 = 탈모으기(실패조건, "n DESC, name ASC")

    # 적고 고친 건수 — 날짜별로 센다. 그림이 날마다 한 점씩 찍는다.
    적음 = db.execute(text("""
        SELECT e.tx_date AS d, count(*) AS n
          FROM life_expense.entries e
         WHERE e.tx_date >= CAST(:frm AS date)
           AND e.tx_date <= CAST(:txto AS date)
      GROUP BY e.tx_date
      ORDER BY e.tx_date ASC
    """), 틈).mappings().all()

    # 날짜별 조회. 꺾은선이 날마다 한 점씩 찍는다.
    날별 = db.execute(text("""
        SELECT created_at::date AS d, count(*) AS n
          FROM life_expense.action_logs
         WHERE kind = 'view'
           AND created_at >= CAST(:frm AS date)
           AND created_at < CAST(:to AS date)
      GROUP BY 1
      ORDER BY 1 ASC
    """), 틈).mappings().all()

    # 요일별 조회. 0이 일요일이다(PostgreSQL의 dow).
    요일 = db.execute(text("""
        SELECT extract(dow from created_at)::int AS d, count(*) AS n
          FROM life_expense.action_logs
         WHERE kind = 'view'
           AND created_at >= CAST(:frm AS date)
           AND created_at < CAST(:to AS date)
      GROUP BY 1
      ORDER BY 1 ASC
    """), 틈).mappings().all()

    # 시간대별 조회. 스물넉 점은 손전화에서 너무 촘촘해 세 시간씩 묶는다.
    시간 = db.execute(text("""
        SELECT (extract(hour from created_at)::int / 3) * 3 AS h, count(*) AS n
          FROM life_expense.action_logs
         WHERE kind = 'view'
           AND created_at >= CAST(:frm AS date)
           AND created_at < CAST(:to AS date)
      GROUP BY 1
      ORDER BY 1 ASC
    """), 틈).mappings().all()

    # 갈래별 합계. 맨 위 칸이 이 수를 적는다.
    갈래 = dict(db.execute(text("""
        SELECT kind, count(*) AS n
          FROM life_expense.action_logs
         WHERE created_at >= CAST(:frm AS date)
           AND created_at < CAST(:to AS date)
      GROUP BY kind
    """), 틈).all())

    요일이름 = ["일", "월", "화", "수", "목", "금", "토"]
    조회합 = int(갈래.get("view", 0))
    적음합 = sum(int(r["n"]) for r in 적음)

    return {
        "days": 날,
        "from": 첫날.isoformat(),
        "to": 끝날.isoformat(),
        "view": [{"name": r["name"], "n": r["n"]} for r in 화면],
        "feature": [{"name": r["name"], "n": r["n"]} for r in 기능],
        "slow": [{"name": r["name"], "n": r["n"], "worst": r["worst"]} for r in 느린것],
        "fail": [{"name": r["name"], "n": r["n"], "status": r["status"]} for r in 실패것],
        "write": [{"date": str(r["d"]), "n": r["n"]} for r in 적음],
        "daily": [{"date": str(r["d"]), "n": r["n"]} for r in 날별],
        # 빈 요일도 0으로 채운다. 그러지 않으면 막대가 일곱이 아니라 서넛만 선다.
        "dow": [
            {"name": 요일이름[i], "n": next((int(r["n"]) for r in 요일 if r["d"] == i), 0)}
            for i in range(7)
        ],
        # 빈 시간대도 0으로 채운다. 같은 까닭이다.
        "hour": [
            {"name": f"{h}시", "n": next((int(r["n"]) for r in 시간 if int(r["h"]) == h), 0)}
            for h in range(0, 24, 3)
        ],
        "kpi": {
            "view": 조회합,
            "feature": int(갈래.get("feature", 0)),
            "slow": sum(int(r["n"]) for r in 느린것),
            "fail": sum(int(r["n"]) for r in 실패것),
            "write": 적음합,
            # 하루 평균. 소수점은 한 자리까지만 쓴다.
            "view_per_day": round(조회합 / 날, 1),
        },
    }


# ── 고치는 자리 ─────────────────────────────────────────────
#
# 아래는 모두 토큰을 받는다. 읽기만 하는 GET /prefs와 다르다.


@router.put("/menu-off")
def set_menu_off(payload: dict, _: str = Depends(토큰), db: SessionDep = Depends()):
    """
    꺼 놓을 메뉴를 적는다.

    켜진 것은 적지 않는다. 새 기능을 더했을 때 목록에 없다고 꺼져 버리면
    안 되기 때문이다. 빈 배열을 보내면 전부 켜진다.
    """
    온것 = payload.get("menu_off")
    if not isinstance(온것, list):
        raise HTTPException(status_code=400, detail="꺼 놓을 메뉴 목록이 없습니다.")
    열쇠들 = sorted({str(x)[:40] for x in 온것 if str(x).strip()})
    _적기(db, "menu_off", json.dumps(열쇠들, ensure_ascii=False))
    db.commit()
    return {"menu_off": 열쇠들}


@router.get("/notices")
def admin_list_notices(_: str = Depends(토큰), db: SessionDep = Depends()):
    """
    적은 공지를 전부 돌려준다. 꺼 놓은 것과 지난 것도 함께 보인다.

    등록한 때와 고친 때도 함께 준다. 목록이 그 둘을 딱지로 보이기 때문이다.
    고친 적이 없으면 updated_at이 비어 있으므로 화면이 등록한 때만 적는다.
    날짜만 자른다. 시각까지는 목록에서 읽을 일이 없다.
    """
    rows = db.execute(text("""
        SELECT notice_id, title, body, start_on, end_on, sort_order, is_active,
               created_at, updated_at
          FROM life_expense.notices
      ORDER BY sort_order ASC, notice_id DESC
    """)).mappings().all()
    return [{
        "notice_id": r["notice_id"],
        "title": r["title"],
        "body": r["body"],
        "start_on": str(r["start_on"]) if r["start_on"] else None,
        "end_on": str(r["end_on"]) if r["end_on"] else None,
        "sort_order": r["sort_order"],
        "is_active": r["is_active"],
        "created_on": str(r["created_at"])[:10] if r["created_at"] else None,
        # 적을 때 updated_at도 함께 채워지므로, 날짜만 견주면 그날 고치지
        # 않은 공지도 고친 것처럼 보인다. 시각까지 견뤄 정말 손댄 것만 준다.
        "updated_on": (
            str(r["updated_at"])[:10]
            if r["updated_at"] and r["created_at"] and r["updated_at"] > r["created_at"]
            else None
        ),
    } for r in rows]


def _공지값(payload: dict) -> dict:
    제목 = str(payload.get("title") or "").strip()
    if not 제목:
        raise HTTPException(status_code=400, detail="공지 제목을 적어 주세요.")
    뜰날 = str(payload.get("start_on") or "").strip() or None
    끝날 = str(payload.get("end_on") or "").strip() or None
    if 뜰날 and 끝날 and 끝날 < 뜰날:
        raise HTTPException(status_code=400, detail="끝나는 날이 뜨는 날보다 앞섭니다.")
    return {
        "title": 제목[:100],
        "body": (str(payload.get("body")) if payload.get("body") else None),
        "start_on": 뜰날,
        "end_on": 끝날,
        "sort_order": int(payload.get("sort_order") or 0),
        "is_active": 1 if payload.get("is_active", 1) else 0,
    }


@router.post("/notices")
def admin_add_notice(payload: dict, _: str = Depends(토큰), db: SessionDep = Depends()):
    """공지 한 줄을 적는다."""
    값 = _공지값(payload)
    새번호 = db.execute(text("""
        INSERT INTO life_expense.notices (title, body, start_on, end_on, sort_order, is_active)
             VALUES (:title, :body, CAST(:start_on AS date), CAST(:end_on AS date), :sort_order, :is_active)
          RETURNING notice_id
    """), 값).scalar()
    db.commit()
    return {"notice_id": 새번호}


@router.put("/notices/{notice_id}")
def admin_edit_notice(notice_id: int, payload: dict, _: str = Depends(토큰), db: SessionDep = Depends()):
    """공지 한 줄을 고친다."""
    값 = _공지값(payload)
    값["notice_id"] = notice_id
    바뀜 = db.execute(text("""
        UPDATE life_expense.notices
           SET title = :title
             , body = :body
             , start_on = CAST(:start_on AS date)
             , end_on = CAST(:end_on AS date)
             , sort_order = :sort_order
             , is_active = :is_active
             , updated_at = now()
         WHERE notice_id = :notice_id
    """), 값).rowcount
    db.commit()
    if not 바뀜:
        raise HTTPException(status_code=404, detail="그 공지가 없습니다.")
    return {"ok": True}


@router.delete("/notices/{notice_id}")
def admin_drop_notice(notice_id: int, _: str = Depends(토큰), db: SessionDep = Depends()):
    """공지 한 줄을 지운다. 되살릴 수 없다 — 잠시 치우려면 끄기를 쓴다."""
    바뀜 = db.execute(text("""
        DELETE FROM life_expense.notices WHERE notice_id = :i
    """), {"i": notice_id}).rowcount
    db.commit()
    if not 바뀜:
        raise HTTPException(status_code=404, detail="그 공지가 없습니다.")
    return {"ok": True}


@router.get("/doodle-items")
def admin_list_doodle(_: str = Depends(토큰), db: SessionDep = Depends()):
    """애니메이션 문구를 전부 돌려준다. 꺼 놓은 것도 함께 보인다."""
    rows = db.execute(text("""
        SELECT item_key, kind, label, sort_order, is_active
          FROM life_expense.doodle_items
      ORDER BY sort_order ASC, item_key ASC
    """)).mappings().all()
    return [dict(r) for r in rows]


@router.put("/doodle-items/{item_key}")
def admin_edit_doodle(item_key: str, payload: dict, _: str = Depends(토큰), db: SessionDep = Depends()):
    """
    문구 하나를 켜거나 끄거나, 이름을 고친다.

    보낸 칸만 고친다. is_active만 보내면 이름은 그대로고, label만 보내면
    켠 상태가 그대로다. 둘 다 보내면 둘 다 고친다. 화면이 끄기와 이름
    고치기를 따로 부르므로, 안 보낸 칸까지 기본값으로 덮으면 하나를 고칠
    때마다 다른 하나가 되돌아간다.

    모두 끄는 것도 막지 않는다. 화면이 그때는 코드에 있는 열 가지를 쓰므로
    쪽지가 빈 채로 돌지는 않는다(frontend/src/utils/doodlePool.ts).

    모양의 이름도 고칠 수 있다. 화면은 이름이 아니라 열쇠로 그림을 고르므로
    (components/MarkIcon.tsx) 이름을 바꿔도 그리는 것은 그대로다.
    """
    칸 = []
    값 = {"k": item_key}
    if "is_active" in payload:
        칸.append("is_active = :on")
        값["on"] = 1 if payload.get("is_active") else 0
    if "label" in payload:
        글 = str(payload.get("label") or "").strip()
        if not 글:
            raise HTTPException(status_code=400, detail="이름을 적어 주세요.")
        if len(글) > 40:
            raise HTTPException(status_code=400, detail="이름은 마흔 자까지 적을 수 있습니다.")
        칸.append("label = :l")
        값["l"] = 글
    if not 칸:
        raise HTTPException(status_code=400, detail="고칠 것이 없습니다.")

    바뀜 = db.execute(text(
        "UPDATE life_expense.doodle_items SET " + ", ".join(칸) + " WHERE item_key = :k"
    ), 값).rowcount
    db.commit()
    if not 바뀜:
        raise HTTPException(status_code=404, detail="그 문구가 없습니다.")
    return {"ok": True}


@router.post("/doodle-items")
def admin_add_doodle(payload: dict, _: str = Depends(토큰), db: SessionDep = Depends()):
    """
    인사 문구를 하나 더한다.

    더할 수 있는 것은 kind가 hello인 것뿐이다. 모양(mark)은 화면이 손으로
    그리는 그림이라(PenMark.tsx), 이름만 적어서는 그릴 것이 없다.

    열쇠는 서버가 짓는다. 화면이 지으면 같은 열쇠를 두 번 보낼 수 있고,
    그때 어느 쪽이 남는지가 손에 달린다.
    """
    글 = str(payload.get("label") or "").strip()
    if not 글:
        raise HTTPException(status_code=400, detail="문구를 적어 주세요.")
    if len(글) > 40:
        raise HTTPException(status_code=400, detail="문구는 마흔 자까지 적을 수 있습니다.")

    뒷자리 = db.execute(text("""
        SELECT coalesce(max(sort_order), 0) + 1 AS n
          FROM life_expense.doodle_items
         WHERE kind = 'hello'
    """)).scalar_one()
    열쇠 = f"hello-{uuid.uuid4().hex[:8]}"
    db.execute(text("""
        INSERT INTO life_expense.doodle_items (item_key, kind, label, sort_order, is_active)
        VALUES (:k, 'hello', :l, :o, 1)
    """), {"k": 열쇠, "l": 글, "o": 뒷자리})
    db.commit()
    return {"item_key": 열쇠}


@router.delete("/doodle-items/{item_key}")
def admin_del_doodle(item_key: str, _: str = Depends(토큰), db: SessionDep = Depends()):
    """
    인사 문구를 지운다.

    모양(mark)은 지우지 못한다. 화면이 그 열쇠로 그림을 고르므로, 줄이
    사라지면 그릴 수 없는 열쇠를 가리키게 된다. 쓰지 않으려면 끄면 된다.
    """
    갈래 = db.execute(text("""
        SELECT kind FROM life_expense.doodle_items WHERE item_key = :k
    """), {"k": item_key}).scalar_one_or_none()
    if 갈래 is None:
        raise HTTPException(status_code=404, detail="그 문구가 없습니다.")
    if 갈래 != "hello":
        raise HTTPException(status_code=400, detail="모양은 지울 수 없습니다. 끄면 안 쓰입니다.")

    db.execute(text("""
        DELETE FROM life_expense.doodle_items WHERE item_key = :k
    """), {"k": item_key})
    db.commit()
    return {"ok": True}
