"""
저 혼자 도는 일의 등록부.

전에는 모듈마다 BackgroundScheduler를 따로 세웠다. 셋이 저마다 제 안에서
만들고 쥐고 있어서, 도는 때를 바깥에서 고칠 길이 없었다. 하나로 모은다.

도는 때는 테이블에 담긴다(life_expense.jobs_schedules). 테이블이 비어 있거나 읽지
못하면 아래 기본때를 쓴다. 테이블을 걷어도 일은 그대로 돈다.

바퀴마다 한 줄씩 적는다(life_expense.jobs_runs). 전에는 print로
흘려보내서, "어제 공휴일을 받아 왔나"를 알 길이 서버 로그를 뒤지는 것뿐이었다.

일을 하나 더하려면 아래 일들에 한 줄을 더하고 테이블에 때를 한 로우 넣으면 된다.
"""

import logging
import time

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import text

from app.deps import SessionLocal

logger = logging.getLogger(__name__)


def _일들():
    """
    도는 일 셋.

    부르는 자리를 함수 안에서 들여온다. 모듈을 들여오는 차례가 꼬이면
    (라우터가 이 모듈을, 이 모듈이 라우터를 들여오는 꼴) 서버가 아예 뜨지
    않기 때문이다.
    """
    from app.scheduler.cleanup_job import run_monthly_cleanup
    from app.scheduler.holiday_job import run_holiday_update
    from app.scheduler.entries_scheduled_job import run_entries_scheduled

    return [
        {
            "key": "scheduled_entry_processor",
            # 이름은 사용자 사이트가 쓰는 화면 이름을 따른다. 정기 내역을
            # 대기 내역으로 보내는 일이다.
            "name": "정기 내역 보내기",
            "run": run_entries_scheduled,
            "기본때": {"kind": "minute", "day_of_month": None, "hour": None, "minute": None},
            # 한 바퀴를 놓쳐도 60초까지는 늦게라도 돈다. 매분 도는 일이라
            # 이것이 없으면 늦은 바퀴마다 경고가 쌓인다.
            "유예": 60,
        },
        {
            "key": "holiday_update_daily",
            "name": "공휴일 조회",
            "run": run_holiday_update,
            "기본때": {"kind": "daily", "day_of_month": None, "hour": 9, "minute": 20},
            "유예": None,
        },
        {
            "key": "monthly_cleanup",
            "name": "묵은 기록 지우기",
            "run": run_monthly_cleanup,
            "기본때": {"kind": "monthly", "day_of_month": 20, "hour": 2, "minute": 0},
            "유예": None,
        },
    ]


# 하나뿐인 스케줄러. 때를 고칠 때 다시 거는 자리가 여기다.
_스케줄러: BackgroundScheduler | None = None


def 때들() -> dict:
    """
    테이블에 담긴 때를 일 열쇠로 찾아 쓰게 모은다.

    테이블이 없거나 읽지 못하면 빈 것을 돌려준다. 부르는 쪽이 기본때로 간다.
    """
    try:
        db = SessionLocal()
        try:
            rows = db.execute(text("""
                SELECT job_key, kind, day_of_month, hour, minute, is_active
                  FROM life_expense.jobs_schedules
            """)).mappings().all()
            return {r["job_key"]: dict(r) for r in rows}
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"[scheduler] 도는 때를 읽지 못했다. 기본값으로 간다: {e}")
        return {}


def _방아쇠(때: dict) -> CronTrigger | None:
    """때 한 줄을 APScheduler의 방아쇠로 바꾼다. 모르는 꼴이면 None이다."""
    kind = (때.get("kind") or "").strip()
    if kind == "minute":
        return CronTrigger(minute="*")
    if kind == "daily":
        return CronTrigger(hour=int(때.get("hour") or 0), minute=int(때.get("minute") or 0))
    if kind == "monthly":
        return CronTrigger(
            day=int(때.get("day_of_month") or 1),
            hour=int(때.get("hour") or 0),
            minute=int(때.get("minute") or 0),
        )
    return None


def _적기(job_key: str, ok: bool, note: str, ms: int | None = None) -> None:
    """바퀴 하나를 적는다. 적다가 터져도 일 자체는 이미 끝난 뒤다."""
    try:
        db = SessionLocal()
        try:
            db.execute(text("""
                INSERT INTO life_expense.jobs_runs (job_key, ok, note, elapsed_ms)
                VALUES (:k, :ok, :note, :ms)
            """), {
                "k": job_key,
                "ok": 1 if ok else 0,
                "note": (note or "")[:200],
                "ms": ms,
            })
            db.commit()
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"[scheduler] {job_key} 바퀴를 적지 못했다: {e}")


def _걸린(시작: float) -> int:
    """잰 때부터 지금까지 몇 밀리초인가."""
    return int((time.monotonic() - 시작) * 1000)


def _감싸기(일):
    """
    일을 감싸 바퀴를 적게 한다.

    일 자체는 제 안에서 탈을 삼킨다. 한 바퀴가 터져도 다음 바퀴는 돌아야
    하기 때문이다. 그래서 (잘됐나, 한 줄)을 돌려받아 그대로 적는다.
    """
    def 돌기():
        # 걸린 시간도 함께 적는다. 요즘 느려지는 중인지는 바퀴 하나만 보고
        # 알 수 없어, 상세 이력에서 나란히 놓고 본다.
        시작 = time.monotonic()
        try:
            결과 = 일["run"]()
        except Exception as e:  # 삼키지 못한 탈까지 여기서 받는다.
            logger.error(f"[scheduler] {일['key']} 터졌다: {e}")
            _적기(일["key"], False, str(e), _걸린(시작))
            return
        if isinstance(결과, tuple) and len(결과) == 2:
            _적기(일["key"], bool(결과[0]), str(결과[1]), _걸린(시작))
        else:
            # 아직 (잘됐나, 한 줄)을 돌려주지 않는 일. 돌았다는 것만 적는다.
            _적기(일["key"], True, "", _걸린(시작))

    return 돌기


def start_all() -> None:
    """
    서버가 뜰 때 한 번 부른다.

    셋을 한 스케줄러에 건다. 전에는 모듈마다 따로 세워 셋이 돌았는데,
    도는 때가 같으므로 겉보기는 달라지지 않는다.
    """
    global _스케줄러
    if _스케줄러 is not None:
        return
    _스케줄러 = BackgroundScheduler()
    담긴때 = 때들()

    for 일 in _일들():
        때 = 담긴때.get(일["key"]) or 일["기본때"]
        if int(때.get("is_active", 1) or 0) == 0:
            logger.info(f"[scheduler] {일['key']} 꺼져 있어 걸지 않는다")
            continue
        방아쇠 = _방아쇠(때) or _방아쇠(일["기본때"])
        if 방아쇠 is None:
            continue
        꾸림 = {"id": 일["key"], "replace_existing": True}
        if 일["유예"]:
            꾸림["misfire_grace_time"] = 일["유예"]
        _스케줄러.add_job(_감싸기(일), trigger=방아쇠, **꾸림)

    _스케줄러.start()
    logger.info("[scheduler] 도는 일을 모두 걸었다")


def reschedule(job_key: str) -> bool:
    """
    한 일의 때를 테이블에서 다시 읽어 다시 건다.

    관리자 사이트에서 때를 고치면 부른다. 서버를 다시 띄우지 않고 그 자리에서
    바뀌어야 "고쳤다"가 말이 된다.
    """
    if _스케줄러 is None:
        return False
    일 = next((x for x in _일들() if x["key"] == job_key), None)
    if 일 is None:
        return False

    때 = 때들().get(job_key) or 일["기본때"]
    있던것 = _스케줄러.get_job(job_key)

    if int(때.get("is_active", 1) or 0) == 0:
        if 있던것:
            _스케줄러.remove_job(job_key)
        return True

    방아쇠 = _방아쇠(때)
    if 방아쇠 is None:
        return False

    if 있던것:
        _스케줄러.reschedule_job(job_key, trigger=방아쇠)
    else:
        꾸림 = {"id": job_key, "replace_existing": True}
        if 일["유예"]:
            꾸림["misfire_grace_time"] = 일["유예"]
        _스케줄러.add_job(_감싸기(일), trigger=방아쇠, **꾸림)
    return True


def 이름들() -> dict:
    """일 열쇠로 이름을 찾게 모은다. 상세 이력 쪽이 열쇠 대신 이름을 적는다."""
    return {일["key"]: 일["name"] for 일 in _일들()}


def 지금모습() -> list[dict]:
    """
    관리자 사이트가 읽을 모습.

    등록부의 이름과 테이블에 담긴 때, 그리고 다음에 돌 때를 함께 돌려준다.
    마지막으로 돈 때는 부르는 쪽이 jobs_runs에서 따로 꺼낸다.
    """
    담긴때 = 때들()
    out = []
    for 일 in _일들():
        때 = 담긴때.get(일["key"]) or 일["기본때"]
        job = _스케줄러.get_job(일["key"]) if _스케줄러 else None
        out.append({
            "key": 일["key"],
            "name": 일["name"],
            "kind": 때.get("kind"),
            "day_of_month": 때.get("day_of_month"),
            "hour": 때.get("hour"),
            "minute": 때.get("minute"),
            "is_active": int(때.get("is_active", 1) or 0),
            # 날과 시각을 갈라 돌려준다. 화면이 날을 「YYYY. M. D. (요일)」로
            # 적으므로(utils/dateGroup.ts의 formatDateLabel) 한 글로 묶어
            # 보내면 받는 쪽에서 다시 쪼개야 한다.
            "next_day": job.next_run_time.strftime("%Y-%m-%d") if job and job.next_run_time else None,
            "next_time": job.next_run_time.strftime("%H:%M") if job and job.next_run_time else None,
        })
    return out
