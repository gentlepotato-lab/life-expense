import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useBackClose from "../../hooks/useBackClose";
import { say } from "../../utils/notify";
import { CopyIcon, DownloadIcon, ShareIcon } from "./ReceiptIcons";
import {
  drawReceipt,
  receiptMeta,
  RECEIPT_WIDTH,
  type ReceiptRow,
} from "../../utils/receipt";

/**
 * 고른 내역을 영수증 한 장으로 띄운다.
 *
 * 머리와 발은 붙박이고 가운데 항목만 굴러간다. 그래야 합계가 늘 보인다.
 * 셋 다 canvas라 화면에 보이는 것과 복사되는 그림이 같은 붓에서 나온다.
 *
 * 복사는 클립보드에 PNG로 넣는다. 클립보드 그림 쓰기는 HTTPS에서만 되므로
 * 안 되는 자리에서는 파일로 내려받게 떨어뜨린다.
 */
export default function ReceiptPopup({
  rows,
  onClose,
}: {
  rows: ReceiptRow[];
  onClose: () => void;
}) {
  useBackClose(true, onClose);

  /* 다른 팝업과 같이 뒤 화면을 잠근다. */
  useEffect(() => {
    document.documentElement.classList.add("modal-open");
    return () => document.documentElement.classList.remove("modal-open");
  }, []);

  /* 뽑은 때는 팝업이 열릴 때 한 번만 잡는다. 다시 그릴 때마다 바뀌면
     영수증 번호가 눈앞에서 달라진다. */
  const 때 = useRef(new Date());
  const meta = useMemo(() => receiptMeta(rows, 때.current), [rows]);

  const head = useRef<HTMLCanvasElement>(null);
  const list = useRef<HTMLCanvasElement>(null);
  const foot = useRef<HTMLCanvasElement>(null);
  const [그렸나, set그렸나] = useState(false);

  /* 내보낼 그림을 미리 만들어 둔다.
     공유도 클립보드도 "손가락이 아직 떨어지지 않은 동안"에만 열린다. 단추를
     누르고 나서 그리면 그 사이에 그 자격이 식어, 모바일에서 NotAllowedError로
     떨어진다. 그래서 팝업이 열릴 때 한 장 그려 두고 단추는 그때 깨운다. */
  const 그림 = useRef<Blob | null>(null);

  /* 화면에 선 석 장을 칠한다. 내보낼 그림은 따로 둔다 — 다시 칠할 일은
     잦아도 그림은 한 번만 뜨면 된다. */
  const 칠하기 = useCallback(() => {
    if (rows.length === 0) return;
    if (head.current) drawReceipt(head.current, rows, meta, "head");
    if (list.current) drawReceipt(list.current, rows, meta, "list");
    if (foot.current) drawReceipt(foot.current, rows, meta, "foot");
  }, [rows, meta]);

  useEffect(() => {
    if (rows.length === 0) return;
    let 살아 = true;
    /* 글꼴이 아직 안 왔으면 재는 폭이 달라져 글이 어긋난다. 기다렸다 그린다. */
    const 그리기 = () => {
      if (!살아) return;
      칠하기();
      const cv = document.createElement("canvas");
      drawReceipt(cv, rows, meta, "all", 3);
      cv.toBlob((b) => {
        if (!살아) return;
        그림.current = b;
        set그렸나(!!b);
      }, "image/png");
    };
    if (document.fonts?.ready) void document.fonts.ready.then(그리기);
    else 그리기();
    return () => {
      살아 = false;
    };
  }, [rows, meta, 칠하기]);

  /*
   * 앱을 나갔다 들어오면 다시 칠한다.
   *
   * 영수증 석 장은 살아 있는 canvas다. 폰에서 앱을 내려놓으면 브라우저가
   * 자리가 모자랄 때 canvas가 쥐고 있던 그림판을 거둬 간다 — 요소는 그대로
   * 서 있는데 칠한 것만 사라져, 되돌아왔을 때 깨진 그림 기호가 떴다가 흰
   * 종이로 남았다. React는 그릴 것이 안 바뀌었으니 다시 그리지 않는다.
   *
   * 그림판을 잃었다는 말(contextlost)을 들으면 그 자리에서 다시 칠하고,
   * 그 말을 전하지 않는 브라우저를 위해 화면이 다시 보일 때와 뒤로 가기로
   * 되살아날 때도 한 번씩 칠한다. 칠하는 값은 열 때 잡아 둔 것 그대로라
   * 영수증 번호도 뽑은 때도 달라지지 않는다.
   */
  useEffect(() => {
    if (rows.length === 0) return;
    const 다시 = () => {
      if (document.visibilityState === "visible") 칠하기();
    };
    /* 잃었다는 말에 기본 처리를 막아야 브라우저가 그림판을 되돌려 준다. */
    const 잃음 = (e: Event) => e.preventDefault();
    const 칸들 = [head.current, list.current, foot.current].filter(
      (c): c is HTMLCanvasElement => !!c
    );
    칸들.forEach((c) => {
      c.addEventListener("contextlost", 잃음);
      c.addEventListener("contextrestored", 칠하기);
    });
    document.addEventListener("visibilitychange", 다시);
    window.addEventListener("pageshow", 다시);
    return () => {
      칸들.forEach((c) => {
        c.removeEventListener("contextlost", 잃음);
        c.removeEventListener("contextrestored", 칠하기);
      });
      document.removeEventListener("visibilitychange", 다시);
      window.removeEventListener("pageshow", 다시);
    };
  }, [rows, 칠하기]);

  const 복사 = useCallback(async () => {
    const blob = 그림.current;
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      say.ok("복사 완료-!! ;-)");
    } catch {
      /* 몰래 파일을 떨어뜨리지 않는다. 받고 싶으면 옆의 단추가 있다.
         http로 열면 navigator.clipboard 자체가 없다. 공유와 같은 벽이므로
         같은 말로 알린다. */
      say.warn(
        window.isSecureContext
          ? "클립보드를 쓸 수 없습니다. 다운로드로 받아 주세요."
          : "https가 아니라 복사를 쓸 수 없습니다. 다운로드로 받아 주세요."
      );
    }
  }, []);

  const 공유 = useCallback(async () => {
    const blob = 그림.current;
    if (!blob) return;
    const file = new File([blob], `${meta.no}.png`, { type: "image/png" });

    /* 안 되는 까닭을 가려 말한다. 셋은 고치는 길이 서로 다르다. */
    if (typeof navigator.share !== "function") {
      say.warn(
        window.isSecureContext
          ? "이 브라우저는 공유를 지원하지 않습니다. 다운로드로 받아 주세요."
          : "https가 아니라 공유를 쓸 수 없습니다. 다운로드로 받아 주세요."
      );
      return;
    }
    /* 파일을 실어 보낼 수 있는지 먼저 묻는다. 묻지 않고 부르면 글만
       보내지거나 그대로 실패한다. */
    if (!navigator.canShare?.({ files: [file] })) {
      say.warn("이 브라우저는 그림 공유를 지원하지 않습니다. 다운로드로 받아 주세요.");
      return;
    }
    try {
      await navigator.share({ files: [file] });
    } catch (e) {
      /* 사용자가 공유판을 닫은 것은 잘못이 아니다. */
      if ((e as Error).name !== "AbortError") say.bad("공유하지 못했습니다.");
    }
  }, [meta]);

  const 다운로드 = useCallback(() => {
    const blob = 그림.current;
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${meta.no}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
    say.ok("다운로드 완료-!! ;-)");
  }, [meta]);

  return (
    <div className="popup-overlay rc-ov" onClick={onClose}>
      <div
        className="rc-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="영수증"
        style={{ width: RECEIPT_WIDTH }}
      >
        <div className="rc-paper">
          <canvas ref={head} className="rc-canvas" />
          <div className="rc-scroll">
            <canvas ref={list} className="rc-canvas" />
          </div>
          <canvas ref={foot} className="rc-canvas" />
        </div>

        {/* 내보내기 셋은 같은 무게로 칠하고 닫기만 물러선다. 다른 팝업은
            주된 행동 하나만 primary 로 두지만, 여기 셋은 서로 대등한
            내보내기 방법이라 하나만 칠하면 그 하나가 임의로 높아 보인다. */}
        <div className="btn-row popup-foot rc-act">
          <button type="button" className="ui-btn" onClick={onClose}>
            닫기
          </button>
          <button
            type="button"
            className="ui-btn primary rc-act__go"
            onClick={복사}
            disabled={!그렸나}
          >
            <span className="rc-act__icon" aria-hidden="true">
              {CopyIcon}
            </span>
            복사
          </button>
          <button
            type="button"
            className="ui-btn primary rc-act__go"
            onClick={공유}
            disabled={!그렸나}
          >
            <span className="rc-act__icon" aria-hidden="true">
              {ShareIcon}
            </span>
            공유
          </button>
          <button
            type="button"
            className="ui-btn primary rc-act__go"
            onClick={다운로드}
            disabled={!그렸나}
          >
            <span className="rc-act__icon" aria-hidden="true">
              {DownloadIcon}
            </span>
            다운로드
          </button>
        </div>
      </div>
    </div>
  );
}
