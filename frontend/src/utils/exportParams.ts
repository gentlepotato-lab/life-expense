/**
 * 화면에 걸린 조건을 내보내기 길이 알아듣는 꼴로 바꾼다.
 *
 * 서버의 /export/*는 /entries/filter와 같은 이름과 같은 꼴을 받는다.
 * 두 곳이 어긋나면 화면이 보는 것과 파일이 담는 것이 달라지므로,
 * 바꾸는 자리를 여기 한 곳에만 둔다.
 */

/** 거르개가 들고 있는 칸. 화면마다 조금씩 다르므로 있는 것만 본다. */
export type 거른것 = {
  dateFrom?: string;
  dateTo?: string;
  cat1?: number[];
  cat2?: number[];
  cat3?: number[];
  pay?: string[];
  memo?: string;
  inout?: number;
  amountMin?: string | number;
  amountMax?: string | number;
  place?: string;
  cp?: number[];
};

const 모음 = (v: unknown[] | undefined) =>
  v && v.length ? JSON.stringify(v) : undefined;

const 글 = (v: string | undefined) => (v && v.trim() !== "" ? v : undefined);

const 수 = (v: string | number | undefined) =>
  v === "" || v === undefined || v === null ? undefined : Number(v);

export function 내보낼조건(f: 거른것 | undefined): Record<string, unknown> {
  if (!f) return {};
  return {
    date_from: 글(f.dateFrom),
    date_to: 글(f.dateTo),
    cat1: 모음(f.cat1),
    cat2: 모음(f.cat2),
    cat3: 모음(f.cat3),
    pay: 모음(f.pay),
    memo: 글(f.memo),
    inout: f.inout ? f.inout : undefined,
    amount_min: 수(f.amountMin),
    amount_max: 수(f.amountMax),
    place: 글(f.place),
    counterpart: 모음(f.cp),
  };
}
