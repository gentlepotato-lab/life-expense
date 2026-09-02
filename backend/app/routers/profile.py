import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import text
from app.deps import SessionDep
from app.xlsx import sheet_bytes

# 자리는 main.py에서 /api/profile로 붙인다
router = APIRouter()

# 담아 두는 앱 설정. 여기 없는 열쇠는 받지 않는다 —
# 화면이 잘못 보내도 표가 지저분해지지 않게 한다.
PREF_KEYS = {
    "blur_default": "0",
    "exclude_default": "1",
    "home_path": "/",
    "nudge_on": "1",
    # 금액을 가리는 마스킹 테이프. 화면이 아는 일곱 가지 가운데 하나다
    # (frontend/src/utils/tapes.ts).
    "tape_style": "flower",
}


@router.get("")
def get_profile(db: SessionDep = Depends()):
    """
    쓰는 사람. 아직 아무것도 적지 않았으면 빈 줄을 돌려준다.

    칸은 바깥 인증이 돌려주는 것에 맞춰 두었다. provider 가 비어 있으면
    사람이 손으로 적어 넣은 것이다.
    """
    row = db.execute(text("""
        SELECT profile_id, display_name, email, avatar_url, provider, provider_id,
               emoji, bio, joined_on
          FROM life_expense.profile
         WHERE profile_id = 1
    """)).mappings().first()
    if not row:
        return {
            "profile_id": 1, "display_name": None, "email": None, "avatar_url": None,
            "provider": None, "provider_id": None, "emoji": None, "bio": None,
            "joined_on": None,
        }
    out = dict(row)
    out["joined_on"] = str(out["joined_on"]) if out["joined_on"] else None
    return out


@router.post("")
def save_profile(payload: dict, db: SessionDep = Depends()):
    """손으로 적는 것만 고친다 — provider·provider_id 는 로그인이 채울 자리다"""
    def cut(key: str, size: int) -> str | None:
        v = (payload.get(key) or "").strip()
        if not v:
            return None
        if len(v) > size:
            raise HTTPException(status_code=400, detail=f"{key}가 너무 깁니다.")
        return v

    try:
        db.execute(text("""
            INSERT INTO life_expense.profile
                        (profile_id, display_name, email, avatar_url, emoji, bio, joined_on)
                 VALUES (1, :name, :email, :avatar, :emoji, :bio, :joined)
            ON CONFLICT (profile_id) DO UPDATE
                    SET display_name = EXCLUDED.display_name
                      , email        = EXCLUDED.email
                      , avatar_url   = EXCLUDED.avatar_url
                      , emoji        = EXCLUDED.emoji
                      , bio          = EXCLUDED.bio
                      , joined_on    = EXCLUDED.joined_on
        """), {
            "name": cut("display_name", 60),
            "email": cut("email", 200),
            "avatar": cut("avatar_url", 500),
            "emoji": cut("emoji", 8),
            "bio": cut("bio", 200),
            "joined": payload.get("joined_on") or None,
        })
        db.commit()
        return {"status": "ok"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/prefs")
def get_prefs(db: SessionDep = Depends()):
    """앱 설정. 담아 둔 것이 없으면 기본값을 돌려준다"""
    rows = db.execute(text("""
        SELECT pref_key, pref_value FROM life_expense.app_prefs
    """)).mappings().all()
    out = dict(PREF_KEYS)
    for r in rows:
        if r["pref_key"] in out:
            out[r["pref_key"]] = r["pref_value"]
    return out


@router.post("/prefs")
def save_prefs(payload: dict, db: SessionDep = Depends()):
    try:
        for key, value in payload.items():
            if key not in PREF_KEYS:
                continue
            db.execute(text("""
                INSERT INTO life_expense.app_prefs (pref_key, pref_value, updated_at)
                     VALUES (:k, :v, now())
                ON CONFLICT (pref_key) DO UPDATE
                        SET pref_value = EXCLUDED.pref_value
                          , updated_at = now()
            """), {"k": key, "v": str(value)[:200]})
        db.commit()
        return {"status": "ok"}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/summary")
def get_summary(db: SessionDep = Depends()):
    """
    함께한 시간과 버릇.

    화면이 세 달치를 받아 세는 대신 여기서 한 번에 센다 — 처음 적은 날부터
    지금까지가 셈의 바탕이라 화면으로 다 내려보낼 것이 아니다.
    실지출은 v_entries_net 을 쓴다. 다른 화면과 같은 잣대여야 한다.
    """
    span = db.execute(text("""
        SELECT MIN(tx_date) AS first_day
             , MAX(tx_date) AS last_day
             , COUNT(*)     AS rows_all
          FROM life_expense.entries
    """)).mappings().first()

    money = db.execute(text("""
        SELECT COUNT(*) AS cnt
             , COALESCE(SUM(COALESCE(vn.net_amount, e.amount)), 0) AS total
          FROM life_expense.entries e
          LEFT JOIN life_expense.v_entries_net vn ON vn.entry_id = e.entry_id
         WHERE e.inout <> 1
    """)).mappings().first()

    # 곳간에 무엇이 얼마나 쌓였는지
    counts = {}
    for name, table in (
        ("pending", "pending_entries"), ("scheduled", "scheduled_entries"),
        ("counterpart", "counterparts"), ("place", "places"),
        ("cat1", "categories_lvl1"), ("cat2", "categories_lvl2"),
        ("cat3", "categories_lvl3"), ("method", "payment_methods"),
    ):
        counts[name] = db.execute(
            text(f"SELECT COUNT(*) FROM life_expense.{table}")
        ).scalar()

    # 버릇은 최근 석 달만 본다. 몇 해치를 통째로 세면 지금 어떻게 쓰는지가
    # 아니라 예전에 어떻게 썼는지가 나온다.
    RECENT = "e.tx_date >= (CURRENT_DATE - INTERVAL '3 months')"

    places = db.execute(text(f"""
        SELECT p.place_name AS name, COUNT(*) AS cnt
          FROM life_expense.entries e
          JOIN life_expense.places p ON p.place_id = e.place_id
         WHERE e.inout <> 1 AND {RECENT}
      GROUP BY p.place_name
      ORDER BY cnt DESC, name ASC
         LIMIT 3
    """)).mappings().all()

    # 자주 간 곳과 많이 쓴 곳은 다르다 — 매일 가는 편의점과 한 번 간 가구점
    big_places = db.execute(text(f"""
        SELECT p.place_name AS name
             , SUM(COALESCE(vn.net_amount, e.amount)) AS total
          FROM life_expense.entries e
          JOIN life_expense.places p ON p.place_id = e.place_id
          LEFT JOIN life_expense.v_entries_net vn ON vn.entry_id = e.entry_id
         WHERE e.inout <> 1 AND {RECENT}
      GROUP BY p.place_name
      ORDER BY total DESC, name ASC
         LIMIT 3
    """)).mappings().all()

    methods = db.execute(text(f"""
        SELECT m.method_name AS name, COUNT(*) AS cnt
          FROM life_expense.entries e
          JOIN life_expense.payment_methods m ON m.method_id = e.pay_method
         WHERE e.inout <> 1 AND {RECENT}
      GROUP BY m.method_name
      ORDER BY cnt DESC, name ASC
         LIMIT 3
    """)).mappings().all()

    big = db.execute(text("""
        SELECT e.tx_date AS day
             , SUM(COALESCE(vn.net_amount, e.amount)) AS total
          FROM life_expense.entries e
          LEFT JOIN life_expense.v_entries_net vn ON vn.entry_id = e.entry_id
         WHERE e.inout <> 1
      GROUP BY e.tx_date
      ORDER BY total DESC
         LIMIT 1
    """)).mappings().first()

    # 가장 길게 이어 적은 날 — 날짜에서 순번을 빼면 이어진 날끼리 같은 값이 된다
    streak = db.execute(text("""
        WITH days AS (
            SELECT DISTINCT tx_date FROM life_expense.entries WHERE inout <> 1
        ), grouped AS (
            SELECT tx_date
                 , tx_date - (ROW_NUMBER() OVER (ORDER BY tx_date))::int AS grp
              FROM days
        )
        SELECT COUNT(*) AS len, MIN(tx_date) AS from_day, MAX(tx_date) AS to_day
          FROM grouped
      GROUP BY grp
      ORDER BY len DESC, to_day DESC
         LIMIT 1
    """)).mappings().first()

    def day(v):
        return str(v) if v else None

    return {
        "first_day": day(span["first_day"]),
        "last_day": day(span["last_day"]),
        "rows_all": span["rows_all"],
        "spend_count": money["cnt"],
        "spend_total": float(money["total"]),
        "counts": counts,
        "top_places": [{"name": r["name"], "count": r["cnt"]} for r in places],
        "big_places": [{"name": r["name"], "total": float(r["total"])} for r in big_places],
        "top_methods": [{"name": r["name"], "count": r["cnt"]} for r in methods],
        "big_day": {"day": day(big["day"]), "total": float(big["total"])} if big else None,
        "streak": {
            "len": streak["len"], "from": day(streak["from_day"]), "to": day(streak["to_day"]),
        } if streak else None,
    }


# 내보낼 표. 적어 둔 차례대로 담는다 — 되살릴 때 가리키는 쪽이 뒤에 오도록.
EXPORT_TABLES = [
    "categories_lvl1", "categories_lvl2", "categories_lvl3",
    "payment_method_categories", "payment_methods",
    "counterpart_categories", "counterparts",
    "places", "holidays",
    "entries", "pending_entries", "scheduled_entries",
    "entry_splits", "pending_entry_splits", "scheduled_entry_splits",
    "card_tiers", "card_benefits", "card_benefit_targets",
    "category_goals", "chart_cards", "app_prefs", "profile",
]


@router.get("/export")
def export_all(db: SessionDep = Depends()):
    """
    적어 온 것을 통째로 파일 하나에 담는다.

    표를 그대로 옮긴다 — 화면이 셈한 값이 아니라 날것이라야 되살릴 수 있다.
    날짜·시각·소수는 글자로 바꾼다. JSON 이 그것들을 모른다.
    """
    from datetime import date, datetime
    from decimal import Decimal

    def plain(v):
        if isinstance(v, (date, datetime)):
            return v.isoformat()
        if isinstance(v, Decimal):
            return float(v)
        return v

    dump = {}
    for table in EXPORT_TABLES:
        rows = db.execute(text(f"SELECT * FROM life_expense.{table}")).mappings().all()
        dump[table] = [{k: plain(v) for k, v in r.items()} for r in rows]

    body = json.dumps(
        {"schema": "life_expense", "exported_at": datetime.now().isoformat(), "tables": dump},
        ensure_ascii=False, indent=1,
    )
    stamp = datetime.now().strftime("%Y%m%d")
    return Response(
        content=body,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="expense-{stamp}.json"'},
    )


# 내려받는 지출 내역의 머리글과 뽑는 말. CSV 와 엑셀이 같은 것을 내려보내야
# 하므로 한자리에 둔다 — 한쪽만 고쳐 둘이 어긋나는 일을 막는다.
ENTRY_HEAD = ["날짜", "중분류", "소분류", "세분류", "결제 수단", "장소", "메모", "결제액", "실지출"]

ENTRY_SQL = """
    SELECT e.tx_date, c1.cat1_name, c2.cat2_name, c3.cat3_name
         , m.method_name, p.place_name, e.memo
         , e.amount, COALESCE(vn.net_amount, e.amount) AS net_amount
      FROM life_expense.entries e
      LEFT JOIN life_expense.categories_lvl1 c1 ON c1.cat1_id = e.cat1_id
      LEFT JOIN life_expense.categories_lvl2 c2 ON c2.cat2_id = e.cat2_id
      LEFT JOIN life_expense.categories_lvl3 c3 ON c3.cat3_id = e.cat3_id
      LEFT JOIN life_expense.payment_methods m ON m.method_id = e.pay_method
      LEFT JOIN life_expense.places p ON p.place_id = e.place_id
      LEFT JOIN life_expense.v_entries_net vn ON vn.entry_id = e.entry_id
     WHERE e.inout <> 1
  ORDER BY e.tx_date DESC, e.entry_id DESC
"""


def entry_rows(db) -> list[list]:
    """머리글 차례대로 한 줄씩. 날짜와 금액은 값 그대로 둔다"""
    rows = db.execute(text(ENTRY_SQL)).mappings().all()
    return [
        [
            r["tx_date"], r["cat1_name"] or "", r["cat2_name"] or "", r["cat3_name"] or "",
            r["method_name"] or "", r["place_name"] or "", r["memo"] or "",
            float(r["amount"]), float(r["net_amount"]),
        ]
        for r in rows
    ]


@router.get("/export/entries.csv")
def export_entries_csv(db: SessionDep = Depends()):
    """지출 내역만 CSV 로. 표 프로그램에서 바로 열어 보려는 자리다"""
    import csv
    import io as _io

    buf = _io.StringIO()
    w = csv.writer(buf)
    w.writerow(ENTRY_HEAD)
    for row in entry_rows(db):
        w.writerow(row)

    from datetime import datetime
    stamp = datetime.now().strftime("%Y%m%d")
    # 엑셀이 한글을 알아보도록 BOM 을 앞에 둔다
    return Response(
        content="﻿" + buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="entries-{stamp}.csv"'},
    )


@router.get("/export/entries.xlsx")
def export_entries_xlsx(db: SessionDep = Depends()):
    """
    지출 내역을 엑셀로.

    CSV 와 같은 것을 담지만 날짜는 날짜로, 금액은 숫자로 들어간다. 받아서
    바로 걸러 보고 더해 보려면 그래야 한다.
    """
    from datetime import datetime

    body = sheet_bytes(
        ENTRY_HEAD,
        entry_rows(db),
        money_cols={7, 8},
        widths=[12, 14, 16, 16, 18, 24, 30, 12, 12],
        sheet_name="지출 내역",
    )
    stamp = datetime.now().strftime("%Y%m%d")
    return Response(
        content=body,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="entries-{stamp}.xlsx"'},
    )
