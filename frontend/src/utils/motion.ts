/**
 * 화면이 움직일지 말지.
 *
 * 끄는 것은 움직임뿐이다. 누르면 열리고, 열리면 보이고, 담으면 담긴다 —
 * 하는 일은 하나도 달라지지 않는다. 다만 미끄러지고 떠오르고 번지는 동안이
 * 사라져, 끝난 자리가 곧바로 선다.
 *
 * 켬·끔을 `<html>`에 적어 두고 규칙 쪽에서 그것을 본다(index.css 160절).
 * 움직임을 하나하나 끄는 대신 한 자리에 모아 둔 까닭은, 새로 만드는 움직임이
 * 저절로 이 스위치를 따르게 하려는 것이다 — 끌 자리를 잊어도 꺼진다.
 *
 * 다만 꾹 누르기 진행 표시는 남긴다. 그것은 꾸밈이 아니라 "언제 팝업이
 * 열리는지"를 알려주는 기능적 신호라서, 없으면 아무 반응 없이 팝업만
 * 튀어나온다. 끄더라도 기능은 되어야 한다는 말이 그 뜻이다.
 *
 * 앞머리 로고는 이 파일이 손대지 않는다. 그것은 첫 칠보다 먼저 서야 해서
 * index.html이 제 손으로 표시를 붙이고 제 규칙으로 세워 둔다.
 */

/** 움직임이 켜져 있는가 — 담아 둔 값이 `"0"`일 때만 꺼진다. */
export const motionOn = (value: string | null | undefined): boolean => value !== "0";

/** 화면 전체에 켬·끔을 끼운다. */
export function applyMotion(value: string | null | undefined): void {
  const root = document.documentElement;
  if (motionOn(value)) delete root.dataset.motion;
  else root.dataset.motion = "off";
}

/**
 * 굴러갈지 건너뛸지.
 *
 * 부드럽게 굴리는 것은 animation도 transition도 아니라 규칙 한 줄로는 꺼지지
 * 않는다. 코드에서 굴리는 자리는 이것을 물어보고 간다. 끄더라도 가기는 간다 —
 * 가는 동안이 없어질 뿐이다.
 */
export const scrollEase = (): ScrollBehavior =>
  document.documentElement.dataset.motion === "off" ? "auto" : "smooth";
