/**
 * 영수증 한 장을 그린다.
 *
 * 화면에 보이는 것과 복사되는 그림이 **같은 붓**에서 나와야 한다. DOM으로
 * 한 벌, canvas로 또 한 벌 그리면 둘이 어긋나는 날이 반드시 온다. 그래서
 * 팝업도 canvas로 그린다 — 머리, 항목, 발 셋을 따로 그려 가운데만 굴리고,
 * 복사할 때는 셋을 이어 한 장으로 그린다.
 *
 * 글꼴은 고정폭을 쓴다. 금액이 자릿수대로 서야 영수증으로 읽힌다. 한글은
 * 어차피 시스템 글꼴로 떨어지는데, CSS와 canvas가 같은 차례로 떨어지도록
 * 같은 글꼴 줄을 쓴다.
 */

export const MONO =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
const SERIF = '"Gowun Batang", serif';

/** 영수증 한 줄. 어느 쪽에서 왔든 이 꼴로 맞춰 넘긴다. */
export type ReceiptRow = {
  key: string;
  /** 어느 갈래에서 왔나 */
  src: "지출" | "대기" | "정기";
  /** YYYY-MM-DD */
  date: string;
  /** 중 > 소 > 세를 이은 것 */
  cat: string;
  /** 쪼갠 건은 실지출(net) */
  amount: number;
  inout: number | null;
  place: string;
  pay: string;
};

/* ── Code 128-B ───────────────────────────────────────────────
   꾸러미를 들이지 않고 손으로 짠다. 패턴은 막대와 틈의 너비를 번갈아 적은
   것이고, 홀수 자리가 검정이다. */
const PAT = (
  "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 " +
  "221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 " +
  "221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 " +
  "212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 " +
  "231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 " +
  "231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 " +
  "314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 " +
  "112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 " +
  "111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 " +
  "214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 " +
  "114131 311141 411131 211412 211214 211232 2331112"
).split(/\s+/);

/** 글을 막대 너비의 줄로 바꾼다. 담을 수 없는 글자는 물음표로 바꾼다. */
export function code128b(text: string): number[] {
  const vals = [...text].map((ch) => {
    const v = ch.charCodeAt(0) - 32;
    return v < 0 || v > 94 ? 31 : v; // 31 = '?'
  });
  let sum = 104; // Start B
  vals.forEach((v, i) => {
    sum += v * (i + 1);
  });
  return [...[104, ...vals, sum % 103, 106].map((i) => PAT[i]).join("")].map(Number);
}

/** YYYY-MM-DD를 YYMMDD로 */
const yy = (d: string) => d.slice(2, 4) + d.slice(5, 7) + d.slice(8, 10);

/**
 * 영수증 번호. 기간과 뽑은 때를 모두 담는다.
 *
 * 뽑은 때는 초까지 적는다. 분까지만 적으면 같은 기간을 한 분 안에 두 번
 * 뽑았을 때 같은 번호가 나온다 — 번호는 팝업을 열 때 한 번 잡히므로,
 * 복사해 보고 닫았다가 다시 열어 공유하는 흐름이면 충분히 생긴다.
 * 초를 붙이면 1초만 떨어져도 반드시 달라진다.
 */
export function receiptNo(from: string, to: string, at: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const 뽑 =
    String(at.getFullYear()).slice(2) +
    p(at.getMonth() + 1) +
    p(at.getDate()) +
    p(at.getHours()) +
    p(at.getMinutes()) +
    p(at.getSeconds());
  return `RC-${yy(from)}-${yy(to)}-${뽑}`;
}

/* 요일은 영어 세 글자로 적는다. 고정폭 글꼴이라 한글보다 자리가 고르다.
   영수증 번호에는 넣지 않는다 — 번호는 숫자만으로 읽혀야 한다. */
const 요일표 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** YYYY-MM-DD의 요일. 문자열을 그대로 쪼개 세므로 시간대에 끌려가지 않는다. */
const 요일 = (d: string) =>
  요일표[new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)).getDay()];

/** 2026. 10. 1. (Thu) 꼴로 */
const 날말 = (d: string) =>
  `${d.slice(0, 4)}. ${+d.slice(5, 7)}. ${+d.slice(8, 10)}. (${요일(d)})`;

const 원 = (n: number) => Math.round(n).toLocaleString("ko-KR");

/* ── 치수 ───────────────────────────────────────────────────── */
const W = 330; // 종이 폭
const PAD = 16; // 좌우 여백
const INNER = W - PAD * 2;

const 빛 = {
  종이: "#FFFEFA",
  글: "#1F2429",
  옅은글: "#6B7480",
  금: "#C9CDD2",
  점선: "#E3E6E9",
  굵은금: "#1F2429",
  형광펜: "rgba(221,196,242,.62)",
  /* 수입과 지출. 앱 카드의 --color-success/--color-danger와 같은 뜻이되
     한 단계 짙다. 카드의 #00C7BE와 #FF5C57을 그대로 쓰면 이 종이빛 위에서
     2.10:1, 3.01:1까지 떨어져 읽히지 않는다. 지금 값은 6.29:1, 6.96:1. */
  수입: "#2F6B45",
  지출: "#A62B20",
  발: "#8A9099",
};

const 딱지빛: Record<ReceiptRow["src"], { bg: string; fg: string }> = {
  지출: { bg: "#EEF1F4", fg: "#4A535C" },
  대기: { bg: "#F8EEDA", fg: "#8A5B00" },
  정기: { bg: "#E8EEF0", fg: "#1F4E5F" },
};

export type ReceiptMeta = {
  from: string;
  to: string;
  at: Date;
  no: string;
};

/** 고른 줄에서 머리말에 적을 것을 셈한다. */
export function receiptMeta(rows: ReceiptRow[], at = new Date()): ReceiptMeta {
  const 날 = rows.map((r) => r.date).sort();
  const from = 날[0] ?? "";
  const to = 날[날.length - 1] ?? "";
  return { from, to, at, no: receiptNo(from, to, at) };
}

/** 글을 폭에 맞춰 접는다. 낱말 가운데서 끊지 않되, 한 낱말이 폭을 넘으면 끊는다. */
function 접기(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  let 줄 = "";
  for (const 낱 of text.split(" ")) {
    const 후보 = 줄 ? `${줄} ${낱}` : 낱;
    if (ctx.measureText(후보).width <= max || !줄) {
      줄 = 후보;
      continue;
    }
    out.push(줄);
    줄 = 낱;
  }
  if (줄) out.push(줄);

  /* 한 낱말이 통째로 넘치면 글자 단위로 끊는다. */
  const 다시: string[] = [];
  for (const l of out) {
    if (ctx.measureText(l).width <= max) {
      다시.push(l);
      continue;
    }
    let cur = "";
    for (const ch of l) {
      if (ctx.measureText(cur + ch).width > max && cur) {
        다시.push(cur);
        cur = "";
      }
      cur += ch;
    }
    if (cur) 다시.push(cur);
  }
  return 다시;
}

const 글꼴 = (size: number, weight = 400, face = MONO) => `${weight} ${size}px ${face}`;

/* ── 재고 그리기 ─────────────────────────────────────────────
   같은 함수가 재기도 하고 그리기도 한다. 둘을 따로 두면 한쪽만 고치는 날이
   온다. ctx가 없으면 재기만 하고 키를 돌려준다. */

type Pen = { ctx: CanvasRenderingContext2D; y: number };

function 머리(p: Pen | null, ctx: CanvasRenderingContext2D, m: ReceiptMeta, 건수: number): number {
  let y = 16;
  ctx.textBaseline = "alphabetic";

  /* 로고와 형광펜 */
  ctx.font = 글꼴(17, 700, SERIF);
  const 이름 = "돈을 쓰다";
  const lw = ctx.measureText(이름).width;
  const lx = (W - lw) / 2;
  y += 17;
  if (p) {
    p.ctx.fillStyle = 빛.형광펜;
    p.ctx.fillRect(lx - 4, y - 17 * 0.38, lw + 8, 17 * 0.42);
    p.ctx.fillStyle = 빛.글;
    p.ctx.font = 글꼴(17, 700, SERIF);
    p.ctx.textAlign = "center";
    p.ctx.fillText(이름, W / 2, y);
  }

  /* 기간 */
  y += 15;
  const 기간 = m.from === m.to ? 날말(m.from) : `${날말(m.from)} ~ ${날말(m.to).slice(6)}`;
  if (p) {
    p.ctx.font = 글꼴(10);
    p.ctx.fillStyle = "#4A535C";
    p.ctx.textAlign = "center";
    p.ctx.fillText(기간, W / 2, y);
  }

  /* 건수 */
  y += 13;
  if (p) {
    p.ctx.font = 글꼴(9.5);
    p.ctx.fillStyle = 빛.옅은글;
    p.ctx.textAlign = "center";
    p.ctx.fillText(`${건수}건`, W / 2, y);
  }

  /* 점선 */
  y += 13;
  if (p) {
    p.ctx.strokeStyle = 빛.금;
    p.ctx.lineWidth = 1;
    p.ctx.setLineDash([4, 4]);
    p.ctx.beginPath();
    p.ctx.moveTo(PAD, y + 0.5);
    p.ctx.lineTo(W - PAD, y + 0.5);
    p.ctx.stroke();
    p.ctx.setLineDash([]);
  }
  return y + 7;
}

function 한줄(p: Pen | null, ctx: CanvasRenderingContext2D, r: ReceiptRow, y0: number, 끝인가: boolean): number {
  let y = y0 + 4;

  /* 금액을 먼저 재서 분류가 쓸 폭을 정한다.
     부호는 숫자 칸을 넓히지 않고 분류와의 틈에 걸친다. 칸을 넓히면 그만큼
     분류가 한 줄 더 접히는데, 영수증은 짧을수록 좋다. 틈은 부호가 실제로
     차지하는 폭에서 구하므로 글꼴이 바뀌어도 글자끼리 붙지 않는다. */
  ctx.font = 글꼴(12, 700);
  const 부호 = r.inout === 1 ? "+" : "−";
  const 숫자글 = 원(r.amount);
  const 금액글 = 부호 + 숫자글;
  const 금액폭 = ctx.measureText(숫자글).width;
  const 틈 = Math.max(7, ctx.measureText(부호).width + 2);

  /* 갈래 딱지 */
  ctx.font = 글꼴(9, 700);
  const 딱폭 = ctx.measureText(r.src).width + 8;

  /* 분류 */
  ctx.font = 글꼴(11, 600);
  const 분류폭 = INNER - 금액폭 - 틈;
  const 첫줄폭 = 분류폭 - 딱폭 - 4;
  const 조각 = 접기(ctx, r.cat || "—", 분류폭);

  /* 첫 줄은 딱지만큼 좁다. 넘치면 다시 접는다. */
  let 줄들 = 조각;
  if (ctx.measureText(조각[0] ?? "").width > 첫줄폭) {
    const 앞 = 접기(ctx, 조각[0], 첫줄폭);
    줄들 = [...앞, ...조각.slice(1)];
  }

  y += 11;
  if (p) {
    /* 딱지 */
    const t = 딱지빛[r.src];
    p.ctx.fillStyle = t.bg;
    p.ctx.beginPath();
    p.ctx.roundRect(PAD, y - 9.5, 딱폭, 13, 3);
    p.ctx.fill();
    p.ctx.font = 글꼴(9, 700);
    p.ctx.fillStyle = t.fg;
    p.ctx.textAlign = "left";
    p.ctx.fillText(r.src, PAD + 4, y - 0.5);

    /* 금액 */
    p.ctx.font = 글꼴(12, 700);
    p.ctx.fillStyle = r.inout === 1 ? 빛.수입 : 빛.지출;
    p.ctx.textAlign = "right";
    p.ctx.fillText(금액글, W - PAD, y);

    /* 분류 */
    p.ctx.font = 글꼴(11, 600);
    p.ctx.fillStyle = 빛.글;
    p.ctx.textAlign = "left";
    p.ctx.fillText(줄들[0] ?? "", PAD + 딱폭 + 4, y);
  }
  for (let i = 1; i < 줄들.length; i += 1) {
    y += 15;
    if (p) {
      p.ctx.font = 글꼴(11, 600);
      p.ctx.fillStyle = 빛.글;
      p.ctx.textAlign = "left";
      p.ctx.fillText(줄들[i], PAD, y);
    }
  }

  /* 아랫줄 — 날짜, 장소, 결제 수단 */
  y += 13;
  if (p) {
    p.ctx.font = 글꼴(9.5);
    p.ctx.fillStyle = 빛.옅은글;
    p.ctx.textAlign = "left";
    const 날 = `${r.date.slice(5, 7)}.${r.date.slice(8, 10)} (${요일(r.date)})`;
    p.ctx.fillText(날, PAD, y);
    const 날폭 = p.ctx.measureText(날).width;

    p.ctx.textAlign = "right";
    const 결제 = r.pay ?? "";
    p.ctx.fillText(결제, W - PAD, y);
    const 결폭 = p.ctx.measureText(결제).width;

    if (r.place) {
      p.ctx.textAlign = "left";
      const 자리 = PAD + 날폭 + 6;
      const 남은 = W - PAD - 결폭 - 8 - 자리;
      let 글 = r.place;
      while (글 && p.ctx.measureText(글).width > 남은) 글 = 글.slice(0, -1);
      if (글 !== r.place && 글.length > 1) 글 = `${글.slice(0, -1)}…`;
      if (남은 > 20) p.ctx.fillText(글, 자리, y);
    }
  }

  y += 4;
  if (!끝인가) {
    if (p) {
      p.ctx.strokeStyle = 빛.점선;
      p.ctx.lineWidth = 1;
      p.ctx.setLineDash([1, 3]);
      p.ctx.beginPath();
      p.ctx.moveTo(PAD, y + 0.5);
      p.ctx.lineTo(W - PAD, y + 0.5);
      p.ctx.stroke();
      p.ctx.setLineDash([]);
    }
    y += 1;
  }
  return y;
}

function 발(p: Pen | null, m: ReceiptMeta, 합: number): number {
  let y = 8;
  if (p) {
    p.ctx.strokeStyle = 빛.굵은금;
    p.ctx.lineWidth = 1;
    p.ctx.beginPath();
    p.ctx.moveTo(PAD, y + 0.5);
    p.ctx.lineTo(W - PAD, y + 0.5);
    p.ctx.stroke();
  }

  y += 7 + 17;
  if (p) {
    p.ctx.font = 글꼴(13, 700);
    p.ctx.fillStyle = 빛.글;
    p.ctx.textAlign = "left";
    p.ctx.fillText("합계", PAD, y);
    p.ctx.font = 글꼴(17, 700);
    p.ctx.textAlign = "right";
    /* 날짜 단 머리말과 같은 꼴로 적는다 — 부호를 앞에 두고 숫자는 절댓값,
       빼기는 글자용 − 를 쓴다. 색도 줄 금액과 같은 두 빛을 쓴다. */
    const 부호 = 합 > 0 ? "+" : 합 < 0 ? "−" : "";
    p.ctx.fillStyle = 합 > 0 ? 빛.수입 : 합 < 0 ? 빛.지출 : 빛.글;
    p.ctx.fillText(부호 + 원(Math.abs(합)), W - PAD, y);
    p.ctx.fillStyle = 빛.글;
  }

  /* 바코드 */
  y += 8;
  const 막대 = code128b(m.no);
  const 총모듈 = 막대.reduce((a, b) => a + b, 0);
  const mod = INNER / 총모듈;
  const 바키 = 24;
  if (p) {
    p.ctx.fillStyle = 빛.글;
    let x = PAD;
    막대.forEach((w, i) => {
      if (i % 2 === 0) p.ctx.fillRect(x, y, w * mod, 바키);
      x += w * mod;
    });
  }
  y += 바키 + 3 + 9;
  if (p) {
    p.ctx.font = 글꼴(8.5);
    p.ctx.fillStyle = "#4A535C";
    p.ctx.textAlign = "center";
    p.ctx.fillText(m.no, W / 2, y);
  }

  y += 5 + 9;
  if (p) {
    const d = m.at;
    const pp = (n: number) => String(n).padStart(2, "0");
    p.ctx.font = 글꼴(9);
    p.ctx.fillStyle = 빛.발;
    p.ctx.textAlign = "center";
    /* 초까지 적는다. 바로 위 번호가 초를 담고 있어서, 여기만 분까지면
       두 줄이 붙어 있는 자리에서 눈이 바로 어긋남을 잡아낸다. */
    p.ctx.fillText(
      `${d.getFullYear()}. ${pp(d.getMonth() + 1)}. ${pp(d.getDate())}. ` +
        `(${요일표[d.getDay()]}) ${pp(d.getHours())}:${pp(d.getMinutes())}:${pp(d.getSeconds())}`,
      W / 2,
      y
    );
  }
  return y + 13;
}

export type Part = "head" | "list" | "foot" | "all";

/**
 * 고른 줄의 합계.
 *
 * 날짜 단 머리말의 셈(수입 − 지출)과 같다. 영수증만 거꾸로 세면 같은 줄을
 * 놓고 화면과 영수증의 부호가 어긋난다.
 */
function 합계(rows: ReceiptRow[]): number {
  return rows.reduce((a, r) => a + (r.inout === 1 ? r.amount : -r.amount), 0);
}

/** 재기만 한다. canvas를 몇 px로 잡을지 알아야 그릴 수 있다. */
function 재기(ctx: CanvasRenderingContext2D, rows: ReceiptRow[], m: ReceiptMeta, part: Part): number {
  const 합 = 합계(rows);
  if (part === "head") return 머리(null, ctx, m, rows.length);
  if (part === "foot") return 발(null, m, 합);
  let y = part === "all" ? 머리(null, ctx, m, rows.length) : 0;
  rows.forEach((r, i) => {
    y = 한줄(null, ctx, r, y, i === rows.length - 1);
  });
  if (part === "all") y += 발(null, m, 합);
  return y;
}

/**
 * 영수증을 canvas에 그린다. 그린 키를 돌려준다.
 *
 * dpr를 곱해 그리되 좌표는 CSS px 그대로 쓴다. 그래야 재는 식과 그리는 식이
 * 하나로 끝난다.
 */
export function drawReceipt(
  canvas: HTMLCanvasElement,
  rows: ReceiptRow[],
  m: ReceiptMeta,
  part: Part = "all",
  dpr = Math.min(window.devicePixelRatio || 1, 3)
): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;

  const h = Math.ceil(재기(ctx, rows, m, part));
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(h * dpr);
  /* 화면에 설 크기는 CSS가 정한다(.rc-canvas가 width: 100%). 여기서 330px로
     못박으면 좁은 기기에서 종이가 판보다 넓어져 금액이 잘린다. 복사로 나가는
     그림은 어차피 이 폭과 무관하게 canvas.width 그대로다. */

  const c2 = canvas.getContext("2d");
  if (!c2) return h;
  c2.setTransform(dpr, 0, 0, dpr, 0, 0);
  c2.fillStyle = 빛.종이;
  c2.fillRect(0, 0, W, h);

  const pen: Pen = { ctx: c2, y: 0 };
  const 합 = 합계(rows);

  if (part === "head") {
    머리(pen, c2, m, rows.length);
    return h;
  }
  if (part === "foot") {
    발(pen, m, 합);
    return h;
  }

  let y = 0;
  if (part === "all") {
    y = 머리(pen, c2, m, rows.length);
  }
  /* 줄은 그릴 때마다 원점을 옮긴다. 각 함수가 제 안에서 0부터 재기 때문이다. */
  rows.forEach((r, i) => {
    c2.save();
    c2.translate(0, y);
    const dh = 한줄(pen, c2, r, 0, i === rows.length - 1);
    c2.restore();
    y += dh;
  });
  if (part === "all") {
    c2.save();
    c2.translate(0, y);
    발(pen, m, 합);
    c2.restore();
  }
  return h;
}

export const RECEIPT_WIDTH = W;
