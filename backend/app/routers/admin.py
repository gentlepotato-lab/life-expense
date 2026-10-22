"""
관리자 페이지가 쓰는 자리.

site_prefs를 읽고 적고, 대시보드가 볼 집계를 돌려준다. 읽는 길 하나만 암호
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

from fastapi import APIRouter, Depends, Header, HTTPException, Request
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


def _들어온자리(real_ip: str | None, forwarded: str | None, request: Request) -> str:
    """
    어디서 들어왔나.

    앞에 선 nginx 가 X-Real-IP 로 넘겨준다(Gateway 의 snippets/proxy.conf).
    그 머리를 먼저 보고, 없으면 X-Forwarded-For 의 맨 앞을 본다. 둘 다
    없으면 붙은 자리를 그대로 적는데, 그때 적히는 것은 nginx 의 자리다.

    맨 앞을 보는 까닭은 거쳐 온 자리가 쉼표로 이어 붙기 때문이다. 뒤쪽은
    거쳐 온 길이고 맨 앞이 처음 보낸 자리다.
    """
    if real_ip and real_ip.strip():
        return real_ip.strip()[:45]
    if forwarded and forwarded.strip():
        return forwarded.split(",")[0].strip()[:45]
    붙은데 = request.client.host if request.client else ""
    return (붙은데 or "")[:45]


def _기기이름(agent: str | None) -> str:
    """
    브라우저가 밝힌 글에서 기기 이름을 짓는다.

    담는 것은 그 글 한 줄뿐이고, 화면에는 이렇게 추린 이름만 띄운다. 긴
    글을 그대로 띄우면 줄 하나가 화면을 다 먹는다.

    바탕만 적는다. 보는 것까지 붙여 「Windows Chrome」으로 적던 때는 412px
    에서 딱지가 「Windows Ch...」로 잘렸다. 칸 이름도 기기라, 무엇으로 보는지
    보다 어느 기기인지가 먼저다. 보는 것은 agent 칸에 그대로 남아 있다.

    가리지 못하면 「다른 기기」다. 틀린 이름을 지어 붙이느니 모른다고
    적는 편이 낫다.
    """
    g = agent or ""
    바탕 = (
        "iPhone" if "iPhone" in g
        else "iPad" if "iPad" in g
        else "Android" if "Android" in g
        else "Windows" if "Windows" in g
        else "Mac" if "Macintosh" in g or "Mac OS" in g
        else ""
    )
    return 바탕 or "다른 기기"


@router.post("/login")
def admin_login(
    payload: dict,
    request: Request,
    user_agent: str | None = Header(default=None),
    x_real_ip: str | None = Header(default=None),
    x_forwarded_for: str | None = Header(default=None),
    db: SessionDep = Depends(),
):
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

    기기 = (user_agent or "")[:200]
    자리 = _들어온자리(x_real_ip, x_forwarded_for, request)

    # 같은 기기에서 열려 있던 줄은 닫는다. 한 기기에 여러 줄이 열려 있을
    # 까닭이 없다. 지우지는 않는다. 줄 자체는 로그인 기록이라, 지우면 언제
    # 들어왔는지가 함께 사라진다. 끝나는 때를 지금으로 당겨 닫힌 것으로
    # 남긴다.
    #
    # 기기를 가리지 못하는 때(글이 비어 있을 때)는 건드리지 않는다. 그
    # 하나로 다른 기기까지 함께 닫히기 때문이다.
    if 기기:
        db.execute(text("""
            UPDATE life_expense.admin_sessions
               SET expires_at = now()
             WHERE agent = :a
               AND expires_at > now()
        """), {"a": 기기})

    새토큰 = secrets.token_urlsafe(32)[:64]
    db.execute(text("""
        INSERT INTO life_expense.admin_sessions (token, expires_at, agent, ip)
             VALUES (:t, :e, :a, :ip)
    """), {
        "t": 새토큰,
        "e": datetime.now() + timedelta(hours=TOKEN_HOURS),
        "a": 기기 or None,
        "ip": 자리 or None,
    })
    # 지난 토큰을 들어올 때마다 걷던 자리를 걷었다. 그 줄이 곧 로그인
    # 기록이라, 걷으면 언제 들어왔는지가 함께 사라졌다. 묵은 줄은 달마다
    # 도는 정리가 걷는다(app/scheduler/cleanup_job.py).
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

    화면이 따로따로 물으면 기간을 바꿀 때마다 요청이 그만큼 나간다. 집계가
    싸므로 한 번에 모아 보낸다.

    기간은 날짜 두 개로 받는다(frm, to). 둘 다 그날을 품는다. 날짜로 받아야
    화면이 고른 기간을 그대로 되비칠 수 있다. 예전처럼 days만 받으면 화면은
    "최근 30일"이라고만 적을 수 있고, 그 서른 날이 언제부터 언제까지인지는
    서버만 안다.

    days도 그대로 받는다. 아직 날짜를 안 보내는 쪽이 있을 때를 위해서다. 둘 다
    없으면 이번 달이다.

    쓰고 수정한 건수(write)만 action_logs가 아니라 entries에서 센다. 날짜 칸이
    있어 거기서 세면 지난 것까지 소급해서 보인다.
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
         LIMIT 60
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

    # 빈 날도 0으로 채운다. 쌓인 날만 보내면 꺾은선이 그 날들만 이어, 아무
    # 일도 없던 날이 그래프에서 아예 사라진다. 요일과 시간대를 채우는 것과
    # 같은 까닭이다.
    def 날채우기(들, 열쇠: str = "d"):
        있는것 = {str(r[열쇠]): int(r["n"]) for r in 들}
        나올것 = []
        날짜 = 첫날
        while 날짜 <= 끝날:
            글 = 날짜.isoformat()
            나올것.append({"date": 글, "n": 있는것.get(글, 0)})
            날짜 += timedelta(days=1)
        return 나올것

    return {
        "days": 날,
        "from": 첫날.isoformat(),
        "to": 끝날.isoformat(),
        "view": [{"name": r["name"], "n": r["n"]} for r in 화면],
        "feature": [{"name": r["name"], "n": r["n"]} for r in 기능],
        "slow": [{"name": r["name"], "n": r["n"], "worst": r["worst"]} for r in 느린것],
        "fail": [{"name": r["name"], "n": r["n"], "status": r["status"]} for r in 실패것],
        "write": 날채우기(적음),
        "daily": 날채우기(날별),
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


# ── 읽기만 하는 자리 ────────────────────────────────────────
#
# 아래 셋은 집계를 내놓기만 한다. 고치는 길은 두지 않는다.


# 조회 기록에서 한 번에 내놓는 줄 수. 손전화에서 한 쪽에 담을 만큼이다.
# 더 보려면 기간을 좁히거나 갈래로 거른다.
기록한도 = 200


@router.get("/logs")
def admin_logs(
    frm: str | None = None,
    to: str | None = None,
    kind: str | None = None,
    _: str = Depends(토큰),
    db: SessionDep = Depends(),
):
    """
    쌓인 기록을 한 줄씩 내놓는다.

    대시보드는 묶어서만 보여 준다. 그래서 "그 요청이 언제 몇 ms였는지"를 볼
    자리가 없었다. 여기가 그 자리다.

    묵은 기록은 달마다 지워진다(app/scheduler/cleanup_job.py). 그래서 아무리
    거슬러 올라가도 90일 치뿐이다.
    """
    조건 = ["1 = 1"]
    값: dict = {"한도": 기록한도}
    if frm:
        조건.append("a.created_at >= CAST(:frm AS date)")
        값["frm"] = frm
    if to:
        # 끝 날짜를 담으려면 그 다음 날 0시 앞까지 본다.
        조건.append("a.created_at < CAST(:to AS date) + INTERVAL '1 day'")
        값["to"] = to
    if kind in ("view", "feature", "error"):
        조건.append("a.kind = :kind")
        값["kind"] = kind

    rows = db.execute(text(f"""
        SELECT a.log_id
             , a.kind
             , a.name
             , a.path
             , a.elapsed_ms
             , a.status
             , to_char(a.created_at, 'YYYY-MM-DD') AS on_day
             , to_char(a.created_at, 'HH24:MI:SS')  AS at_time
          FROM life_expense.action_logs a
         WHERE {' AND '.join(조건)}
      ORDER BY a.log_id DESC
         LIMIT :한도
    """), 값).mappings().all()

    return [{
        "log_id": r["log_id"],
        "kind": r["kind"],
        "name": r["name"],
        "path": r["path"],
        "elapsed_ms": r["elapsed_ms"],
        "status": r["status"],
        "on_day": r["on_day"],
        "at_time": r["at_time"],
    } for r in rows]


# 쌓인 양을 보여 줄 표와 그 이름.
#
# 이름은 사용자 사이트가 쓰는 화면 이름을 그대로 쓴다(utils/pageTitles.ts).
# 표 이름을 그대로 띄우면 무엇이 쌓인 것인지 읽히지 않는다.
표들 = [
    ("entries", "지출 내역"),
    ("pending_entries", "대기 내역"),
    ("scheduled_entries", "정기 내역"),
    ("entry_groups", "묶음 내역"),
    ("places", "장소"),
    ("counterparts", "함께한 상대"),
    ("payment_methods", "결제 수단"),
    ("notices", "공지"),
    ("action_logs", "조회 기록"),
    ("holidays", "공휴일"),
]


@router.get("/db")
def admin_db(_: str = Depends(토큰), db: SessionDep = Depends()):
    """
    붙은 곳과 쌓인 양.

    비밀은 내놓지 않는다. 사는 곳과 이름만 적고 비밀번호는 쳐다보지도
    않는다(app/deps.py가 .env에서 읽어 쓴다).

    차지한 자리는 여기서 재지 않는다. 그 한 질의가 400ms를 먹어 쪽 전체가
    그만큼 늦게 떴다. 따로 묻는 길을 냈다(/admin/db-size).
    """
    판 = db.execute(text("SHOW server_version")).scalar() or ""

    # 표마다 줄 수. 표 이름은 코드에 적힌 것만 쓰므로 바깥에서 들어온 글이
    # 질의에 섞일 길이 없다.
    #
    # 한 번에 묻는다. 표마다 따로 물었더니 열 번을 오가느라 이 길 하나가
    # 300ms를 넘겼다. 세는 일 자체는 같고 오가는 횟수만 줄어든다.
    칸들 = ", ".join(
        f"(SELECT count(*) FROM life_expense.{표}) AS {표}" for 표, _ in 표들
    )
    한줄 = db.execute(text(f"SELECT {칸들}")).mappings().one()
    집계 = [{"table": 표, "name": 이름, "n": int(한줄[표])} for 표, 이름 in 표들]

    return {
        "server": {
            # 종류와 버전을 갈라 내놓는다. 「PostgreSQL 17.6」 한 글로 묶어
            # 보내면 화면이 한 줄에 둘을 적게 되고, 그 줄에 붙일 이름이
            # 마땅치 않다.
            "kind": "PostgreSQL",
            "version": 판.split(" ")[0],
            "host": f"{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}",
            "db": os.getenv("DB_NAME") or "",
            "schema": "life_expense",
        },
        "tables": 집계,
    }


# 바깥에 묻는 자리들.
#
# 열쇠 이름만 적는다. 값은 쳐다보지도 않는다. 꽂혀 있는지만 보고 내놓는다.
# 쓰임은 사용자 사이트의 화면 이름으로 적는다(utils/pageTitles.ts).
#
# where 는 열쇠가 어디 꽂혀 있나다. 서버 것은 backend/.env 에 있어 여기서
# 바로 보지만, 브라우저 것은 frontend/.env 에 있어 서버가 볼 수 없다. 그쪽은
# 화면이 제 손으로 보고 채운다(AdminApis.tsx).
#
# 쓰임이 「아직 안 씀」인 것은 열쇠만 꽂혀 있고 부르는 데가 코드에 없다는
# 뜻이다. 찾아보니 NAVER 와 오픈뱅킹과 Superset 셋이 그렇다.
바깥들 = [
    {
        "key": "kasi",
        "name": "한국천문연구원 특일 정보",
        "use": "공휴일",
        "where": "서버",
        "envs": ["KASI_API_KEY"],
        # 배치가 호출하는 자리라 바퀴 자국도 함께 읽는다. 바퀴는 하루에 한
        # 번이고 그 안에서 두 달을 묻는데, 기록은 묻는 때마다 한 줄씩
        # 쌓이므로 그쪽이 더 촘촘하다.
        "job_key": "holiday_update_daily",
        "log_name": "한국천문연구원 특일 정보",
    },
    {
        "key": "kakao",
        "name": "카카오 지도",
        "use": "장소 찾기",
        "where": "브라우저",
        "envs": ["VITE_KAKAO_MAP_KEY"],
        "job_key": None,
        # 브라우저가 바로 부르므로 서버가 볼 수 없다. 화면이 적어 보낸 줄을
        # 기록에서 읽는다(utils/track.ts 의 바깥적기).
        "log_name": "카카오 지도",
    },
    {
        "key": "naver",
        "name": "NAVER 지도",
        "use": "아직 안 씀",
        "where": "서버",
        "envs": ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"],
        "job_key": None,
        "log_name": None,
    },
    {
        "key": "openbanking",
        "name": "금융결제원 오픈뱅킹",
        "use": "아직 안 씀",
        "where": "서버",
        "envs": ["OPENBANKING_CLIENT_ID", "OPENBANKING_CLIENT_SECRET"],
        "job_key": None,
        "log_name": None,
    },
    {
        "key": "superset",
        "name": "Superset",
        "use": "아직 안 씀",
        "where": "서버",
        "envs": ["SUPERSET_URL", "SUPERSET_USERNAME", "SUPERSET_PASSWORD"],
        "job_key": None,
        "log_name": None,
    },
]


@router.get("/apis")
def admin_apis(_: str = Depends(토큰), db: SessionDep = Depends()):
    """
    바깥에 묻는 자리와 그 상태.

    **열쇠 값은 내놓지 않는다.** 꽂혀 있는지(true/false)만 적는다. 값을 한 번
    내보내면 그 뒤로는 어디에 남아 있는지 쫓을 길이 없다.

    호출한 기록은 두 곳에서 쌓인다. 배치가 부르는 자리는 바퀴 자국에서
    (job_runs), 브라우저가 바로 부르는 자리는 화면이 적어 보낸 줄에서
    (action_logs의 api 갈래) 읽는다.
    """
    rows = db.execute(text("""
        SELECT DISTINCT ON (r.job_key)
               r.job_key
             , to_char(r.started_at, 'YYYY-MM-DD') AS on_day
             , to_char(r.started_at, 'HH24:MI')    AS at_time
             , r.ok
             , r.note
          FROM life_expense.job_runs r
      ORDER BY r.job_key, r.started_at DESC
    """)).mappings().all()
    마지막 = {r["job_key"]: r for r in rows}

    # 브라우저가 바로 부르는 자리는 화면이 적어 보낸 줄에서 읽는다.
    # 걸린 시간은 밀리초로, 상태는 400 아래면 잘된 것으로 본다.
    적힌것 = db.execute(text("""
        SELECT DISTINCT ON (a.name)
               a.name
             , to_char(a.created_at, 'YYYY-MM-DD') AS on_day
             , to_char(a.created_at, 'HH24:MI')    AS at_time
             , (a.status IS NULL OR a.status < 400) AS ok
             , a.path
             , a.elapsed_ms
          FROM life_expense.action_logs a
         WHERE a.kind = 'api'
      ORDER BY a.name, a.created_at DESC
    """)).mappings().all()
    적힌마지막 = {r["name"]: r for r in 적힌것}

    # 요즘 얼마나 불렀나. 묵은 기록은 달마다 지워지므로 아무리 거슬러도
    # 90일 치뿐이다(app/scheduler/cleanup_job.py).
    센것 = db.execute(text("""
        SELECT a.name
             , count(*) AS n
          FROM life_expense.action_logs a
         WHERE a.kind = 'api'
           AND a.created_at >= now() - interval '30 days'
      GROUP BY a.name
    """)).mappings().all()
    횟수 = {r["name"]: int(r["n"]) for r in 센것}

    out = []
    for b in 바깥들:
        # 기록을 먼저 본다. 묻는 때마다 한 줄씩 쌓여 바퀴 자국보다 촘촘하다.
        r = None
        if b.get("log_name"):
            l = 적힌마지막.get(b["log_name"])
            if l:
                r = {
                    "on_day": l["on_day"],
                    "at_time": l["at_time"],
                    "ok": l["ok"],
                    "ms": l["elapsed_ms"],
                }
        if r is None and b["job_key"]:
            r = 마지막.get(b["job_key"])
        out.append({
            "key": b["key"],
            "name": b["name"],
            "use": b["use"],
            "where": b["where"],
            # 하나라도 비어 있으면 꽂히지 않은 것으로 본다. 브라우저에 꽂힌
            # 것은 서버가 볼 수 없으므로 화면에 미룬다.
            "ready": (
                all(bool((os.getenv(e) or "").strip()) for e in b["envs"])
                if b["where"] == "서버"
                else None
            ),
            "last_day": r["on_day"] if r else None,
            "last_time": r["at_time"] if r else None,
            "last_ok": bool(r["ok"]) if r else None,
            # 걸린 시간. 배치가 부른 자리는 잰 것이 없어 비운다.
            "last_ms": r.get("ms") if r else None,
            # 30일 동안 부른 횟수. 적힌 적이 없으면 0이다.
            "hits": 횟수.get(b.get("log_name") or "", 0),
        })
    return out


@router.get("/batch")
def admin_batch(_: str = Depends(토큰), db: SessionDep = Depends()):
    """
    도는 일과 그 때.

    때는 표가 쥐고, 다음에 돌 때는 스케줄러가 쥔다(app/scheduler/registry.py).
    마지막으로 돈 때는 바퀴 자국에서 꺼낸다.
    """
    from app.scheduler.registry import 지금모습

    일들 = 지금모습()

    # 일마다 마지막 한 줄. 일이 셋뿐이라 한 번에 꺼내 짝짓는다.
    rows = db.execute(text("""
        SELECT DISTINCT ON (r.job_key)
               r.job_key
             , to_char(r.started_at, 'YYYY-MM-DD') AS on_day
             , to_char(r.started_at, 'HH24:MI')    AS at_time
             , r.ok
             , r.note
          FROM life_expense.job_runs r
      ORDER BY r.job_key, r.started_at DESC
    """)).mappings().all()
    마지막 = {r["job_key"]: r for r in rows}

    for 일 in 일들:
        r = 마지막.get(일["key"])
        일["last_day"] = r["on_day"] if r else None
        일["last_time"] = r["at_time"] if r else None
        일["last_ok"] = bool(r["ok"]) if r else None
        일["last_note"] = (r["note"] or "") if r else ""

    return 일들


@router.get("/batch/runs")
def admin_batch_runs(
    key: str = "",
    _: str = Depends(토큰),
    db: SessionDep = Depends(),
):
    """
    일이 실행된 기록.

    카드에 서는 것은 마지막 한 줄뿐이라, 어제도 실행됐는지 며칠째 실패하는지는
    카드만 보고 알 수 없다. 그 자리에서 이 쪽으로 들어온다
    (frontend/src/pages/components/AdminBatchRuns.tsx).

    열쇠를 주면 그 일만, 안 주면 모두 섞어 돌려준다. 바퀴 자국은 달마다
    치우므로(app/scheduler/cleanup_job.py) 아무리 거슬러도 90일 치뿐이다.
    """
    rows = db.execute(text("""
        SELECT r.job_key
             , to_char(r.started_at, 'YYYY-MM-DD') AS on_day
             , to_char(r.started_at, 'HH24:MI:SS') AS at_time
             , r.ok
             , r.note
             , r.elapsed_ms
          FROM life_expense.job_runs r
         WHERE (:key = '' OR r.job_key = :key)
      ORDER BY r.started_at DESC
         LIMIT 200
    """), {"key": key}).mappings().all()

    from app.scheduler.registry import 이름들

    이름 = 이름들()
    return [
        {
            "job_key": r["job_key"],
            "name": 이름.get(r["job_key"], r["job_key"]),
            "on_day": r["on_day"],
            "at_time": r["at_time"],
            "ok": bool(r["ok"]),
            "note": r["note"] or "",
            "ms": r["elapsed_ms"],
        }
        for r in rows
    ]


@router.put("/batch/{job_key}")
def admin_set_batch(job_key: str, payload: dict, _: str = Depends(토큰), db: SessionDep = Depends()):
    """
    도는 때를 고친다.

    고치고 나서 그 자리에서 다시 건다. 서버를 다시 띄워야 바뀐다면 「고쳤다」가
    말이 되지 않는다.

    받는 값은 셋뿐이다. 그 밖의 꼴은 돌려보낸다 — 표에도 같은 가름이 걸려
    있지만(job_schedules_kind_chk), 틀린 값으로 스케줄러를 건드리면 그 일이
    아예 안 돌게 된다.
    """
    kind = str(payload.get("kind") or "").strip()
    if kind not in ("minute", "daily", "monthly"):
        raise HTTPException(status_code=400, detail="도는 꼴이 올바르지 않습니다.")

    def _수(열쇠: str, 낮: int, 높: int):
        값 = payload.get(열쇠)
        if 값 is None or 값 == "":
            return None
        try:
            n = int(값)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="시간이 올바르지 않습니다.")
        if n < 낮 or n > 높:
            raise HTTPException(status_code=400, detail="시간이 올바르지 않습니다.")
        return n

    시 = _수("hour", 0, 23)
    분 = _수("minute", 0, 59)
    날 = _수("day_of_month", 1, 28)

    # 꼴마다 있어야 할 값이 다르다. 없으면 받지 않는다 — 비운 채 걸면
    # 0시 0분으로 돌아 엉뚱한 때에 돈다.
    if kind in ("daily", "monthly") and (시 is None or 분 is None):
        raise HTTPException(status_code=400, detail="시간을 입력해 주세요.")
    if kind == "monthly" and 날 is None:
        raise HTTPException(status_code=400, detail="날짜를 입력해 주세요.")
    if kind == "minute":
        시 = 분 = 날 = None

    낸것 = db.execute(text("""
        UPDATE life_expense.job_schedules
           SET kind = :kind
             , day_of_month = :날
             , hour = :시
             , minute = :분
             , updated_at = now()
         WHERE job_key = :k
    """), {"kind": kind, "날": 날, "시": 시, "분": 분, "k": job_key})
    if 낸것.rowcount == 0:
        raise HTTPException(status_code=404, detail="그런 작업이 없습니다.")
    db.commit()

    from app.scheduler.registry import reschedule

    reschedule(job_key)
    return {"ok": True}


@router.get("/db-size")
def admin_db_size(_: str = Depends(토큰), db: SessionDep = Depends()):
    """
    차지한 자리.

    /admin/db에서 떼어 낸 까닭은 이 한 질의가 400ms를 먹기 때문이다. 표와
    딸린 것을 모두 더하느라 파일 크기를 하나하나 묻는데, 그동안 쪽 전체가
    기다렸다. 화면은 먼저 서고 이 값만 뒤늦게 채워진다.
    """
    크기 = db.execute(text("""
        SELECT pg_size_pretty(COALESCE(SUM(pg_total_relation_size(c.oid)), 0))
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'life_expense'
    """)).scalar() or "-"
    return {"size": 크기}


@router.get("/sessions")
def admin_sessions(
    frm: str | None = None,
    to: str | None = None,
    ok: str | None = None,
    x_admin_token: str | None = Header(default=None),
    _: str = Depends(토큰),
    db: SessionDep = Depends(),
):
    """
    로그인한 때를 한 줄씩.

    성공과 실패를 한 줄로 합쳐 내놓는다. 둘을 따로 두니 누가 자꾸
    들어오려 하는지 보려면 두 목록을 눈으로 맞춰 가며 읽어야 했다.

    성공은 토큰이 생긴 때고(admin_sessions), 실패는 기록에 401로 남은
    줄이다(action_logs). 아직 안 지난 토큰은 열려 있는 것으로 보고, 지금
    보고 있는 기기의 것만 제 것으로 표시한다.

    어느 기기인지는 적지 않는다. 담아 본 적이 없다.
    """
    조건 = ["1 = 1"]
    값: dict = {"tok": x_admin_token or ""}
    if frm:
        조건.append("t.at >= CAST(:frm AS date)")
        값["frm"] = frm
    if to:
        조건.append("t.at < CAST(:to AS date) + INTERVAL '1 day'")
        값["to"] = to
    if ok == "1":
        조건.append("t.ok")
    elif ok == "0":
        조건.append("NOT t.ok")

    rows = db.execute(text(f"""
        WITH t AS (
            SELECT s.created_at                 AS at
                 , TRUE                         AS ok
                 , (s.expires_at > now())       AS alive
                 , (s.token = :tok)             AS mine
                 , s.agent                      AS agent
                 , s.ip                         AS ip
                 -- 얼마나 열려 있었나. 열려 있는 줄은 지금까지, 닫힌 줄은
                 -- 닫힌 때까지다. 둘을 한 가지로 적는 까닭은 뜻이 같기
                 -- 때문이다. 「이 자리가 쓸 수 있던 동안」이다.
                 , EXTRACT(EPOCH FROM (LEAST(s.expires_at, now()) - s.created_at)) AS held
              FROM life_expense.admin_sessions s
             UNION ALL
            SELECT a.created_at                 AS at
                 , FALSE                        AS ok
                 , FALSE                        AS alive
                 , FALSE                        AS mine
                 , NULL                         AS agent
                 , NULL                         AS ip
                 , NULL                         AS held
              FROM life_expense.action_logs a
             WHERE a.kind = 'error'
               AND a.name = '/admin/login'
               AND a.status = 401
        )
        SELECT to_char(t.at, 'YYYY-MM-DD')      AS on_day
             -- 초까지 적는다. 같은 분에 두 번 들어오면 분까지로는 두 줄이
             -- 똑같이 보여, 어느 것이 먼저인지 알 길이 없었다.
             , to_char(t.at, 'HH24:MI:SS')      AS at_time
             , t.ok
             , t.alive
             , t.mine
             , t.agent
             , t.ip
             , t.held
          FROM t
         WHERE {' AND '.join(조건)}
      ORDER BY t.at DESC
         LIMIT 200
    """), 값).mappings().all()

    return {
        # 지금 열려 있는 기기 수. 거르기와 상관없이 늘 같은 값이라 따로 센다.
        "live": db.execute(text("""
            SELECT count(*) FROM life_expense.admin_sessions WHERE expires_at > now()
        """)).scalar() or 0,
        "rows": [{
            "on_day": r["on_day"],
            "at_time": r["at_time"],
            "ok": bool(r["ok"]),
            "alive": bool(r["alive"]),
            "mine": bool(r["mine"]),
            "device": _기기이름(r["agent"]) if r["ok"] else "",
            "ip": r["ip"] or "",
            "held": int(r["held"]) if r["held"] is not None else None,
        } for r in rows],
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
