import { useState } from "react";
import { 기능적기 } from "../../utils/track";
import api from "../../api/client";
import { ask, say } from "../../utils/notify";
import { 조사 } from "../../utils/josa";
import ExportIcon from "./ExportIcon";
import { drawReceipt, receiptMeta, type ReceiptRow } from "../../utils/receipt";

/**
 * 내보내기 — 화면 오른쪽 아래에 떠 있는 단추.
 *
 * 맨 위로(ScrollTopButton) 바로 위에 선다. 떠 있는 자리를 고른 까닭은
 * 도구 줄에 자리가 없기 때문이다. 가장 좁은 360px에서 알약 하나를 더
 * 끼우면 도구 줄이 두 줄이 되어 아래 내용이 통째로 밀린다. 떠 있는 것은
 * 내용 위에 겹쳐 뜨므로 한 칸도 밀지 않는다.
 *
 * 지금 화면에 걸린 조건을 그대로 서버에 넘긴다. 화면이 보고 있는 것과
 * 파일이 담는 것이 어긋나면 받아 본 사람이 무엇을 믿어야 할지 모른다.
 */

type Props = {
  /** 서버의 어느 길로 물을지 — /api/export/{길} */
  길: string;
  /** 그 길에 넘길 조건. 화면이 지금 걸고 있는 그대로다. */
  params?: Record<string, unknown>;
  /** 안내 문구에 쓸 이름 */
  이름: string;
  /** 내보낼 것이 없으면 누르지 못하게 한다. */
  빔?: boolean;
  /** 영수증 장을 넣을지. 기본은 넣는다. */
  영수증?: boolean;
};

/** 파일에 담길 줄을 그대로 받아 온다. 실패하면 영수증 없이 간다. */
async function 영수증줄(길: string, params?: Record<string, unknown>): Promise<ReceiptRow[]> {
  try {
    const r = await api.get(`/export/${길}`, { params: { ...params, rows: 1 } });
    return Array.isArray(r.data) ? (r.data as ReceiptRow[]) : [];
  } catch {
    return [];
  }
}

/** 영수증 그림 한 장. 줄이 없으면 그리지 않는다. */
async function 영수증그림(줄들: ReceiptRow[]): Promise<Blob | null> {
  if (!줄들.length) return null;
  const canvas = document.createElement("canvas");
  /* 화면 배율과 무관하게 2배로 그린다. 엑셀에 얹을 때 반으로 줄여 또렷하다. */
  drawReceipt(canvas, 줄들, receiptMeta(줄들), "all", 2);
  return await new Promise((풀기) => canvas.toBlob((b) => 풀기(b), "image/png"));
}

export default function ExportButton({ 길, params, 이름, 빔, 영수증 = true }: Props) {
  const [받는중, set받는중] = useState(false);

  /* 머리에 담긴 파일 이름을 꺼낸다. 서버가 RFC 5987로 적어 보낸다. */
  const 파일이름 = (머리: string | undefined): string => {
    const m = /filename\*=UTF-8''([^;]+)/i.exec(머리 ?? "");
    if (m) {
      try {
        return decodeURIComponent(m[1]);
      } catch {
        /* 못 읽으면 아래 기본 이름을 쓴다. */
      }
    }
    return `돈을쓰다_${이름}.xlsx`;
  };

  const 받기 = async () => {
    if (받는중) return;
    if (빔) {
      say.warn("내보낼 내역이 없습니다.");
      return;
    }

    /* 되묻고 간다. 떠 있는 단추라 굴리다 스치기 쉬운 자리인데, 세 해치를
       한 번에 담으면 4초가 걸린다. 무엇이 담기는지도 함께 적는다 — 화면에
       걸린 조건 그대로 나가므로 지금 보고 있는 것이 곧 파일이다. */
    const 예 = await ask({
      title: "Excel로 내려받기",
      body: `지금 화면에 걸린 조건 그대로 ${이름}${조사(이름, "을", "를")} 내려받습니다.`,
      go: "내려받기",
    });
    if (!예) return;

    set받는중(true);
    try {
      /* 영수증은 canvas로만 그린다(utils/receipt.ts). 서버에서 한 벌 더
         그리면 둘이 어긋나는 날이 오므로, 담길 줄만 받아 와 여기서 그린 뒤
         그림째 올려 보낸다. 줄을 서버가 내주므로 파일에 담기는 것과 영수증에
         찍히는 것이 어긋날 길이 없다. */
      const 종이 = 영수증 ? await 영수증그림(await 영수증줄(길, params)) : null;
      const res = 종이
        ? await (async () => {
            const fd = new FormData();
            fd.append("receipt", 종이, "receipt.png");
            기능적기("엑셀 " + 길);
            return api.post(`/export/${길}`, fd, { params, responseType: "blob" });
          })()
        : await api.get(`/export/${길}`, { params, responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = 파일이름(res.headers?.["content-disposition"] as string | undefined);
      document.body.appendChild(a);
      a.click();
      a.remove();
      /* 바로 거두면 받기가 끊기는 기기가 있다. 한 틀 뒤에 거둔다. */
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      say.ok(`${이름}${조사(이름, "을", "를")} Excel로 내려받았습니다.`);
    } catch {
      say.warn("내보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      set받는중(false);
    }
  };

  return (
    <button
      type="button"
      className={`export-btn${받는중 ? " is-busy" : ""}`}
      aria-label={`${이름} 내보내기`}
      title={받는중 ? "내보내는 중입니다." : `${이름}${조사(이름, "을", "를")} 엑셀로 내보냅니다.`}
      aria-busy={받는중 || undefined}
      onClick={받기}
    >
      <ExportIcon />
    </button>
  );
}
