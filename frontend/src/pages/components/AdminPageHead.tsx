import { useLocation, useNavigate } from "react-router-dom";
import { 탭찾기, 쪽찾기 } from "../../utils/adminTabs";

/**
 * 관리자 사이트의 쪽 머리말.
 *
 * 사용자 사이트의 머리말과 같은 짜임, 같은 클래스다(PageHead.tsx). 제목이
 * 먼저 서고, 안내 한 줄이 풀어 주고, 갈래 알약이 그 탭의 페이지를 늘어놓는
 * 차례다.
 *
 * 틀이 한 번만 그리므로(pages/Admin.tsx) 페이지를 옮겨도 알약은 자리만
 * 옮긴다. 페이지마다 저가 그리면 옮길 때마다 새로 만들어져, 알약이 미끄러질
 * 과거가 없어진다.
 *
 * 탭 첫 쪽에는 알약을 두지 않는다. 거기는 칸으로 들어가는 자리이고, 사용자
 * 사이트의 내역 탭과 설정 탭 첫 쪽도 알약 없이 선다.
 *
 * 메인 탭 첫 쪽에는 서비스 이름이 제목 자리에 서고, 그 옆에 갈래가 붙는다.
 * 사용자 사이트의 홈과 같은 자리다.
 *
 * 만년필 자국은 가져오지 않는다. 사용자 사이트의 꾸밈이라 관리자 쪽까지
 * 흔들면 두 사이트가 섞여 보인다.
 */
export default function AdminPageHead() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const 탭 = 탭찾기(pathname);
  const 쪽 = 쪽찾기(pathname);
  if (!탭) return null;

  /* 탭 첫 쪽이면 탭의 제목과 한 줄, 페이지면 그 페이지의 것. */
  const 제목 = 쪽 ? 쪽.name : 탭.title;
  const 갈래 = 쪽 ? "" : 탭.kind;
  const 안내 = 쪽 ? 쪽.note : 탭.note;
  const 알약들 = 쪽 ? 탭.pages : null;
  /* 곁가지는 어미를 켠 것으로 둔다. 알약에 제 자리가 없어 아무것도 켜지
     않으면, 카드에서 들어온 쪽에서만 알약이 모두 꺼져 보인다. */
  const 켠길 = 쪽?.under ?? pathname;
  const 켠곳 = 알약들 ? 알약들.findIndex((p) => p.path === 켠길) : -1;

  return (
    <header className="page-head">
      {제목 && (
        <div className="page-head__row">
          {/* 글자만 기울이고 네모 바탕은 반듯하게 두려면 한 겹이 더 있어야
              한다. 사용자 사이트의 제목과 같은 짜임이다. */}
          <h1 className="page-title">
            <span className="page-title__in">{제목}</span>
          </h1>
          {/* 갈래는 음영 밖에 선다. 사용자 사이트의 머리말에는 없는 자리라
              이 쪽에서만 더한다. */}
          {갈래 && <span className="admin-head__kind">{갈래}</span>}
        </div>
      )}

      {안내 && (
        <p className="page-note">
          {안내}
          {/* 주소 딱지. 화면을 캡처해 놓고 나중에 볼 때 어느 사이트인지
              알아보게 하는 표다.

              안내 줄 오른쪽 끝에 띄워서 얹는다. 제목 옆에 달던 때는 탭마다
              제목 폭이 달라(돈을 쓰다 관리자, 화면, 서버, 계정) 딱지가
              75px에서 163px 사이를 오갔다. 띄워 얹으므로 머리말 키도 안내
              줄의 자리도 그대로다 — 사용자 사이트가 만년필 자국을 얹는 것과
              같은 잣대다(.page-doodle).

              제목 줄 오른쪽 끝에는 두지 않는다. 떠 있는 새로 고침 단추가
              그 자리를 덮어 딱지가 반쯤 가렸다. */}
          {!쪽 && <span className="admin-path-tag">/admin</span>}
        </p>
      )}

      {알약들 && (
        <div
          className="subtabs"
          role="tablist"
          /* 갈래 수가 탭마다 다르다(사용 셋, 계정 둘). 알약 폭을 여기서
             알려 줘야 CSS가 맞춰 자를 수 있다. */
          style={{ "--tab-n": 알약들.length } as React.CSSProperties}
        >
          {/* 켜진 갈래를 덮는 알약 하나. 자리만 옮기므로 미끄러진다. */}
          <span
            className="subtabs__thumb"
            style={{ transform: `translate3d(${Math.max(켠곳, 0) * 100}%, 0, 0)` }}
            aria-hidden="true"
          />
          {알약들.map((p) => (
            <button
              key={p.path}
              type="button"
              role="tab"
              aria-selected={p.path === 켠길}
              className={`subtabs__item${p.path === 켠길 ? " on" : ""}`}
              onClick={() => p.path !== pathname && navigate(p.path)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
