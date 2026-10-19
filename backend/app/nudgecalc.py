"""
잔소리 셈.

그동안 화면이 하던 일을 여기로 옮겼다. 화면은 요청을 열 번 날려(석 달치 지출,
대기, 정기, 분류 세 단, 결제 수단, 목표) 받아 온 것을 제 나름대로 셈했다.
종 단추가 모든 화면에 서 있어서 화면을 옮길 때마다 그 열 번이 돌았다.

여기서 하는 일은 "무엇이 잔소리감인가"까지다. 문장과 말투는 화면에 남겼다 —
문구는 자주 다듬는데 그때마다 서버를 다시 띄울 까닭이 없다. 그래서 돌려주는
것은 갈래(kind)와 숫자(값)와 근거 줄(items)뿐이고, 화면이 그걸로 문장을 짓는다.

표를 따로 두지 않는다. 쓴 건이 삼천 건 남짓이라 집계가 몇 밀리초에 끝나고,
표를 두면 갱신 사이에 사실과 어긋나는 참이 생긴다. 잔소리 가운데는 "오늘"에
기대는 것이 있어 아무도 아무것도 안 고쳐도 날이 바뀌면 답이 달라지므로,
부를 때 세는 쪽이 맞다.

셈의 잣대는 화면이 쓰던 것을 그대로 옮겼다 — 아래 함수들의 짝은
frontend/src/utils/nudges.ts, goalStand.ts, calendarFilter.ts다. 한쪽만 고치면
화면과 서버가 다른 수를 말하므로, 고칠 일이 생기면 두 곳을 함께 본다.
"""

from __future__ import annotations

from calendar import monthrange
from math import floor
from datetime import date, timedelta
from typing import Any

from sqlalchemy import text

# ── 잣대 ──────────────────────────────────────────────────────

#: 앞뒤로 몇 달치를 보고 셈하는가 — 평균을 내려면 한 달로는 모자란다.
MONTHS = 3

#: 정기 지출은 일주일 앞까지만 미리 알린다.
AHEAD_DAYS = 7

#: 며칠 뒤부터는 한 줄씩 알리지 않고 묶는다.
BUNDLE_FROM = 3

#: 한 줄씩 알리는 것도 셋까지.
NEAR_MAX = 3

#: 이어 온 날을 거슬러 세는 한계 — 받는 것이 석 달치뿐이다.
LOOKBACK = 60

#: 목표를 잘 지킨다는 칭찬은 달 후반에만 한다.
PRAISE_FROM_DAY = 20


def _ymd(d: date) -> str:
    return d.isoformat()


def _날(s: str) -> date:
    return date(int(s[0:4]), int(s[5:7]), int(s[8:10]))


def _반올림(x: float) -> int:
    """화면이 쓰던 Math.round과 같게 올린다.

    파이썬 round()는 2827742.5를 짝수인 2827742로 내린다. 화면은 2827743으로
    올렸다. 옮기면서 1원이 어긋나는 자리가 실제로 나왔다(2026-10-04 식비 도전).
    """
    return floor(x + 0.5)


def _틈(a: str, b: str) -> int:
    """a - b, 날짜 수."""
    return (_날(a) - _날(b)).days


def _옮김(base: str, step: int) -> str:
    return _ymd(_날(base) + timedelta(days=step))


def _달들(today: str) -> list[str]:
    """오늘이 든 달을 끝으로 MONTHS개월."""
    y, m = int(today[0:4]), int(today[5:7])
    out: list[str] = []
    for i in range(MONTHS - 1, -1, -1):
        yy, mm = y, m - i
        while mm <= 0:
            mm += 12
            yy -= 1
        out.append(f"{yy}-{mm:02d}")
    return out


# ── 자료 모으기 ───────────────────────────────────────────────
#
# 화면이 부르던 엔드포인트와 같은 SQL을 쓴다. 엔드포인트를 서버가 제 손으로
# 다시 부르지는 않는다 — 한 요청 안에서 HTTP를 또 타면 느릴뿐더러, 그 사이에
# 자료가 바뀌면 같은 요청 안에서도 앞뒤가 어긋난다.

_지출SQL = text(
    """
    SELECT e.entry_id, e.tx_date, e.amount, e.inout, e.cat1_id, e.cat2_id, e.cat3_id,
           e.pay_method, e.memo, e.fixed_flag, e.perf_exclude,
           p.place_name,
           COALESCE(vn.net_amount, e.amount) AS net_amount
      FROM life_expense.entries e
      LEFT JOIN life_expense.places p       ON p.place_id = e.place_id
      LEFT JOIN life_expense.v_entries_net vn ON vn.entry_id = e.entry_id
     WHERE e.tx_date >= :부터 AND e.tx_date < :까지
    """
)

_대기SQL = text(
    """
    SELECT e.entry_id, e.tx_date, e.amount, e.inout, e.cat1_id, e.cat2_id, e.cat3_id,
           e.pay_method, e.memo, e.fixed_flag, e.perf_exclude, e.sended,
           p.place_name,
           COALESCE(vn.net_amount, e.amount) AS net_amount
      FROM life_expense.pending_entries e
      LEFT JOIN life_expense.places p ON p.place_id = e.place_id
      LEFT JOIN life_expense.v_pending_entries_net vn ON vn.entry_id = e.entry_id
     -- 보낸 것은 지출로 넘어가 행이 따로 남는다. 함께 세면 그 달이 두 번
     -- 세어져 모든 집계가 부푼다 — 화면이 부르던 /pending-entries도 같다.
     WHERE e.sended = 0
    """
)

_정기SQL = text(
    """
    SELECT s.schedule_id, s.next_run_at, s.amount, s.inout, s.cat1_id, s.cat2_id, s.cat3_id,
           s.pay_method, s.memo, s.fixed_flag, s.perf_exclude,
           p.place_name,
           -- 정기도 N빵으로 돌려받는다. 전액을 돌려받으면 실지출이 0이라,
           -- amount만 보면 쓰지도 않은 돈이 집계에 든다.
           COALESCE(vn.net_amount, s.amount) AS net_amount
      FROM life_expense.scheduled_entries s
      LEFT JOIN life_expense.places p ON p.place_id = s.place_id
      LEFT JOIN life_expense.v_scheduled_entries_net vn ON vn.schedule_id = s.schedule_id
     -- 쉬게 한 것은 빼야 한다. 화면이 부르던 /scheduled-entries도 그렇다 —
     -- 감춘 정기가 집계에 끼면 쓰지도 않을 돈을 센다.
     WHERE s.is_active = 1
    """
)

_분류SQL = {
    2: text("SELECT cat2_id AS id, cat2_name AS name, fixed_flag, inout FROM life_expense.categories_lvl2"),
    3: text("SELECT cat3_id AS id, cat3_name AS name, cat2_id, fixed_flag FROM life_expense.categories_lvl3"),
    1: text("SELECT cat1_id AS id, cat1_name AS name FROM life_expense.categories_lvl1"),
}

_카드SQL = text(
    """
    SELECT p.method_id, p.method_name
      FROM life_expense.payment_methods p
      JOIN life_expense.payment_method_categories c ON c.category_id = p.category_id
     WHERE c.name = '카드' AND p.is_active = 1
    """
)

_구간SQL = text(
    """
    SELECT tier_id, method_id, threshold
      FROM life_expense.card_tiers
     WHERE method_id = ANY(:ids)
    """
)

_목표SQL = text(
    """
    SELECT goal_id, cat1_id, cat2_id, cat3_id, amount, start_ym, end_ym
      FROM life_expense.category_goals
     ORDER BY sort_order
    """
)


def _달범위(ym: str) -> tuple[date, date]:
    y, m = int(ym[0:4]), int(ym[5:7])
    부터 = date(y, m, 1)
    까지 = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)
    return 부터, 까지


def _줄(src: str, r: dict, 날칸: str, 열쇠칸: str) -> dict:
    """세 갈래를 한 꼴로 맞춘다 — 화면의 달줄()이 하던 일이다."""
    날 = str(r.get(날칸) or "")[:10]
    return {
        "key": f"{src}-{r[열쇠칸]}",
        "src": src,
        "date": 날,
        "day": int(날[8:10]) if len(날) == 10 else 0,
        "inout": r.get("inout"),
        # net_amount가 0인 건이 있다 — N빵으로 전액을 돌려받으면 실지출이 0이다.
        # or로 떨어뜨리면 0을 빈 값으로 보고 전체 금액을 쓴다(화면의 ??는 0을 그대로 쓴다).
        "net": float(r["net_amount"] if r.get("net_amount") is not None else (r.get("amount") or 0)),
        "amount": float(r.get("amount") or 0),
        "cat1_id": r.get("cat1_id"),
        "cat2_id": r.get("cat2_id"),
        "cat3_id": r.get("cat3_id"),
        "pay_method": r.get("pay_method"),
        "memo": r.get("memo"),
        "place_name": r.get("place_name"),
        "perf_exclude": int(r.get("perf_exclude") or 0),
        "fixed_flag": r.get("fixed_flag"),
    }


def 모으기(db, today: str) -> dict[str, Any]:
    """셈에 쓸 것을 한 번에 읽는다."""
    달들 = _달들(today)
    부터, _ = _달범위(달들[0])
    _, 까지 = _달범위(달들[-1])

    지출 = [dict(r) for r in db.execute(_지출SQL, {"부터": 부터, "까지": 까지}).mappings().all()]
    대기 = [dict(r) for r in db.execute(_대기SQL).mappings().all()]
    정기 = [dict(r) for r in db.execute(_정기SQL).mappings().all()]
    분류1 = [dict(r) for r in db.execute(_분류SQL[1]).mappings().all()]
    분류2 = [dict(r) for r in db.execute(_분류SQL[2]).mappings().all()]
    분류3 = [dict(r) for r in db.execute(_분류SQL[3]).mappings().all()]
    카드 = [dict(r) for r in db.execute(_카드SQL).mappings().all()]
    목표 = [dict(r) for r in db.execute(_목표SQL).mappings().all()]

    구간: dict[int, list[dict]] = {}
    if 카드:
        ids = [c["method_id"] for c in 카드]
        for t in db.execute(_구간SQL, {"ids": ids}).mappings().all():
            구간.setdefault(t["method_id"], []).append(dict(t))

    줄들: list[dict] = []
    for ym in 달들:
        줄들 += [_줄("expense", r, "tx_date", "entry_id") for r in 지출 if str(r["tx_date"])[:7] == ym]
        줄들 += [_줄("pending", r, "tx_date", "entry_id") for r in 대기 if str(r["tx_date"] or "")[:7] == ym]
        줄들 += [
            _줄("scheduled", r, "next_run_at", "schedule_id")
            for r in 정기
            if str(r["next_run_at"] or "")[:7] == ym
        ]

    return {
        "today": today,
        "달들": 달들,
        "줄들": [r for r in 줄들 if r["date"]],
        "대기": 대기,
        "정기": 정기,
        "분류1": 분류1,
        "분류2": 분류2,
        "분류3": 분류3,
        "카드": 카드,
        "구간": 구간,
        "목표": 목표,
    }


# ── 거르기 ────────────────────────────────────────────────────
#
# 화면의 calendarFilter.ts와 같은 잣대다. 건에 손으로 정한 고정 · 변동이 가장
# 앞이고, 없으면 소 · 세 분류를 따른다. 어디에도 없으면 변동이다.


def _고정자리(분류2: list[dict], 분류3: list[dict]) -> tuple[set, set]:
    두 = {c["id"] for c in 분류2 if c.get("fixed_flag") == 1}
    세 = {c["id"] for c in 분류3 if c.get("fixed_flag") == 1}
    return 두, 세


def _고정인가(r: dict, 두: set, 세: set) -> bool:
    if r.get("fixed_flag") is not None:
        return r["fixed_flag"] == 1
    return r.get("cat2_id") in 두 or r.get("cat3_id") in 세


def _든다(r: dict, 고른것: dict, 두: set, 세: set) -> bool:
    고정 = _고정인가(r, 두, 세)
    수입 = r.get("inout") == 1
    if 수입:
        return 고른것["fixIn"] if 고정 else 고른것["varIn"]
    return 고른것["fixOut"] if 고정 else 고른것["varOut"]


def 거르기(모은것: dict, 고른것: dict) -> dict[str, Any]:
    """셈에 쓸 꼴로 추린다 — 화면의 refine()이 하던 일이다."""
    두, 세 = _고정자리(모은것["분류2"], 모은것["분류3"])
    수입분류 = {c["id"] for c in 모은것["분류2"] if c.get("inout") == 1}
    today = 모은것["today"]

    def 지출만(r: dict) -> bool:
        return r.get("inout") != 1 and r.get("cat2_id") not in 수입분류 and _든다(r, 고른것, 두, 세)

    줄들 = [r for r in 모은것["줄들"] if 지출만(r)]

    대기 = []
    for x in 모은것["대기"]:
        if int(x.get("sended") or 0) != 0:
            continue
        날 = str(x.get("tx_date") or "")[:10]
        if not 날:
            continue
        이름 = (x.get("place_name") or "").strip() or (x.get("memo") or "").strip()
        한줄 = {
            "key": f"pending-{x['entry_id']}",
            "date": 날,
            "name": 이름 or "대기 내역",
            "memo": 이름 or None,
            # 위 _줄()과 같은 까닭으로 0을 살린다.
            "amount": float(x["net_amount"] if x.get("net_amount") is not None else (x.get("amount") or 0)),
            "cat1_id": x.get("cat1_id"),
            "cat2_id": x.get("cat2_id"),
            "cat3_id": x.get("cat3_id"),
            "fixed_flag": x.get("fixed_flag"),
        }
        if _든다(한줄, 고른것, 두, 세):
            대기.append(한줄)

    한계 = _옮김(today, AHEAD_DAYS)
    예고 = []
    for x in 모은것["정기"]:
        날 = str(x.get("next_run_at") or "")[:10]
        if not 날 or 날 < today or 날 > 한계:
            continue
        이름 = (x.get("place_name") or "").strip() or (x.get("memo") or "").strip()
        한줄 = {
            "key": f"sched-{x['schedule_id']}",
            "date": 날,
            "name": 이름 or "정기 지출",
            "memo": 이름 or None,
            "amount": float(x.get("amount") or 0),
            "inout": x.get("inout"),
            "cat1_id": x.get("cat1_id"),
            "cat2_id": x.get("cat2_id"),
            "cat3_id": x.get("cat3_id"),
            "fixed_flag": x.get("fixed_flag"),
        }
        if 한줄["inout"] != 1 and 한줄["cat2_id"] not in 수입분류 and _든다(한줄, 고른것, 두, 세):
            예고.append(한줄)

    이름1 = {c["id"]: c["name"] for c in 모은것["분류1"]}
    이름2 = {c["id"]: c["name"] for c in 모은것["분류2"]}
    이름3 = {c["id"]: c["name"] for c in 모은것["분류3"]}

    return {"줄들": 줄들, "대기": 대기, "예고": 예고, "이름1": 이름1, "이름2": 이름2, "이름3": 이름3}


# ── 규칙 ──────────────────────────────────────────────────────
#
# 돌려주는 것은 갈래와 숫자와 근거 줄이다. 문장은 화면이 짓는다.
# 짝이 되는 코드는 frontend/src/utils/nudges.ts의 같은 번호다.


def _낱(r: dict, 이름: dict) -> dict:
    """상세에 펼칠 한 줄."""
    길 = [이름["1"].get(r.get("cat1_id")), 이름["2"].get(r.get("cat2_id")), 이름["3"].get(r.get("cat3_id"))]
    메모 = (r.get("place_name") or "").strip() or (r.get("memo") or "").strip()
    return {
        "key": r["key"],
        "date": r.get("date"),
        "cat": " > ".join([x for x in 길 if x]),
        "memo": 메모 or None,
        "amount": r.get("net", r.get("amount")),
        "cat1_id": r.get("cat1_id"),
        "cat2_id": r.get("cat2_id"),
        "cat3_id": r.get("cat3_id"),
    }


def _달일수(ym: str) -> int:
    return monthrange(int(ym[0:4]), int(ym[5:7]))[1]


def _걸린달(g: dict, ym: str) -> bool:
    if g.get("start_ym") and str(g["start_ym"]) > ym:
        return False
    if g.get("end_ym") and str(g["end_ym"]) < ym:
        return False
    return True


def _목표에드나(g: dict, r: dict) -> bool:
    if r.get("cat1_id") != g["cat1_id"]:
        return False
    if g.get("cat2_id") is not None and r.get("cat2_id") != g["cat2_id"]:
        return False
    if g.get("cat3_id") is not None and r.get("cat3_id") != g["cat3_id"]:
        return False
    return True


def 세기(추린것: dict, 모은것: dict) -> list:
    """잔소리를 센다. 차례는 화면이 쓰던 것과 같다(bad 먼저, watch, good)."""
    today = 모은것["today"]
    줄들 = 추린것["줄들"]
    이번달 = today[0:7]
    지난달 = _옮김(이번달 + "-01", -1)[0:7]
    오늘일 = int(today[8:10])
    이름 = {"1": 추린것["이름1"], "2": 추린것["이름2"], "3": 추린것["이름3"]}

    def 낱(r):
        return _낱(r, 이름)

    out = []

    # ① 곧 빠져나갈 정기 지출
    곧 = sorted(추린것["예고"], key=lambda s: s["date"])
    가까운 = [s for s in 곧 if _틈(s["date"], today) < BUNDLE_FROM]
    나머지 = 가까운[NEAR_MAX:] + [s for s in 곧 if _틈(s["date"], today) >= BUNDLE_FROM]
    for s in 가까운[:NEAR_MAX]:
        out.append(
            {
                "kind": "due",
                "key": "due-" + s["key"],
                "level": "watch",
                "link": "scheduled",
                "값": {"남은날": _틈(s["date"], today), "이름": s["name"], "금액": s["amount"], "날": s["date"]},
                "items": [낱(dict(s, net=s["amount"]))],
            }
        )
    if 나머지:
        out.append(
            {
                "kind": "due-rest",
                "key": "due-rest",
                "level": "watch",
                "link": "scheduled",
                # 꼬리말에 첫날을 적는다. 날이 여럿이면 "부터"를 붙인다 —
                # 어느 쪽으로 적을지는 화면이 여럿날을 보고 가른다.
                "값": {
                    "건수": len(나머지),
                    "합계": sum(s["amount"] for s in 나머지),
                    "첫날": 나머지[0]["date"],
                    "여럿날": any(s["date"] != 나머지[0]["date"] for s in 나머지),
                },
                "items": [낱(dict(s, net=s["amount"])) for s in 나머지],
            }
        )

    # ② 대기 내역이 밀렸다
    if 추린것["대기"]:
        차례 = sorted(추린것["대기"], key=lambda p: p["date"])
        묵은날 = _틈(today, 차례[0]["date"])
        if 묵은날 >= 3:
            out.append(
                {
                    "kind": "pending",
                    "key": "pending",
                    "level": "bad" if 묵은날 >= 7 else "watch",
                    "link": "pending",
                    "값": {"건수": len(차례), "묵은날": 묵은날, "가장오래된날": 차례[0]["date"]},
                    "items": [낱(dict(p, net=p["amount"])) for p in 차례],
                }
            )

    # ③ 지난 달 같은 기간과 견준다
    def 그날까지(ym):
        return [r for r in 줄들 if r["date"].startswith(ym) and int(r["date"][8:10]) <= 오늘일]

    이번줄 = 그날까지(이번달)
    이번 = sum(r["net"] for r in 이번줄)
    지난 = sum(r["net"] for r in 그날까지(지난달))
    if 지난 > 0 and 이번 > 0:
        비율 = _반올림(((이번 - 지난) / 지난) * 1000) / 10
        if 비율 != 0:
            out.append(
                {
                    "kind": "pace",
                    "key": "pace",
                    "level": "bad" if 비율 > 0 else "good",
                    "link": "expense",
                    "값": {
                        "이번": 이번,
                        "지난": 지난,
                        "차이": abs(이번 - 지난),
                        "비율": abs(비율),
                        "늘었나": 비율 > 0,
                        "날": 오늘일,
                    },
                    "items": [낱(r) for r in sorted(이번줄, key=lambda r: r["date"], reverse=True)],
                }
            )

    # ④ 평소보다 큰 한 건
    소분류별 = {}
    for r in 줄들:
        if r.get("cat2_id"):
            소분류별.setdefault(r["cat2_id"], []).append(r)
    큰것 = []
    for r in 줄들:
        뒤 = _틈(today, r["date"])
        if 뒤 < 0 or 뒤 > 7:
            continue
        또래 = 소분류별.get(r.get("cat2_id"))
        if not 또래 or len(또래) < 5:
            continue
        평균 = sum(v["net"] for v in 또래) / len(또래)
        if 평균 <= 0 or r["net"] < 10000:
            continue
        배 = r["net"] / 평균
        if 배 >= 3:
            큰것.append({"줄": r, "배": 배, "평균": 평균, "또래": 또래})
    if 큰것:
        큰것.sort(key=lambda x: x["배"], reverse=True)
        하나 = 큰것[0]
        r = 하나["줄"]
        또래 = [p for p in 하나["또래"] if p["key"] != r["key"]]
        또래.sort(key=lambda p: p["date"], reverse=True)
        out.append(
            {
                "kind": "big",
                "key": "big-" + r["key"],
                "level": "bad",
                "link": "expense",
                "값": {
                    "지난날": _틈(today, r["date"]),
                    "분류": 이름["2"].get(r.get("cat2_id")) or "어딘가",
                    "금액": r["net"],
                    "배": _반올림(하나["배"]),
                    "평균": 하나["평균"],
                },
                "items": [낱(r)] + [낱(p) for p in 또래[:6]],
            }
        )

    # ⑤ 같은 자리를 자주 갔다
    자리 = {}
    for r in 줄들:
        if not r["date"].startswith(이번달):
            continue
        이름값 = (r.get("place_name") or "").strip()
        if 이름값:
            자리.setdefault(이름값, []).append(r)
    if 자리:
        맨위 = max(자리.items(), key=lambda kv: len(kv[1]))
        if len(맨위[1]) >= 8:
            목록 = sorted(맨위[1], key=lambda r: r["date"], reverse=True)
            out.append(
                {
                    "kind": "spot",
                    "key": "spot-" + 맨위[0],
                    "level": "watch",
                    "link": "expense",
                    "값": {"자리": 맨위[0], "횟수": len(맨위[1]), "합계": sum(r["net"] for r in 맨위[1])},
                    "items": [낱(r) for r in 목록],
                }
            )

    # ⑥ 이어 온 날들
    날별 = {}
    for r in 줄들:
        날별.setdefault(r["date"], []).append(r)
    if _옮김(today, -1) in 날별:
        이어 = 0
        while 이어 < LOOKBACK and _옮김(today, -1 - 이어) in 날별:
            이어 += 1
        if 이어 >= 5:
            날들 = [_옮김(today, -1 - i) for i in range(이어)]
            목록 = [r for d in 날들 for r in 날별.get(d, [])]
            out.append(
                {
                    "kind": "streak",
                    "key": "streak",
                    "level": "bad",
                    "link": "expense",
                    "값": {"이어": 이어, "부터": _옮김(today, -이어)},
                    "items": [낱(r) for r in 목록],
                }
            )
    elif 날별:
        쉼 = 0
        while 쉼 < LOOKBACK and _옮김(today, -1 - 쉼) not in 날별:
            쉼 += 1
        if 쉼 < LOOKBACK:
            out.append({"kind": "rest", "key": "rest", "level": "good", "값": {"쉼": 쉼}, "items": []})

    # ⑦ 카드 실적을 채웠다
    for 카드 in 모은것["카드"]:
        코드 = str(카드["method_id"])
        그은돈 = sum(
            r["amount"]
            for r in 줄들
            if r["date"].startswith(이번달) and str(r.get("pay_method")) == 코드 and not r["perf_exclude"]
        )
        if 그은돈 <= 0:
            continue
        구간들 = [t for t in 모은것["구간"].get(카드["method_id"], []) if float(t["threshold"]) > 0]
        채운것 = sorted(
            [t for t in 구간들 if 그은돈 >= float(t["threshold"])],
            key=lambda t: float(t["threshold"]),
            reverse=True,
        )
        if not 채운것:
            continue
        문턱 = float(채운것[0]["threshold"])
        out.append(
            {
                "kind": "perf",
                "key": "perf-card-" + str(카드["method_id"]) + "-" + str(int(문턱)),
                "level": "good",
                "값": {"카드": 카드["method_name"], "문턱": 문턱, "실적": 그은돈},
                "items": [],
            }
        )

    # ⑧ 분류별 목표 — 안쓴이 도전
    for g in 모은것["목표"]:
        if not _걸린달(g, 이번달):
            continue
        내줄 = [r for r in 줄들 if r["date"].startswith(이번달) and _목표에드나(g, r)]
        쓴돈 = sum(r["net"] for r in 내줄)
        목표액 = float(g["amount"])
        속도 = _반올림((쓴돈 / 오늘일) * _달일수(이번달)) if 오늘일 > 0 else 쓴돈
        넘김 = 쓴돈 > 목표액
        길 = " > ".join(
            [
                x
                for x in [
                    이름["1"].get(g["cat1_id"]),
                    이름["2"].get(g.get("cat2_id")),
                    이름["3"].get(g.get("cat3_id")),
                ]
                if x
            ]
        )
        공통 = {
            "key": "goal-" + str(g["goal_id"]),
            "link": "expense",
            "items": [낱(r) for r in sorted(내줄, key=lambda r: r["date"], reverse=True)],
        }
        if 넘김:
            out.append(
                dict(공통, kind="goal-over", level="bad", **{"값": {"길": 길, "목표": 목표액, "넘긴돈": 쓴돈 - 목표액, "쓴돈": 쓴돈}})
            )
        elif 속도 > 목표액:
            out.append(
                dict(공통, kind="goal-will", level="bad", **{"값": {"길": 길, "목표": 목표액, "쓴돈": 쓴돈, "속도": 속도, "날": 오늘일}})
            )
        elif 오늘일 >= PRAISE_FROM_DAY:
            out.append(
                dict(공통, kind="goal-keep", level="good", **{"값": {"길": 길, "목표": 목표액, "쓴돈": 쓴돈, "남은돈": 목표액 - 쓴돈}})
            )

    차례 = {"bad": 0, "watch": 1, "good": 2}
    out.sort(key=lambda n: 차례[n["level"]])
    return out
