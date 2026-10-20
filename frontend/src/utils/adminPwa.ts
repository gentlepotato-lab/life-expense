/**
 * 관리자 화면을 따로 내려받게 한다.
 *
 * 한 쪽짜리 앱(SPA)이라 index.html 하나에 manifest 하나가 걸려 있다. 그대로
 * 두면 /admin에서 내려받아도 사용자 앱과 같은 앱으로 깔린다. 바탕 화면에
 * 같은 로고가 두 개 생기고, 눌러도 사용자 홈이 열린다.
 *
 * 그래서 /admin에 들어와 있는 동안만 머리의 세 줄을 관리자 것으로 바꾼다.
 * manifest와 테마 빛깔과 아이폰이 읽는 로고다. 나갈 때는 되돌린다.
 *
 * 브라우저가 manifest를 다시 읽게 하려면 href만 고치는 것으로는 모자랄 때가
 * 있다. 줄 자체를 걷고 새로 꽂으면 어느 판에서나 다시 읽는다.
 *
 * 앱 이름이 갈리는 자리는 manifest의 id다. 사용자 쪽은 start_url이 "/"라
 * id가 "/"이고 여기는 "/admin"이라, 브라우저가 둘을 다른 앱으로 센다.
 */

const 관리자것 = {
  manifest: "/manifest-admin.json",
  테마: "#6B2CB8",
  로고: "/logo-mark-admin-180.png",
};

/**
 * 되돌릴 때 쓸 본디 값.
 *
 * 들어올 때마다 다시 적는다. 한 번만 적으면, 사이에 빛깔 벌을 갈아 끼워
 * 테마 빛깔이 바뀐 뒤에 나갈 때 낡은 값으로 되돌려 놓는다.
 */
let 본디: { manifest: string; 테마: string; 로고: string } | null = null;

function 줄찾기(sel: string): HTMLLinkElement | HTMLMetaElement | null {
  return document.head.querySelector(sel);
}

function 꽂기(sel: string, 속성: "href" | "content", 값: string): void {
  const 옛것 = 줄찾기(sel);
  if (!옛것) return;
  const 새것 = 옛것.cloneNode(false) as HTMLLinkElement | HTMLMetaElement;
  새것.setAttribute(속성, 값);
  옛것.replaceWith(새것);
}

/** 관리자 것으로 바꾼다. */
export function 관리자앱입히기(): void {
  const m = 줄찾기('link[rel="manifest"]') as HTMLLinkElement | null;
  const t = 줄찾기('meta[name="theme-color"]') as HTMLMetaElement | null;
  const l = 줄찾기('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
  본디 = {
    manifest: m?.getAttribute("href") ?? "/manifest.json",
    테마: t?.getAttribute("content") ?? "#ffffff",
    로고: l?.getAttribute("href") ?? "/logo-mark-180.png",
  };
  꽂기('link[rel="manifest"]', "href", 관리자것.manifest);
  꽂기('meta[name="theme-color"]', "content", 관리자것.테마);
  꽂기('link[rel="apple-touch-icon"]', "href", 관리자것.로고);
}

/** 본디 것으로 되돌린다. */
export function 관리자앱벗기기(): void {
  if (!본디) return;
  꽂기('link[rel="manifest"]', "href", 본디.manifest);
  꽂기('meta[name="theme-color"]', "content", 본디.테마);
  꽂기('link[rel="apple-touch-icon"]', "href", 본디.로고);
}
