"""
묶음 — 따로 든 내역 여럿을 한 덩이로 본다.

쪼개기(N빵)가 한 건 안을 나누는 것이라면, 묶음은 독립된 건 여럿을 하나로
모은다. 여행이나 행사처럼 날이 걸쳐 있고 분류도 제각각인 지출을 한자리에서
보려는 것이다.

갈래(kind)는 어느 화면의 내역을 묶었는지다. 지출과 대기와 정기는 표가 달라
한 묶음이 둘을 섞어 담지 않는다. 담는 쪽은 group_id 한 칸이라 한 건은 한
묶음에만 든다.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text

from app.deps import SessionDep
from app.models import Entry, EntryGroup, PendingEntry, ScheduledEntry
from app.schemas import EntryGroupIn, EntryGroupItems, EntryGroupUpdate

router = APIRouter()

KINDS = ("entry", "pending", "scheduled")

# 갈래마다 담는 표와 열쇠 칸이 다르다. 분기를 여기 한 곳에만 둔다.
MODELS = {
    "entry": (Entry, "entry_id"),
    "pending": (PendingEntry, "entry_id"),
    "scheduled": (ScheduledEntry, "schedule_id"),
}


def _check_kind(kind: str) -> None:
    if kind not in KINDS:
        raise HTTPException(status_code=400, detail=f"kind must be one of {KINDS}")


def _ym_range(ym: str) -> tuple[date, date]:
    """'YYYY-MM'을 그 달의 [처음, 다음 달 처음)으로 바꾼다."""
    try:
        y, m = int(ym[:4]), int(ym[5:7])
        start = date(y, m, 1)
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="ym must be 'YYYY-MM'")
    end = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)
    return start, end


# 담긴 내역 한 줄. 내역 카드가 그리는 데 필요한 것만 고른다.
# 지출과 대기가 표만 다르고 모양은 같아 한 틀에서 찍는다.
_ITEM_SQL = """
    SELECT t.{pk} AS entry_id
         , t.tx_date
         , t.cat1_id
         , t.cat2_id
         , t.cat3_id
         , c3.cat3_name
         , t.inout
         , t.amount
         , t.pay_method
         , t.memo
         , t.place_id
         , pl.place_name
         , t.perf_exclude
         , t.fixed_flag
         , t.group_id
         , COALESCE(vn.split_amount, 0) AS split_amount
         , COALESCE(vn.net_amount, t.amount) AS net_amount
         , COALESCE(vn.split_count, 0) AS split_count
      FROM life_expense.{table} t
      LEFT JOIN life_expense.categories_lvl3 c3 ON t.cat3_id = c3.cat3_id
      LEFT JOIN life_expense.places pl ON t.place_id = pl.place_id
      LEFT JOIN life_expense.{net_view} vn ON vn.entry_id = t.{pk}
     WHERE {where}
  ORDER BY t.tx_date DESC, t.{pk} DESC
"""

_TABLES = {
    "entry": {"table": "entries", "pk": "entry_id", "net_view": "v_entries_net"},
    "pending": {"table": "pending_entries", "pk": "entry_id", "net_view": "v_pending_entries_net"},
}


def _rows_by_group(db, kind: str, group_ids: list[int]) -> dict[int, list[dict]]:
    """묶음에 담긴 내역을 한 번에 읽어 묶음별로 나눈다(묶음마다 조회하지 않는다)."""
    out: dict[int, list[dict]] = {gid: [] for gid in group_ids}
    if not group_ids:
        return out

    if kind == "scheduled":
        rows = (
            db.query(ScheduledEntry)
            .filter(ScheduledEntry.group_id.in_(group_ids))
            .order_by(ScheduledEntry.day_of_month, ScheduledEntry.schedule_id)
            .all()
        )
        names = _place_names(db, {r.place_id for r in rows if r.place_id})
        for r in rows:
            out[r.group_id].append({
                "entry_id": r.schedule_id,
                "schedule_id": r.schedule_id,
                "tx_date": None,
                "day_of_month": r.day_of_month,
                "cat1_id": r.cat1_id,
                "cat2_id": r.cat2_id,
                "cat3_id": r.cat3_id,
                "inout": r.inout,
                "amount": float(r.amount),
                "pay_method": r.pay_method,
                "memo": r.memo,
                "place_id": r.place_id,
                "place_name": names.get(r.place_id),
                "perf_exclude": r.perf_exclude,
                "fixed_flag": r.fixed_flag,
                "group_id": r.group_id,
            })
        return out

    sql = text(_ITEM_SQL.format(where="t.group_id = ANY(:ids)", **_TABLES[kind]))
    for r in db.execute(sql, {"ids": group_ids}).mappings().all():
        row = dict(r)
        row["amount"] = float(row["amount"])
        row["tx_date"] = str(row["tx_date"])
        out[row["group_id"]].append(row)
    return out


def _place_names(db, place_ids: set[int]) -> dict[int, str]:
    if not place_ids:
        return {}
    sql = text("SELECT place_id, place_name FROM life_expense.places WHERE place_id = ANY(:ids)")
    return {r["place_id"]: r["place_name"] for r in db.execute(sql, {"ids": list(place_ids)}).mappings()}


def _in_month(items: list[dict], start: date, end: date) -> bool:
    """그 달에 든 내역이 하나라도 있는가.

    기간이 겹치는지로 보면 9월과 11월에만 든 묶음이 10월에도 보인다.
    담긴 날을 하나씩 본다 — 묶음 하나에 든 건수는 많아야 수십이다.
    """
    lo, hi = str(start), str(end)
    return any(lo <= i["tx_date"] < hi for i in items if i.get("tx_date"))


def _in_span(items: list[dict], 부터: str | None, 까지: str | None) -> bool:
    """그 기간에 든 내역이 하나라도 있는가. 한쪽만 주면 그쪽만 본다."""
    for i in items:
        d = i.get("tx_date")
        if not d:
            continue
        if 부터 and d < 부터:
            continue
        if 까지 and d > 까지:
            continue
        return True
    return False


def _summarize(items: list[dict]) -> dict:
    """묶음 머리말이 쓰는 값. 합계는 화면과 같은 셈이다(수입 − 지출)."""
    net = 0.0
    has_in = False
    has_out = False
    days = [i["tx_date"] for i in items if i.get("tx_date")]
    for i in items:
        amount = float(i["amount"])
        if i["inout"] == 1:
            net += amount
            has_in = True
        else:
            net -= amount
            has_out = True
    return {
        "count": len(items),
        "net": net,
        "has_in": has_in,
        "has_out": has_out,
        "date_from": min(days) if days else None,
        "date_to": max(days) if days else None,
    }


@router.get("")
def list_entry_groups(
    kind: str = Query("entry"),
    ym: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    name: str | None = Query(None),
    memo: str | None = Query(None),
    db: SessionDep = Depends(),
):
    """
    묶음 목록. 담긴 내역까지 함께 준다.

    ym을 주면 그 달의 내역이 든 묶음만 고른다. 날이 걸쳐 있는 여행은 그
    여행에 든 날이 있는 달마다 보인다 — 9월 말에 떠나 10월 초에 돌아왔으면
    두 달 모두에서 보인다.

    date_from과 date_to를 주면 그 기간에 든 내역이 있는 묶음만 고른다.
    기간을 주면 달은 보지 않는다 — 달 단위를 넘어 보려고 거는 것이기 때문이다.
    이름과 메모는 대소문자를 가리지 않고 포함만 본다.

    정기 묶음은 날짜가 없으므로 달과 기간을 가리지 않고 늘 보인다.
    """
    _check_kind(kind)
    기간 = bool(date_from or date_to)

    q = db.query(EntryGroup).filter(EntryGroup.kind == kind)
    if name and name.strip():
        q = q.filter(EntryGroup.name.ilike(f"%{name.strip()}%"))
    if memo and memo.strip():
        q = q.filter(EntryGroup.memo.ilike(f"%{memo.strip()}%"))
    groups = q.order_by(EntryGroup.group_id.desc()).all()
    rows = _rows_by_group(db, kind, [g.group_id for g in groups])

    result = []
    for g in groups:
        items = rows.get(g.group_id, [])
        summary = _summarize(items)
        if 기간 and kind != "scheduled":
            # 기간을 걸면 담긴 날로만 고른다. 아무것도 담기지 않은 묶음은
            # 걸릴 날이 없으므로 빠진다.
            if not _in_span(items, date_from, date_to):
                continue
        elif ym and kind != "scheduled":
            start, end = _ym_range(ym)
            # 빈 묶음은 만든 달에 둔다. 아직 아무것도 담기지 않았을 뿐이라
            # 목록에서 사라지면 다시 찾아갈 길이 없다.
            if not items:
                if not (start <= g.created_at.date() < end):
                    continue
            elif not _in_month(items, start, end):
                continue
        result.append({**g.to_dict(), **summary, "items": items})
    return result


@router.get("/candidates")
def list_candidates(
    kind: str = Query("entry"),
    ym: str | None = Query(None),
    q: str | None = Query(None),
    db: SessionDep = Depends(),
):
    """
    묶을 수 있는 내역. 아직 어느 묶음에도 들지 않은 것만 준다.

    q는 분류, 장소, 결제 수단, 메모를 함께 본다. 화면이 거르지 않고 여기서
    거르는 것은, 달 하나가 수백 건이라 다 내려보내면 팝업이 느려지기 때문이다.
    """
    _check_kind(kind)

    if kind == "scheduled":
        rows = (
            db.query(ScheduledEntry)
            .filter(ScheduledEntry.group_id.is_(None), ScheduledEntry.is_active == 1)
            .order_by(ScheduledEntry.day_of_month, ScheduledEntry.schedule_id)
            .all()
        )
        names = _place_names(db, {r.place_id for r in rows if r.place_id})
        return [{
            "entry_id": r.schedule_id,
            "schedule_id": r.schedule_id,
            "tx_date": None,
            "day_of_month": r.day_of_month,
            "cat1_id": r.cat1_id,
            "cat2_id": r.cat2_id,
            "cat3_id": r.cat3_id,
            "inout": r.inout,
            "amount": float(r.amount),
            "pay_method": r.pay_method,
            "memo": r.memo,
            "place_id": r.place_id,
            "place_name": names.get(r.place_id),
            "perf_exclude": r.perf_exclude,
            "fixed_flag": r.fixed_flag,
            "group_id": None,
        } for r in rows]

    where = ["t.group_id IS NULL"]
    params: dict[str, object] = {}
    if kind == "pending":
        where.append("t.sended = 0")
    if ym:
        start, end = _ym_range(ym)
        where.append("t.tx_date >= :ym_from AND t.tx_date < :ym_to")
        params["ym_from"] = start
        params["ym_to"] = end
    if q and q.strip():
        where.append("""(
            COALESCE(t.memo, '') ILIKE :q
         OR COALESCE(pl.place_name, '') ILIKE :q
         OR COALESCE(c3.cat3_name, '') ILIKE :q
         OR EXISTS (SELECT 1 FROM life_expense.categories_lvl2 c2
                     WHERE c2.cat2_id = t.cat2_id AND c2.cat2_name ILIKE :q)
         OR EXISTS (SELECT 1 FROM life_expense.payment_methods pm
                     WHERE pm.method_id = t.pay_method AND pm.method_name ILIKE :q)
        )""")
        params["q"] = f"%{q.strip()}%"

    sql = text(_ITEM_SQL.format(where=" AND ".join(where), **_TABLES[kind]))
    out = []
    for r in db.execute(sql, params).mappings().all():
        row = dict(r)
        row["amount"] = float(row["amount"])
        row["tx_date"] = str(row["tx_date"])
        out.append(row)
    return out


def _attach(db, kind: str, group_id: int, ids: list[int]) -> int:
    """고른 내역을 묶음에 담는다. 이미 다른 묶음에 든 것은 건너뛴다."""
    if not ids:
        return 0
    model, pk = MODELS[kind]
    rows = db.query(model).filter(getattr(model, pk).in_(ids)).all()
    moved = 0
    for r in rows:
        if r.group_id is not None and r.group_id != group_id:
            continue
        if r.group_id == group_id:
            continue
        r.group_id = group_id
        moved += 1
    return moved


@router.post("")
def create_entry_group(payload: EntryGroupIn, db: SessionDep = Depends()):
    """묶음을 만들고 고른 내역을 담는다."""
    _check_kind(payload.kind)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    try:
        group = EntryGroup(name=name, memo=(payload.memo or "").strip() or None, kind=payload.kind)
        db.add(group)
        # 담을 때 group_id가 필요하므로 커밋 전에 번호만 받는다.
        db.flush()
        moved = _attach(db, payload.kind, group.group_id, payload.ids)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"status": "ok", "group_id": group.group_id, "moved": moved}


@router.patch("/{group_id}")
def update_entry_group(group_id: int, payload: EntryGroupUpdate, db: SessionDep = Depends()):
    """이름과 메모를 고친다."""
    group = db.get(EntryGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="group not found")

    try:
        if payload.name is not None:
            name = payload.name.strip()
            if not name:
                raise HTTPException(status_code=400, detail="name is required")
            group.name = name
        if payload.memo is not None:
            group.memo = payload.memo.strip() or None
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    return {"status": "ok"}


@router.delete("/{group_id}")
def delete_entry_group(group_id: int, db: SessionDep = Depends()):
    """
    묶음 풀기.

    담겨 있던 내역은 지우지 않는다. group_id가 SET NULL이라 저절로 풀린다.
    """
    group = db.get(EntryGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="group not found")
    try:
        db.delete(group)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"status": "ok"}


@router.post("/{group_id}/items")
def add_items(group_id: int, payload: EntryGroupItems, db: SessionDep = Depends()):
    """내역 추가."""
    group = db.get(EntryGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="group not found")
    try:
        moved = _attach(db, group.kind, group_id, payload.ids)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"status": "ok", "moved": moved}


@router.post("/{group_id}/items/remove")
def remove_items(group_id: int, payload: EntryGroupItems, db: SessionDep = Depends()):
    """
    묶음에서 빼기.

    DELETE가 아니라 POST로 받는다. 본문을 실은 DELETE는 중간을 지나며
    버려지는 일이 있어, 지우는 것이 아니라 푸는 일이기도 하니 POST로 둔다.
    """
    group = db.get(EntryGroup, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="group not found")
    if not payload.ids:
        return {"status": "ok", "moved": 0}

    model, pk = MODELS[group.kind]
    try:
        rows = (
            db.query(model)
            .filter(getattr(model, pk).in_(payload.ids), model.group_id == group_id)
            .all()
        )
        for r in rows:
            r.group_id = None
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"status": "ok", "moved": len(rows)}
