"""
금액 쪼개기 — 지출 한 건에서 돌려받은 몫을 관리한다.

설계 요지
  · 원본 금액(amount)은 결제 총액 그대로 둔다. 여기서는 건드리지 않는다.
  · 실지출 = amount - SUM(splits) 이며, 정의는 v_*_net 뷰에 있다.
  · 분할은 자기 자신을 쪼갤 수 없으므로 깊이는 항상 1 이다.

내역은 scheduled → pending → entries 로 흘러가고 각 단계에 같은 모양의
분할 표가 있다. 세 단계가 다른 점은 "어느 표의 어느 컬럼을 보느냐" 뿐이라
라우터를 하나의 공장 함수로 찍어 낸다.
"""
from fastapi import APIRouter, Depends, HTTPException
from decimal import Decimal

from app.deps import SessionDep
from app.models import (
    Entry,
    EntrySplit,
    PendingEntry,
    PendingEntrySplit,
    ScheduledEntry,
    ScheduledEntrySplit,
    Counterpart,
)


def _load_names(db, splits) -> dict:
    ids = {s.counterpart_id for s in splits if s.counterpart_id}
    if not ids:
        return {}
    rows = db.query(Counterpart).filter(Counterpart.counterpart_id.in_(ids)).all()
    return {c.counterpart_id: c.name for c in rows}


def _row(s, names: dict) -> dict:
    return {
        "split_id": s.split_id,
        "amount": float(s.amount),
        "split_type": s.split_type,
        "counterpart_id": s.counterpart_id,
        "counterpart_name": names.get(s.counterpart_id),
        "memo": s.memo,
    }


def _clean(payload: list[dict]) -> tuple[list[dict], Decimal]:
    """입력을 검증해 저장할 형태로 바꾸고 합계를 함께 돌려준다."""
    cleaned: list[dict] = []
    total = Decimal("0")

    for item in payload:
        raw = item.get("amount")
        if raw is None or str(raw).strip() == "":
            raise HTTPException(status_code=400, detail="분할 금액을 입력하세요.")
        try:
            amount = Decimal(str(raw))
        except Exception:
            raise HTTPException(status_code=400, detail="분할 금액이 숫자가 아닙니다.")
        if amount <= 0:
            raise HTTPException(status_code=400, detail="분할 금액은 0보다 커야 합니다.")

        total += amount
        cleaned.append({
            "amount": amount,
            "split_type": item.get("split_type") or "reimbursed",
            "counterpart_id": item.get("counterpart_id"),
            "memo": (item.get("memo") or None),
        })

    return cleaned, total


def make_split_router(owner_model, owner_pk, split_model, split_fk):
    """
    한 단계(entries / pending_entries / scheduled_entries)의 분할 라우터를 만든다.

    owner_model / owner_pk : 원본 표와 그 기본키 컬럼명
    split_model / split_fk : 분할 표와 원본을 가리키는 컬럼명
    """
    router = APIRouter()
    owner_id_col = getattr(owner_model, owner_pk)
    split_fk_col = getattr(split_model, split_fk)

    def _fetch(db, owner_id: int):
        return (
            db.query(split_model)
            .filter(split_fk_col == owner_id)
            .order_by(split_model.split_id)
            .all()
        )

    @router.get("/{owner_id}/splits")
    def list_splits(owner_id: int, db: SessionDep = Depends()):
        """한 내역의 분할 목록"""
        splits = _fetch(db, owner_id)
        return [_row(s, _load_names(db, splits)) for s in splits]

    @router.put("/{owner_id}/splits")
    def replace_splits(owner_id: int, payload: list[dict], db: SessionDep = Depends()):
        """
        한 내역의 분할을 통째로 교체한다.
        편집 팝업이 목록 전체를 들고 있으므로, 개별 추가/삭제보다 단순하고 안전하다.
        """
        owner = db.query(owner_model).filter(owner_id_col == owner_id).first()
        if not owner:
            raise HTTPException(status_code=404, detail="not found")

        cleaned, total = _clean(payload)

        gross = Decimal(str(owner.amount))
        if total > gross:
            raise HTTPException(
                status_code=400,
                detail=f"분할 합계({total})가 결제 금액({owner.amount})을 초과합니다.",
            )

        try:
            db.query(split_model).filter(split_fk_col == owner_id).delete()
            for c in cleaned:
                db.add(split_model(**{split_fk: owner_id}, **c))
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

        splits = _fetch(db, owner_id)
        return {
            "status": "ok",
            "splits": [_row(s, _load_names(db, splits)) for s in splits],
            "gross_amount": float(gross),
            "split_amount": float(total),
            "net_amount": float(gross - total),
        }

    return router


# main.py 가 각각 /entries, /pending-entries, /scheduled-entries 아래에 붙인다
router = make_split_router(Entry, "entry_id", EntrySplit, "entry_id")
pending_router = make_split_router(
    PendingEntry, "entry_id", PendingEntrySplit, "pending_id"
)
scheduled_router = make_split_router(
    ScheduledEntry, "schedule_id", ScheduledEntrySplit, "schedule_id"
)


def copy_splits(db, src_model, src_fk, src_id, dst_model, dst_fk, dst_id) -> int:
    """
    분할을 다음 단계로 옮겨 적는다.
    스케줄 → Pending → Entry 로 내역이 넘어갈 때 함께 불린다.
    호출한 쪽에서 commit 한다.
    """
    rows = db.query(src_model).filter(getattr(src_model, src_fk) == src_id).all()
    for r in rows:
        db.add(
            dst_model(
                **{dst_fk: dst_id},
                amount=r.amount,
                split_type=r.split_type,
                counterpart_id=r.counterpart_id,
                memo=r.memo,
            )
        )
    return len(rows)
