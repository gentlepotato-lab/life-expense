import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useBackClose from "../../hooks/useBackClose";

/**
 * 제목 옆의 ⓘ와, 거기서 뜨는 안내 쪽지.
 *
 * 안내 한 줄은 그동안 제목 밑에 늘 적혀 있었다. 그 줄이 길어서 만년필 자국이
 * 쓸 수 있는 자리가 화면마다 달랐고(PenMark.tsx), 가장 긴 안내(설정 첫 화면)에
 * 맞추느라 자국은 103px까지밖에 못 늘였다. 글을 쪽지 안으로 들이고 그 자리를
 * 자국에 내준다.
 *
 * 쪽지는 다른 팝업과 같은 틀(popup-panel)을 쓰지 않는다. 거르개나 고르개는
 * 손으로 만지는 자리라 네모와 단추가 반듯해야 하지만, 이쪽은 읽고 닫는 자리다.
 * 공책에서 한 장 뜯어 테이프로 붙인 꼴로 두어, 손대는 팝업과 읽는 쪽지가
 * 눈으로 갈린다.
 *
 * 사용자 사이트와 관리자 사이트가 같은 조각을 쓴다. 두 쪽이 저마다 그리면
 * 한쪽만 고치게 된다.
 */

/**
 * 안내 한 줄을 조각으로 가른다.
 *
 * 중괄호로 감싼 말은 다른 화면의 이름이라 조금 짙게 세운다. 누를 수 있는
 * 것은 아니므로 단추나 링크로 만들지 않는다. 가리키기만 한다.
 *
 * split에 묶음(괄호)을 쓰면 가른 자리의 알맹이도 함께 끼어 나온다. 짝수
 * 자리가 보통 글, 홀수 자리가 화면 이름이다.
 */
function 안내조각(안내: string) {
  return 안내.split(/\{([^}]+)\}/).map((조각, i) =>
    i % 2 === 0 ? (
      조각
    ) : (
      <em key={i} className="page-note__at">
        {조각}
      </em>
    )
  );
}

/**
 * 쪽지를 붙일 자리.
 *
 * 쪽의 몸통 안에 붙인다. 빛깔 토막이 거기 걸려 있기 때문이다 — 관리자
 * 사이트는 보라 한 결로 서는데(.page-wrap.admin) 몸통 밖에 붙이면 그 결을
 * 물려받지 못해 사용자 쪽 빛깔로 뜬다. 몸통이 아직 없으면 바탕에 붙인다.
 */
function 쪽지자리(): HTMLElement {
  return document.querySelector<HTMLElement>(".page-wrap") ?? document.body;
}

export default function PageNote({ 제목, 안내 }: { 제목: string; 안내: string }) {
  const [열렸나, set열렸나] = useState(false);
  const 쪽지ref = useRef<HTMLDivElement | null>(null);

  /* 뒤로 가기와 Esc로도 닫는다. 다른 팝업과 같은 잣대다. */
  useBackClose(열렸나, () => set열렸나(false));

  /* 열면 쪽지가 초점을 받는다. autoFocus 는 글 칸에만 걸리므로 여기서 옮긴다. */
  useEffect(() => {
    if (열렸나) 쪽지ref.current?.focus();
  }, [열렸나]);

  /* 떠 있는 동안 뒤쪽이 굴러가지 않게 한다. */
  useEffect(() => {
    if (!열렸나) return;
    document.documentElement.classList.add("modal-open");
    return () => document.documentElement.classList.remove("modal-open");
  }, [열렸나]);

  return (
    <>
      <button
        type="button"
        className="page-note-dot"
        aria-label={`${제목} 안내`}
        aria-expanded={열렸나}
        onClick={() => set열렸나(true)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10.6v5.6" />
          <path d="M12 7.6h.01" />
        </svg>
      </button>

      {/* 머리말은 굴릴 때 통째로 밀려 올라간다(html.pin-off .page-head.is-pinned).
          그 transform 이 걸린 조상은 제 안의 position: fixed 를 가두므로, 쪽지는
          몸통에 바로 붙여 띄운다. */}
      {열렸나 &&
        createPortal(
          <div
            className="note-pop"
            role="presentation"
            onClick={() => set열렸나(false)}
          >
            <div
              className="note-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={`${제목} 안내`}
              /* 열면 쪽지가 초점을 받는다. 닫는 단추에 주면 그 단추만 테를
                 두르고 떠, 종이 위에서 그 자리가 따로 논다. */
              tabIndex={-1}
              ref={쪽지ref}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 테이프는 종이 밖에 둔다. 종이는 아래 끝이 뜯긴 꼴이라 제
                  테두리를 잘라 내는데(clip-path), 그 자름은 안에 든 것까지
                  함께 자른다. 종이 안에 두었더니 위로 걸친 토막이 잘려
                  나갔다. */}
              <span className="note-sheet__tape" aria-hidden="true" />
              <div className="note-sheet__paper">
                <span className="note-sheet__hole note-sheet__hole--up" aria-hidden="true" />
                <span className="note-sheet__hole note-sheet__hole--down" aria-hidden="true" />
                <h3 className="note-sheet__title">{제목}</h3>
                <p className="note-sheet__text">{안내조각(안내)}</p>
                <div className="note-sheet__foot">
                  <button
                    type="button"
                    className="note-sheet__ok"
                    onClick={() => set열렸나(false)}
                  >
                    OK~
                  </button>
                </div>
              </div>
            </div>
          </div>,
          쪽지자리()
        )}
    </>
  );
}
