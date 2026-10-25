"""화면마다 걸린 조건 그대로 엑셀로 내보낸다.

화면이 보고 있는 것을 그대로 담는 것이 규칙이다. 서버가 따로 계산해 다른 수를
내놓으면 받아 본 사람이 화면과 파일 가운데 무엇을 믿어야 할지 모른다.

꼴은 xlsxout.py가 한 벌로 들고 있다. 여기서는 무엇을 담을지만 정한다.
"""

from __future__ import annotations

import json
import urllib.parse
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile
from sqlalchemy import text

from app import xlsxout as X
from app.deps import SessionDep
from app.xlsxchart import CHART5, ETC, PRIMARY, 가로막대, 묶어, 세로막대
from app.xlsxreceipt import 쪽내기

router = APIRouter()

갈래이름 = {"expense": "지출", "pending": "대기", "scheduled": "정기"}


# ══ 자잘한 것 ═════════════════════════════════════════════

def _목록(raw: str | None, 숫자: bool = True):
    if not raw:
        return []
    try:
        값 = json.loads(raw)
    except Exception:
        return []
    if not isinstance(값, list):
        return []
    return [int(v) for v in 값] if 숫자 else [str(v) for v in 값]


def _파일(이름: str, body: bytes) -> Response:
    """한글 이름은 RFC 5987로 적는다. 그러지 않으면 받는 쪽에서 깨진다."""
    따옴 = urllib.parse.quote(이름)
    return Response(
        content=body,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{따옴}"},
    )


def _여섯자리(d) -> str:
    """260701 꼴. 이름이 길어지는 자리라 연도는 두 자리만 적는다."""
    return str(d)[2:10].replace("-", "")


def _날범위(줄들, *칸들: str) -> tuple[str, str] | None:
    """담긴 줄에서 실제로 걸친 처음과 끝을 뽑는다.

    조건에 적은 기간이 아니라 담긴 것을 본다. 기간을 안 걸고 내려받아도
    파일 이름만 보고 무엇이 들었는지 알 수 있어야 한다.
    """
    날 = []
    for x in 줄들:
        for 칸 in (칸들 or ("tx_date",)):
            v = x.get(칸)
            if v:
                날.append(_여섯자리(v))
    if not 날:
        return None
    return min(날), max(날)


def _이름(갈래: str, 줄들=(), *칸들: str) -> str:
    """돈을쓰다_{화면}_{처음}-{끝}_{받은 시각}.xlsx. 날짜는 모두 두 자리 연도다.

    내려받기 폴더에 쌓였을 때 열어 보지 않고도 가려지게 한다. 이름순으로
    늘어놓으면 화면끼리 묶이고, 그 안에서 기간순, 같은 기간이면 받은 차례다.
    """
    범위 = _날범위(줄들, *칸들)
    가운데 = f"{범위[0]}-{범위[1]}" if 범위 else "내역없음"
    시각 = datetime.now().strftime("%y%m%d%H%M")
    return f"돈을쓰다_{갈래}_{가운데}_{시각}.xlsx"


def _달끝(ym: str) -> tuple[str, str]:
    y, m = int(ym[:4]), int(ym[5:7])
    첫 = date(y, m, 1)
    끝 = date(y + (m == 12), (m % 12) + 1, 1) - timedelta(days=1)
    return 첫.isoformat(), 끝.isoformat()


# ══ 줄 가져오기 ═══════════════════════════════════════════

_뼈대 = """
    SELECT {갈래} AS kind
         , {날짜} AS tx_date
         , e.inout
         , e.amount
         , e.memo
         , c1.cat1_name
         , c2.cat2_name
         , c3.cat3_name
         , pm.method_name
         , p.place_name
         , eg.name AS group_name
         , COALESCE(vs.split_sum, 0) AS split_sum
      FROM life_expense.{표} e
      LEFT JOIN life_expense.categories_lvl1 c1 ON c1.cat1_id = e.cat1_id
      LEFT JOIN life_expense.categories_lvl2 c2 ON c2.cat2_id = e.cat2_id
      LEFT JOIN life_expense.categories_lvl3 c3 ON c3.cat3_id = e.cat3_id
      LEFT JOIN life_expense.payment_methods pm ON pm.method_id = e.pay_method
      LEFT JOIN life_expense.places p ON p.place_id = e.place_id
      LEFT JOIN life_expense.entry_groups eg ON eg.group_id = e.group_id
      LEFT JOIN (SELECT {쪽열쇠} AS 열쇠, SUM(amount) AS split_sum
                   FROM life_expense.{쪽표} GROUP BY {쪽열쇠}) vs
             ON vs.열쇠 = e.{열쇠}
     WHERE 1 = 1
"""

# 테이블 이름, 쪽 테이블 이름, 본 테이블의 열쇠, 쪽 테이블이 가리키는 열쇠, 날짜로 볼 컬럼.
# 정기는 적은 날이 없다. 화면이 다음에 생길 날로 자리를 잡으므로 여기도 같다.
_표정보 = {
    "expense": ("entries", "entry_splits", "entry_id", "entry_id", "e.tx_date"),
    "pending": ("pending_entries", "pending_entry_splits", "entry_id", "pending_id", "e.tx_date"),
    "scheduled": ("scheduled_entries", "scheduled_entry_splits", "schedule_id", "schedule_id",
                  "e.next_run_at::date"),
}


def _날펴기(값: str | None, 끝인가: bool = False) -> str | None:
    """'2026-08'처럼 연월만 온 것을 그 달의 첫날이나 끝날로 편다.

    화면마다 기간을 담는 꼴이 다르다. 어디 쓰나는 연월로, 나머지는 날짜로
    들고 있다. 받는 쪽에서 한 꼴로 맞춰야 화면을 고칠 때마다 여기가
    깨지지 않는다.
    """
    if not 값:
        return None
    값 = str(값).strip()
    if len(값) == 7 and 값[4] == "-":
        첫, 끝 = _달끝(값)
        return 끝 if 끝인가 else 첫
    return 값[:10]


def _거름(조건: dict) -> tuple[str, dict]:
    sql, p = "", {}
    날짜칸 = 조건.get("_날짜칸", "e.tx_date")
    if 조건.get("days"):
        sql += f" AND {날짜칸} = ANY(:days)"
        p["days"] = 조건["days"]
    처음 = _날펴기(조건.get("date_from"))
    끝 = _날펴기(조건.get("date_to"), 끝인가=True)
    if 처음:
        sql += f" AND {날짜칸} >= :date_from"
        p["date_from"] = 처음
    if 끝:
        sql += f" AND {날짜칸} <= :date_to"
        p["date_to"] = 끝
    for 칸, 열 in (("cat1", "cat1_id"), ("cat2", "cat2_id"), ("cat3", "cat3_id")):
        값 = _목록(조건.get(칸))
        if 값:
            sql += f" AND e.{열} = ANY(:{칸}_list)"
            p[f"{칸}_list"] = 값
    pay = _목록(조건.get("pay"), 숫자=False)
    if pay:
        sql += " AND e.pay_method::text = ANY(:pay_list)"
        p["pay_list"] = pay
    if 조건.get("memo"):
        sql += " AND e.memo LIKE :memo"
        p["memo"] = f"%{조건['memo']}%"
    if 조건.get("inout") in (-1, 1):
        sql += " AND e.inout = :inout"
        p["inout"] = 조건["inout"]
    if 조건.get("amount_min") is not None:
        sql += " AND e.amount >= :amount_min"
        p["amount_min"] = 조건["amount_min"]
    if 조건.get("amount_max") is not None:
        sql += " AND e.amount <= :amount_max"
        p["amount_max"] = 조건["amount_max"]
    if 조건.get("place"):
        sql += " AND p.place_name ILIKE :place"
        p["place"] = f"%{조건['place']}%"
    cp = _목록(조건.get("counterpart")) if 조건.get("_상대가능", True) else []
    if cp:
        sql += (" AND EXISTS (SELECT 1 FROM life_expense.entry_splits s"
                " WHERE s.entry_id = e.entry_id AND s.counterpart_id = ANY(:cp_list))")
        p["cp_list"] = cp
    return sql, p


def _줄들(db, 갈래: str, 조건: dict) -> list[dict]:
    표, 쪽표, 열쇠, 쪽열쇠, 날짜 = _표정보[갈래]
    sql = _뼈대.format(갈래=f"'{갈래이름[갈래]}'", 표=표, 쪽표=쪽표, 열쇠=열쇠,
                     쪽열쇠=쪽열쇠, 날짜=날짜)
    꼬리, p = _거름({**조건, "_상대가능": 갈래 == "expense", "_날짜칸": 날짜})
    sql += 꼬리 + f" ORDER BY {날짜}, e.{열쇠}"
    return [dict(r) for r in db.execute(text(sql), p).mappings().all()]


def _정기줄들(db) -> list[dict]:
    sql = """
        SELECT '정기' AS kind
             , s.next_run_at::date AS tx_date
             , s.inout, s.amount, s.memo
             , c1.cat1_name, c2.cat2_name, c3.cat3_name
             , pm.method_name, p.place_name, eg.name AS group_name
             , 0 AS split_sum
             , s.day_of_month, s.interval_months, s.is_active
             , s.anchor_ym, s.end_ym, s.holiday_handling
          FROM life_expense.scheduled_entries s
          LEFT JOIN life_expense.categories_lvl1 c1 ON c1.cat1_id = s.cat1_id
          LEFT JOIN life_expense.categories_lvl2 c2 ON c2.cat2_id = s.cat2_id
          LEFT JOIN life_expense.categories_lvl3 c3 ON c3.cat3_id = s.cat3_id
          LEFT JOIN life_expense.payment_methods pm ON pm.method_id = s.pay_method
          LEFT JOIN life_expense.places p ON p.place_id = s.place_id
          LEFT JOIN life_expense.entry_groups eg ON eg.group_id = s.group_id
         ORDER BY s.is_active DESC, s.next_run_at, s.schedule_id
    """
    return [dict(r) for r in db.execute(text(sql)).mappings().all()]


# ══ 합계 ══════════════════════════════════════════════════

def _합계(줄들: list[dict]) -> dict:
    지출줄 = [x for x in 줄들 if x["inout"] == -1]
    지출 = sum(float(x["amount"]) for x in 지출줄)
    수입 = sum(float(x["amount"]) for x in 줄들 if x["inout"] == 1)
    내몫 = sum(float(x["amount"]) - float(x["split_sum"] or 0) for x in 지출줄)
    날짜 = sorted({str(x["tx_date"])[:10] for x in 줄들 if x["tx_date"]})
    가장큰 = max(지출줄, key=lambda x: float(x["amount"])) if 지출줄 else None
    return {"지출줄": 지출줄, "지출": 지출, "수입": 수입, "내몫": 내몫,
            "날짜": 날짜, "가장큰": 가장큰}


def _요약줄(줄들: list[dict], s: dict) -> list[tuple]:
    날수 = len(s["날짜"])
    지출건 = len(s["지출줄"])
    return [
        ("전체 건수", len(줄들), X.건),
        ("지출 합계", s["지출"], X.MONEY),
        ("수입 합계", s["수입"], X.MONEY),
        ("순액(수입 − 지출)", s["수입"] - s["지출"], X.MONEY),
        ("내 몫 합계(N빵 차감)", s["내몫"], X.MONEY),
        ("기록일 수", 날수, '#,##0"일"'),
        ("일평균(기록일 기준)", round(s["지출"] / 날수) if 날수 else 0, X.MONEY),
        ("건당 평균", round(s["지출"] / 지출건) if 지출건 else 0, X.MONEY),
        ("최고 지출 1건", float(s["가장큰"]["amount"]) if s["가장큰"] else 0, X.MONEY),
    ]


def _분류묶음(db, 줄들: list[dict]) -> dict:
    묶: dict[str, list[dict]] = {}
    쌓: dict[tuple[str, str], list[float]] = {}
    for x in 줄들:
        if x["inout"] != -1:
            continue
        키 = (x["cat1_name"] or "(미지정)", x["cat2_name"] or "(미지정)")
        칸 = 쌓.setdefault(키, [0.0, 0])
        칸[0] += float(x["amount"])
        칸[1] += 1
    for (c1, c2), (amt, n) in 쌓.items():
        묶.setdefault(c1, []).append({"cat2_name": c2, "amt": amt, "n": n})
    for 목록 in 묶.values():
        목록.sort(key=lambda t: -t["amt"])
    return 묶


def _그림들(줄들: list[dict]) -> list[tuple[str, bytes]]:
    지출줄 = [x for x in 줄들 if x["inout"] == -1]
    if not 지출줄:
        return []
    달: dict[str, float] = {}
    요일 = [0.0] * 7
    for x in 지출줄:
        d = x["tx_date"]
        # 멈춘 정기 규칙은 다음에 생길 날이 없다. 계산에서 뺀다.
        if not d:
            continue
        if isinstance(d, str):
            d = datetime.strptime(d[:10], "%Y-%m-%d").date()
        elif isinstance(d, datetime):
            d = d.date()
        달[f"{d.year}-{d.month:02d}"] = 달.get(f"{d.year}-{d.month:02d}", 0.0) + float(x["amount"])
        요일[d.weekday()] += float(x["amount"])

    월자료 = [(f"{int(k[5:7])}월", v) for k, v in sorted(달.items())]
    요일자료 = [(n, v) for n, v in zip("월화수목금토일", 요일)]
    주말색 = lambda i: ETC if i >= 5 else PRIMARY  # noqa: E731
    한색 = lambda i: PRIMARY  # noqa: E731

    낼것 = []
    for 이름, png in [
        ("월별 지출", 세로막대("월별 지출", 월자료, 한색) if len(월자료) > 1 else None),
        ("요일별 지출", 세로막대("요일별 지출", 요일자료, 주말색)),
        ("중분류별 지출", 가로막대("중분류별 지출", 묶어(지출줄, "cat1_name"))),
        ("결제 수단별 지출", 가로막대("결제 수단별 지출", 묶어(지출줄, "method_name"))),
    ]:
        if png:
            낼것.append((이름, png))
    return 낼것


def _도전과잔소리(db, 줄들: list[dict], s: dict) -> tuple[list[dict], list[tuple]]:
    달목록 = sorted({d[:7] for d in s["날짜"]})
    if not 달목록:
        return [], []
    목표들 = db.execute(text("""
        SELECT g.amount, g.memo, g.start_ym, g.end_ym, c1.cat1_name, c2.cat2_name
          FROM life_expense.category_goals g
          LEFT JOIN life_expense.categories_lvl1 c1 ON c1.cat1_id = g.cat1_id
          LEFT JOIN life_expense.categories_lvl2 c2 ON c2.cat2_id = g.cat2_id
         ORDER BY g.sort_order
    """)).mappings().all()

    달분류: dict[tuple[str, str], float] = {}
    달계: dict[str, float] = {}
    for x in s["지출줄"]:
        if not x["tx_date"]:
            continue
        ym = str(x["tx_date"])[:7]
        달분류[(ym, x["cat1_name"])] = 달분류.get((ym, x["cat1_name"]), 0.0) + float(x["amount"])
        달계[ym] = 달계.get(ym, 0.0) + float(x["amount"])

    도전, 말 = [], []
    for g in 목표들:
        for ym in 달목록:
            if g["start_ym"] and ym < g["start_ym"]:
                continue
            if g["end_ym"] and ym > g["end_ym"]:
                continue
            목표 = float(g["amount"])
            실제 = 달분류.get((ym, g["cat1_name"]), 0.0)
            도전.append({"ym": ym, "cat1_name": g["cat1_name"], "cat2_name": g["cat2_name"],
                         "목표": 목표, "실제": 실제, "memo": g["memo"]})
            이름 = g["cat1_name"] or "분류"
            근거 = f"목표 {X.원(목표)}, 지출 {X.원(실제)}"
            if 실제 > 목표:
                말.append((":-(", f"{X.달글(ym)} {이름}{X.조사(이름, '을', '를')} "
                                  f"{X.원(실제 - 목표)} 넘겼습니다.", 근거))
            elif 목표:
                말.append((";-)", f"{X.달글(ym)} {이름}{X.조사(이름, '은', '는')} "
                                  f"{X.원(목표 - 실제)} 남기고 지켰습니다.", 근거))

    키들 = sorted(달계)
    for a, b in zip(키들, 키들[1:]):
        차 = 달계[b] - 달계[a]
        if 차:
            말.append((":-(" if 차 > 0 else ";-)",
                       f"{X.달글(b)}은 지난달보다 {X.원(abs(차))} {'더' if 차 > 0 else '덜'} 썼습니다.",
                       f"{X.달글(a)} {X.원(달계[a])} → {X.달글(b)} {X.원(달계[b])}"))
    if s["가장큰"]:
        x = s["가장큰"]
        말.append((":-(", f"가장 큰 한 건은 {x['cat1_name']} {X.원(float(x['amount']))}입니다.",
                   f"{str(x['tx_date'])[:10]}, {x['place_name'] or x['memo'] or '메모 없음'}"))
    if len(s["날짜"]) >= 2:
        처음 = datetime.strptime(s["날짜"][0], "%Y-%m-%d").date()
        끝 = datetime.strptime(s["날짜"][-1], "%Y-%m-%d").date()
        빈날 = (끝 - 처음).days + 1 - len(s["날짜"])
        if 빈날 > 0:
            말.append((";-)", f"조회 기간 가운데 {빈날}일은 한 푼도 쓰지 않았습니다.",
                       f"기록 {len(s['날짜'])}일, 전체 {빈날 + len(s['날짜'])}일"))
    return 도전, 말


def _한벌(db, 제목: str, 기간: str, 조건: list[tuple[str, str]], 줄들: list[dict],
        안내: str, 뒷장=None, 견줌: bool = True,
        요약덧: list | None = None, 영수증: bytes | None = None) -> bytes:
    """내역이 있는 화면은 모두 이 한 벌을 쓴다.

    장을 빼지 않고 차례도 바꾸지 않는다. 어느 화면에서 받아도 ②는 내역이고
    ③은 분류별 집계다. 그래야 두 파일을 나란히 놓고 볼 수 있다.
    화면마다 더 담을 것(묶음별과 가게별)은 맨 뒤에 붙인다.

    딱 하나, 아직 생기지 않은 것을 담은 파일(정기 내역)만 목표와 견주지
    않는다. 쓰지도 않은 돈을 "넘겼습니다"라고 적게 된다.
    """
    s = _합계(줄들)
    wb = X.묶음만들기()
    X.요약장(wb, 제목, 기간, 조건, _요약줄(줄들, s) + (요약덧 or []))
    X.내역장(wb, 안내, 줄들)
    X.분류장(wb, _분류묶음(db, 줄들), s["지출"])
    X.그림장(wb, _그림들(줄들))
    끝번호 = "⑤"
    if 견줌:
        도전, 말 = _도전과잔소리(db, 줄들, s)
        X.도전장(wb, 도전)
        X.잔소리장(wb, 말)
        끝번호 = "⑦"
    쪽들 = 쪽내기(영수증)
    if 쪽들:
        X.영수증장(wb, 쪽들, 번호=끝번호)
        끝번호 = "⑧" if 끝번호 == "⑦" else "⑥"
    if 뒷장:
        뒷장(wb, 끝번호)
    return X.마무리(wb)


def _조건글(q: dict, 기간: str) -> list[tuple[str, str]]:
    def 몇(raw, 이름):
        값 = _목록(raw) or _목록(raw, 숫자=False)
        return f"{len(값)}개 선택" if 값 else "전체"

    금액 = "전체"
    if q.get("amount_min") is not None or q.get("amount_max") is not None:
        금액 = f"{q.get('amount_min') or 0:,.0f} ~ {q.get('amount_max') or 0:,.0f}"
    return [
        ("기간", 기간 or "전체"),
        ("중분류", 몇(q.get("cat1"), "중분류")),
        ("소분류", 몇(q.get("cat2"), "소분류")),
        ("세분류", 몇(q.get("cat3"), "세분류")),
        ("IN/OUT", {1: "IN(+)", -1: "OUT(−)"}.get(q.get("inout"), "전체")),
        ("결제 수단", 몇(q.get("pay"), "결제 수단")),
        ("금액", 금액),
        ("장소", q.get("place") or "전체"),
        ("메모", q.get("memo") or "전체"),
        ("함께한 상대", 몇(q.get("counterpart"), "상대")),
        ("내려받은 날", X.날요일글(date.today())),
    ]


def _기간글(date_from: str | None, date_to: str | None, ym: str | None = None) -> str:
    if ym and not (date_from or date_to):
        date_from, date_to = _달끝(ym)
    date_from, date_to = _날펴기(date_from), _날펴기(date_to, 끝인가=True)
    if date_from and date_to:
        return f"{X.날글(date_from)} ~ {X.날글(date_to)}"
    if date_from:
        return f"{X.날글(date_from)} 부터"
    if date_to:
        return f"{X.날글(date_to)} 까지"
    return "전체 기간"


# ══ 길 ════════════════════════════════════════════════════

def _걸린것(**kw) -> dict:
    return {k: v for k, v in kw.items()}


def _영수증줄(줄들: list[dict]) -> list[dict]:
    """영수증이 받는 꼴로 옮긴다(frontend/src/utils/receipt.ts의 ReceiptRow).

    화면이 제 손으로 다시 만들지 않게 서버가 내준다. 내보낸 줄과 영수증에
    찍힌 줄이 어긋날 길이 없어진다.
    """
    냄 = []
    for i, x in enumerate(줄들):
        if not x.get("tx_date"):
            continue
        cat = " › ".join(v for v in (x.get("cat1_name"), x.get("cat2_name"),
                                     x.get("cat3_name")) if v)
        냄.append({
            "key": f"{x.get('kind')}-{i}",
            "src": x.get("kind") or "지출",
            "date": str(x["tx_date"])[:10],
            "cat": cat or "-",
            "amount": float(x["amount"]) - float(x.get("split_sum") or 0),
            "inout": x.get("inout"),
            "place": (x.get("place_name") or "").strip(),
            "pay": x.get("method_name") or "",
        })
    return 냄


def _종이(receipt: UploadFile | None) -> bytes | None:
    """올라온 영수증 그림. 없거나 읽히지 않으면 없는 것으로 본다."""
    if receipt is None:
        return None
    try:
        return receipt.file.read()
    except Exception:
        return None


@router.api_route("/entries", methods=["GET", "POST"])
def 지출내역(
    rows: int = Query(0),
    receipt: UploadFile | None = File(None),
    ym: str | None = Query(None),
    date_from: str | None = Query(None), date_to: str | None = Query(None),
    cat1: str | None = Query(None), cat2: str | None = Query(None), cat3: str | None = Query(None),
    pay: str | None = Query(None), memo: str | None = Query(None),
    inout: int | None = Query(None),
    amount_min: float | None = Query(None), amount_max: float | None = Query(None),
    place: str | None = Query(None), counterpart: str | None = Query(None),
    db: SessionDep = Depends(),
):
    if ym and not (date_from or date_to):
        date_from, date_to = _달끝(ym)
    q = _걸린것(date_from=date_from, date_to=date_to, cat1=cat1, cat2=cat2, cat3=cat3,
             pay=pay, memo=memo, inout=inout, amount_min=amount_min,
             amount_max=amount_max, place=place, counterpart=counterpart)
    기간 = _기간글(date_from, date_to)
    줄들 = _줄들(db, "expense", q)
    if rows:
        return _영수증줄(줄들)
    body = _한벌(db, "지출 내역", 기간, _조건글(q, 기간), 줄들,
               "필터를 걸면 아래 [필터 합계]가 함께 바뀝니다. "
               "금액은 적은 그대로 들어온 것이 +, 나간 것이 −입니다. "
               "[필터 합계]는 그 둘을 더한 순액입니다.",
               영수증=_종이(receipt))
    return _파일(_이름("지출내역", 줄들), body)


@router.api_route("/pending", methods=["GET", "POST"])
def 대기내역(rows: int = Query(0), receipt: UploadFile | None = File(None),
         db: SessionDep = Depends()):
    줄들 = _줄들(db, "pending", {})
    if rows:
        return _영수증줄(줄들)
    기간 = _기간글(None, None)
    빈칸 = sum(1 for x in 줄들 if not x["cat1_name"] or not x["method_name"])
    조건 = [("기간", "전체"), ("상태", "보내기 전"), ("내려받은 날", X.날요일글(date.today()))]
    body = _한벌(db, "대기 내역", 기간, 조건, 줄들,
               "확정 전에 검수하는 내역입니다. 분류나 결제 수단이 빈 줄이 손볼 줄입니다.",
               요약덧=[("손볼 줄", 빈칸, X.건)], 영수증=_종이(receipt))
    return _파일(_이름("대기내역", 줄들), body)


@router.get("/scheduled")
def 정기내역(db: SessionDep = Depends()):
    줄들 = _정기줄들(db)
    wb = X.묶음만들기()
    달환산 = 0.0
    for x in 줄들:
        if not x["is_active"] or x["inout"] != -1:
            continue
        달수 = int(x["interval_months"] or 1) or 1
        달환산 += float(x["amount"]) / 달수
    사는것 = sum(1 for x in 줄들 if x["is_active"])
    요약 = [
        ("규칙 수", len(줄들), X.건),
        ("살아 있는 규칙", 사는것, X.건),
        ("달로 환산한 지출", round(달환산), X.MONEY),
        ("한 해로 환산한 지출", round(달환산 * 12), X.MONEY),
    ]

    def 덧(x):
        달수 = int(x["interval_months"] or 1) or 1
        return ["매월" if 달수 == 1 else f"{달수}달마다",
                "사용" if x["is_active"] else "멈춤",
                x["holiday_handling"]]

    X.요약장(wb, "정기 내역", _기간글(None, None),
           [("기간", "되풀이 규칙"),
            ("담지 않은 장", "안쓴이 도전과 잔소리. 아직 생기지 않은 돈이라 목표와 견주지 않습니다"),
            ("내려받은 날", X.날요일글(date.today()))],
           요약 + _요약줄(줄들, _합계(줄들)))
    X.내역장(wb,
            "되풀이 규칙입니다. 날짜는 이 규칙이 다음에 만들 날입니다. "
            "앞의 칸은 다른 화면에서 내보낸 것과 같습니다.",
            줄들, 덧머리=["주기", "상태", "휴일 처리"], 덧폭=[12, 8, 12], 덧값=덧)
    합계 = _합계(줄들)
    X.분류장(wb, _분류묶음(db, 줄들), 합계["지출"])
    X.그림장(wb, _그림들(줄들))
    # 안쓴이 도전과 잔소리는 담지 않는다. 아직 생기지도 않은 돈을 목표와
    # 견주면 "넘겼습니다"라고 적게 된다. ①의 안내에 그 까닭을 적는다.
    return _파일(_이름("정기내역", 줄들), X.마무리(wb))


def _달줄들(db, ym: str, q: dict, 쓸것: list[str]) -> tuple[list[dict], dict]:
    date_from, date_to = _달끝(ym)
    q = {**q, "date_from": date_from, "date_to": date_to}
    줄들: list[dict] = []
    for 갈래 in 쓸것:
        줄들 += _줄들(db, 갈래, q)
    줄들.sort(key=lambda x: (str(x["tx_date"]), x["kind"]))
    return 줄들, q


def _달한벌(db, 제목: str, ym: str, q: dict, 쓸것: list[str],
          영수증: bytes | None = None) -> tuple[bytes, list[dict]]:
    """달력과 씀씀이는 지출, 대기, 정기를 함께 본다. 구분 칸으로 가린다."""
    줄들, q = _달줄들(db, ym, q, 쓸것)
    date_from, date_to = q["date_from"], q["date_to"]
    기간 = _기간글(date_from, date_to)
    조건 = _조건글(q, 기간)
    조건.insert(1, ("담은 갈래", ", ".join(갈래이름[k] for k in 쓸것)))
    body = _한벌(db, 제목, 기간, 조건, 줄들,
               "지출, 대기, 정기가 한 장에 있습니다. 첫 칸이 그 구분입니다. "
               "정기의 날짜는 다음에 생길 날입니다.", 영수증=영수증)
    return body, 줄들


@router.api_route("/calendar", methods=["GET", "POST"])
def 달력(
    rows: int = Query(0),
    receipt: UploadFile | None = File(None),
    ym: str = Query(...), sources: str | None = Query(None),
    cat1: str | None = Query(None), cat2: str | None = Query(None), cat3: str | None = Query(None),
    pay: str | None = Query(None), memo: str | None = Query(None),
    inout: int | None = Query(None),
    amount_min: float | None = Query(None), amount_max: float | None = Query(None),
    place: str | None = Query(None), counterpart: str | None = Query(None),
    db: SessionDep = Depends(),
):
    쓸것 = [s for s in (sources or "expense,pending,scheduled").split(",") if s in _표정보]
    q = _걸린것(cat1=cat1, cat2=cat2, cat3=cat3, pay=pay, memo=memo, inout=inout,
             amount_min=amount_min, amount_max=amount_max, place=place, counterpart=counterpart)
    if rows:
        return _영수증줄(_달줄들(db, ym, q, 쓸것)[0])
    body, 줄들 = _달한벌(db, "달력", ym, q, 쓸것, _종이(receipt))
    return _파일(_이름("달력", 줄들), body)


@router.api_route("/charts", methods=["GET", "POST"])
def 씀씀이(
    rows: int = Query(0),
    receipt: UploadFile | None = File(None),
    ym: str = Query(...), sources: str | None = Query(None),
    cat1: str | None = Query(None), cat2: str | None = Query(None), cat3: str | None = Query(None),
    pay: str | None = Query(None), memo: str | None = Query(None),
    inout: int | None = Query(None),
    amount_min: float | None = Query(None), amount_max: float | None = Query(None),
    place: str | None = Query(None), counterpart: str | None = Query(None),
    db: SessionDep = Depends(),
):
    쓸것 = [s for s in (sources or "expense,pending,scheduled").split(",") if s in _표정보]
    q = _걸린것(cat1=cat1, cat2=cat2, cat3=cat3, pay=pay, memo=memo, inout=inout,
             amount_min=amount_min, amount_max=amount_max, place=place, counterpart=counterpart)
    if rows:
        return _영수증줄(_달줄들(db, ym, q, 쓸것)[0])
    body, 줄들 = _달한벌(db, "씀씀이", ym, q, 쓸것, _종이(receipt))
    return _파일(_이름("씀씀이", 줄들), body)


@router.api_route("/groups", methods=["GET", "POST"])
def 묶음내역(ym: str | None = Query(None), kind: str | None = Query(None), rows: int = Query(0),
         receipt: UploadFile | None = File(None), db: SessionDep = Depends()):
    date_from, date_to = _달끝(ym) if ym else (None, None)
    q = _걸린것(date_from=date_from, date_to=date_to)
    줄들: list[dict] = []
    for 갈래 in _표정보:
        줄들 += [x for x in _줄들(db, 갈래, q) if x["group_name"]]
    줄들.sort(key=lambda x: (x["group_name"], str(x["tx_date"])))
    if rows:
        return _영수증줄(줄들)
    기간 = _기간글(date_from, date_to)

    묶: dict[str, list[dict]] = {}
    for x in 줄들:
        묶.setdefault(x["group_name"], []).append(x)

    묶별 = sorted(묶.items(), key=lambda kv: -sum(float(x["amount"]) for x in kv[1]))

    def 묶음별장(wb, 번호):
        g = X.장(wb, f"{번호} 묶음별", [26, 12, 14, 14, 14])
        g.머리("묶음별", "묶음 하나가 한 줄입니다. 낱낱은 다음 장에 있습니다.")
        g.머리줄(["묶음", "건수", "합계", "내 몫", "건당 평균"])
        for j, (이름, 안) in enumerate(묶별):
            합 = sum(float(x["amount"]) for x in 안)
            몫 = sum(float(x["amount"]) - float(x["split_sum"] or 0) for x in 안)
            g.줄([이름, len(안), 합, 몫, round(합 / len(안))],
                꼴={1: "#,##0", 2: X.MONEY, 3: X.MONEY, 4: X.MONEY},
                맞춤={1: X.오른, 2: X.오른, 3: X.오른, 4: X.오른}, 무늬=(j % 2 == 1))
        if not 묶별:
            g.비었다("묶음이 없습니다.")
        g.거르개()
        g.못박기()

    body = _한벌(db, "묶음 내역", 기간,
               [("기간", 기간), ("묶음 수", f"{len(묶)}개"),
                ("내려받은 날", X.날요일글(date.today()))],
               줄들, "묶음에 든 내역만 담습니다. 첫 칸이 지출, 대기, 정기 구분입니다.",
               뒷장=묶음별장, 요약덧=[("묶음 수", len(묶), '#,##0"개"')],
               영수증=_종이(receipt))
    return _파일(_이름("묶음내역", 줄들), body)


@router.api_route("/places", methods=["GET", "POST"])
def 어디쓰나(date_from: str | None = Query(None), date_to: str | None = Query(None),
         rows: int = Query(0), receipt: UploadFile | None = File(None),
         db: SessionDep = Depends()):
    q = _걸린것(date_from=date_from, date_to=date_to)
    꼬리, p = _거름(q)
    sql = f"""
        SELECT p.place_name, p.city, p.district, p.category_group_name AS kind
             , SUM(e.amount) AS amt, COUNT(*) AS n
             , MIN(e.tx_date) AS 처음, MAX(e.tx_date) AS 마지막
          FROM life_expense.entries e
          JOIN life_expense.places p ON p.place_id = e.place_id
         WHERE e.inout = -1 {꼬리}
         GROUP BY p.place_id, p.place_name, p.city, p.district, p.category_group_name
         ORDER BY SUM(e.amount) DESC
    """
    가게 = [dict(r) for r in db.execute(text(sql), p).mappings().all()]
    총 = sum(float(x["amt"]) for x in 가게)

    # 낱낱의 줄도 함께 담는다. 가게별만 있으면 다른 파일과 꼴이 어긋난다.
    줄들 = [x for x in _줄들(db, "expense", q) if x["place_name"]]
    if rows:
        return _영수증줄(줄들)
    기간 = _기간글(date_from, date_to)

    def 가게별장(wb, 번호):
        g = X.장(wb, f"{번호} 가게별", [28, 18, 14, 14, 10, 14, 12, 12])
        g.머리("가게별", "지출만 셉니다. 한 가게가 한 줄이고 낱낱은 ② 내역에 있습니다.")
        g.머리줄(["가게", "지역", "갈래", "합계", "횟수", "건당 평균", "처음", "마지막"])
        for j, x in enumerate(가게):
            지역 = " ".join(v for v in (x["city"], x["district"]) if v)
            n = int(x["n"])
            g.줄([x["place_name"], 지역, x["kind"], float(x["amt"]), n,
                 round(float(x["amt"]) / n), x["처음"], x["마지막"]],
                꼴={3: X.MONEY, 4: "#,##0", 5: X.MONEY, 6: X.DAYFMT, 7: X.DAYFMT},
                맞춤={2: X.가운데, 3: X.오른, 4: X.오른, 5: X.오른, 6: X.가운데, 7: X.가운데},
                무늬=(j % 2 == 1))
        if not 가게:
            g.비었다("조회 기간에 쓴 가게가 없습니다.")
        g.거르개()
        g.못박기()

    body = _한벌(db, "어디 쓰나", 기간,
               [("기간", 기간), ("내려받은 날", X.날요일글(date.today()))],
               줄들, "장소가 붙은 지출만 담습니다. 가게별로 묶은 것은 맨 뒤 장에 있습니다.",
               뒷장=가게별장,
               요약덧=[("가게 수", len(가게), '#,##0"곳"'),
                     ("가게당 평균", round(총 / len(가게)) if 가게 else 0, X.MONEY),
                     ("가장 많이 쓴 가게", float(가게[0]["amt"]) if 가게 else 0, X.MONEY)],
               영수증=_종이(receipt))
    return _파일(_이름("어디쓰나", 줄들), body)



@router.api_route("/detail", methods=["GET", "POST"])
def 상세(
    rows: int = Query(0),
    receipt: UploadFile | None = File(None),
    page: str = Query("calendar"),
    days: str | None = Query(None), date_from: str | None = Query(None),
    date_to: str | None = Query(None), sources: str | None = Query(None),
    cat1: str | None = Query(None), cat2: str | None = Query(None), cat3: str | None = Query(None),
    pay: str | None = Query(None), memo: str | None = Query(None),
    inout: int | None = Query(None),
    amount_min: float | None = Query(None), amount_max: float | None = Query(None),
    place: str | None = Query(None), counterpart: str | None = Query(None),
    db: SessionDep = Depends(),
):
    """달력 상세와 씀씀이 상세가 함께 쓴다. 한 화면이 두 주소를 섬긴다.

    선택한 날을 그대로 받는다. 달력에서 며칠만 집어 들어온 자리라 기간으로
    펴면 안 선택한 날까지 섞인다.

    이름은 들어온 쪽 화면을 그대로 쓴다. 상세는 그 화면을 좁혀 본 것이지
    딴 화면이 아니다. 아무 말이나 받지 않고 아래 둘만 본다.
    """
    화면 = "씀씀이" if page == "charts" else "달력"
    날목록 = [d for d in (days or "").split(",") if d]
    쓸것 = [s for s in (sources or "expense,pending,scheduled").split(",") if s in _표정보]
    q = _걸린것(days=날목록 or None, date_from=None if 날목록 else date_from,
             date_to=None if 날목록 else date_to,
             cat1=cat1, cat2=cat2, cat3=cat3, pay=pay, memo=memo, inout=inout,
             amount_min=amount_min, amount_max=amount_max, place=place, counterpart=counterpart)
    줄들: list[dict] = []
    for 갈래 in 쓸것:
        줄들 += _줄들(db, 갈래, q)
    줄들.sort(key=lambda x: (str(x["tx_date"]), x["kind"]))
    if rows:
        return _영수증줄(줄들)

    if 날목록:
        기간 = (f"{X.날글(min(날목록))} ~ {X.날글(max(날목록))}"
              if len(날목록) > 1 else X.날글(날목록[0]))
        if len(날목록) > 1:
            기간 += f" 가운데 {len(날목록)}일"
    else:
        기간 = _기간글(date_from, date_to)
    조건 = _조건글(q, 기간)
    조건.insert(1, ("담은 갈래", ", ".join(갈래이름[k] for k in 쓸것)))
    if 날목록 and len(날목록) > 1:
        조건.insert(1, ("선택한 날", f"{len(날목록)}일"))
    body = _한벌(db, 화면, 기간, 조건, 줄들,
               "지출, 대기, 정기가 한 장에 있습니다. 첫 칸이 그 구분입니다. "
               "정기의 날짜는 다음에 생길 날입니다.", 영수증=_종이(receipt))
    return _파일(_이름(화면.replace(" ", ""), 줄들), body)
