import useBackClose from "../../hooks/useBackClose";
import useScrollLock from "../../hooks/useScrollLock";
import { formatDateLabel } from "../../utils/dateGroup";
import { 걸린빛 } from "../../utils/adminFmt";
import { 결과표, 걸린글, type 바퀴 } from "./adminBatchBits";

/**
 * 한 바퀴가 남긴 글을 보여 주는 판.
 *
 * 표의 기호(✓, ✕)를 누르면 뜬다. 표의 「결과」 칸은 폭이 좁아 긴 글이 잘리는데,
 * 탈난 바퀴가 남기는 것은 파이썬이 던진 글이라 대개 한 줄을 넘는다
 * (app/scheduler/registry.py가 200자까지 적는다). 잘린 쪽을 보려고 DB를 열지
 * 않게 한다.
 *
 * 껍데기는 다른 판과 같은 틀이다(popup-overlay, popup-panel--framed). 읽기만
 * 하는 판이라 바닥에는 [닫기] 하나뿐이다. 잔소리 상세와 같은 꼴이다
 * (NudgeDetailPopup.tsx).
 */
export default function AdminBatchRunsPopup({
  바퀴: r,
  onClose,
}: {
  바퀴: 바퀴;
  onClose: () => void;
}) {
  /* 뒤로 가기로 닫는다. 사용자 사이트의 판들과 같다. */
  useBackClose(true, onClose);
  /* 열려 있는 동안 뒤쪽은 구르지 않는다. */
  useScrollLock(true);

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel popup-panel--framed"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${r.name} 실행 결과`}
      >
        <header className="popup-head">
          <h3 className="popup-head__title">{r.name}</h3>
        </header>

        <div className="popup-body">
          {/* 이름과 값이 마주 보는 표다. DB 쪽의 표 정보, 서버 정보와 같은
              틀을 쓴다(.admin-tbl--kv). 줄이 넷뿐이라 머리말을 위에 세우면
              한 줄짜리 표가 둘로 갈려 더 휑해 보인다. */}
          <table className="admin-tbl admin-tbl--kv run-say">
            <colgroup>
              <col style={{ width: "82px" }} />
              <col />
            </colgroup>
            <tbody>
              <tr>
                <th>날짜</th>
                <td>{formatDateLabel(r.on_day)}</td>
              </tr>
              <tr>
                {/* 고른 폭 글로 적은 칸은 가로로 선 표에서 가운데로 모이게
                    되어 있다. 여기는 값끼리 왼쪽 선을 맞춰야 하므로 그
                    쏠림을 덜어 내라고 적어 준다(.admin-tbl__left). */}
                <th>시각</th>
                <td className="admin-mono admin-tbl__left">{r.at_time}</td>
              </tr>
              <tr>
                <th>걸린 시간</th>
                <td>
                  <span className={`admin-tbl__chip ${걸린빛(r.ms)}`}>{걸린글(r.ms)}</span>
                </td>
              </tr>
              {/* 기호는 표에 선 것과 같은 것, 같은 빛깔이다. 눌러서 들어온
                  자리라 무엇을 눌렀는지가 판에도 서 있어야 한다. 탈난 바퀴가
                  남기는 글은 대개 한 줄을 넘으므로 이 칸만 줄을 바꾼다. */}
              <tr className={r.ok ? "" : "run-say--bad"}>
                <th>결과</th>
                <td className="admin-tbl__wrap">
                  <span className="run-say__line">
                    <span
                      className={`run-say__mark admin-tbl__mark--${r.ok ? "open" : "bad"}`}
                      aria-hidden="true"
                    >
                      {r.ok ? 결과표.됐다 : 결과표.탈났다}
                    </span>
                    <span className="run-say__text">{r.note || "-"}</span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="btn-row popup-foot">
          <button type="button" className="ui-btn" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
