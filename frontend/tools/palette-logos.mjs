/**
 * 벌마다 로고를 한 장씩 만든다.
 *
 *   node tools/palette-logos.mjs
 *
 * 로고는 `<img>`로 붙는 그림 파일이라 CSS가 닿지 않는다. 그렇다고 26KB짜리
 * 길 데이터를 화면 코드 안으로 들여오면 묶음이 무거워지고, 상표를 고치는 일이
 * 코드를 고치는 일이 되어 버린다. 그래서 벌마다 한 장씩 미리 물들여 둔다.
 *
 * 원본(public/logo-h.svg)에 박힌 색은 딱 두 가지다. 남보라와 청록이 네 자리에
 * 나오고, 그 가운데 둘은 둘을 잇는 그라데이션의 양 끝이다. 두 가지만 갈아
 * 끼우면 획과 그라데이션이 함께 따라온다.
 *
 * 원본은 건드리지 않는다. 첫 띄움 화면(index.html)이 그대로 쓴다.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "..", "public", "logo-h.svg");
const OUT = path.join(HERE, "..", "public", "palette");

/** 원본에 박힌 두 가지. src/utils/palettes.ts의 쪽빛 art와 같다. */
const 원본 = { ink: "#5B5FEF", aqua: "#00C7BE" };

/** 벌마다의 두 가지. src/utils/palettes.ts의 art와 같아야 한다.
    dark는 어두운 칸에서 쓸 먹빛 — palettes.ts의 dark.artInk와 같아야 한다.
    짙은 벌은 어두운 바탕에서 로고가 묻히기 때문이다. */
const ART = {
  jjok: { ink: "#5B5FEF", aqua: "#00C7BE", dark: "#8A8DF7" },
  hwangto: { ink: "#8C5E3C", aqua: "#6F9055", dark: "#C89A70" },
  meok: { ink: "#3F4E63", aqua: "#3E9E82", dark: "#9DB2CC" },
  sut: { ink: "#2F3033", aqua: "#5FAE2E", dark: "#D2D7DD" },
  podo: { ink: "#6B3F5E", aqua: "#8CA83F", dark: "#C28FB2" },
  crayon: { ink: "#1E5FD8", aqua: "#00A84F", dark: "#6D9CF3" },
  bada: { ink: "#0F7490", aqua: "#2E9E6B", dark: "#55B3CC" },
};

export default function makeLogos() {
  const src = fs.readFileSync(SRC, "utf8");
  fs.mkdirSync(OUT, { recursive: true });
  for (const [key, art] of Object.entries(ART)) {
    for (const [꼬리, ink] of [["", art.ink], ["-dark", art.dark]]) {
      /* 한 번에 바꾼다. 차례로 바꾸면 먼저 넣은 값이 다음 짝에 다시 잡힐 수 있다. */
      const out = src.replace(/#5B5FEF|#00C7BE/gi, (m) =>
        m.toUpperCase() === 원본.ink ? ink : art.aqua
      );
      fs.writeFileSync(path.join(OUT, `logo-${key}${꼬리}.svg`), out, "utf8");
    }
  }
  return Object.keys(ART).length * 2;
}

/* 창에서는 드라이브 글자 때문에 문자열로 견주면 어긋난다. URL로 맞춘다. */
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`로고 ${makeLogos()}장`);
}
