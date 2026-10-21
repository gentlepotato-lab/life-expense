import { useCallback, useEffect, useState } from "react";
import type React from "react";
import { say, ask } from "../utils/notify";
import { 자물쇠상태, 들어가기, 나가기, 토큰, 암호바꾸기, on끊김 } from "../utils/adminAuth";
import { 관리자앱입히기, 관리자앱벗기기 } from "../utils/adminPwa";
import AdminDash from "./components/AdminDash";
import RefreshIcon from "./components/RefreshIcon";
import EyeIcon from "./components/EyeIcon";
import ScrollTopButton from "./components/ScrollTopButton";
import useHeadPin from "../hooks/useHeadPin";
import AdminNotices from "./components/AdminNotices";
import { AdminMenu, AdminDoodle } from "./components/AdminToggles";

/**
 * 관리자 페이지.
 *
 * 메뉴에 띄우지 않는다. 주소를 치고 들어와 비밀번호를 넣어야 열린다.
 *
 * 사용자 화면과 섞이지 않게 틀을 따로 둔다 — 떠 있는 단추 넷도 아래 이동
 * 막대도 띄우지 않는다. 같은 틀을 쓰면 잔소리 종이 관리자 화면 위에도 떠서,
 * 거기서 내역을 적을 수 있게 된다.
 *
 * 생김새는 앱 것을 그대로 쓴다. 빛깔과 글꼴과 여백과 모서리를 같은 토큰에서
 * 꺼내 쓰고, 카드는 .card, 단추는 .ui-btn, 알약은 .subtabs를 쓴다. 다른 것은
 * 넷뿐이다 — 머리띠, /admin 딱지, 떠 있는 단추 없음, 바닥 탭 없음.
 *
 * 손전화를 기준으로 짠다. 자리 다섯은 가로 알약 한 줄이고, 넓어져도 그대로
 * 가운데에 선다(index.css 186절).
 */

/** 관리자 페이지의 자리들. 더하면 알약이 하나 늘어난다.
 *
 * 이름이 짧은 까닭은 알약이 가로를 똑같이 나눠 갖기 때문이다. 손전화에서
 * 다섯 칸이면 한 칸이 75px이라, 긴 이름은 칸을 넘어 오른쪽이 잘린다. */
const 자리들 = [
  { key: "dash", name: "대시보드" },
  { key: "notice", name: "공지" },
  { key: "doodle", name: "문구" },
  { key: "menu", name: "메뉴" },
  { key: "pw", name: "비밀번호" },
] as const;

type 자리 = (typeof 자리들)[number]["key"];

export default function Admin() {
  const [열림, set열림] = useState(() => !!토큰());
  const [걸림, set걸림] = useState<boolean | null>(null);
  const [첫암호있나, set첫암호있나] = useState(false);
  const [암호, set암호] = useState("");
  const [자리, set자리] = useState<자리>("dash");

  /* 내릴 때 머리띠와 알약이 함께 올라가고, 올릴 때 다시 내려온다. 사용자
     화면과 같은 장치를 쓴다(hooks/useHeadPin.ts). 거기는 PageHead가 부르는데
     관리자 화면에는 그 머리말이 없으므로 여기서 부른다. */
  useHeadPin();

  /* 브라우저 탭 제목도 맞춘다. 화면을 캡처해 놓고 나중에 볼 때 어느 쪽인지
     헷갈리지 않게 한다. */
  useEffect(() => {
    document.title = "돈을 쓰다 관리자";
  }, []);

  /* 토큰이 죽으면 자물쇠로 돌아간다.
     서버가 401로 돌려보내면 api/client.ts가 토큰을 걷고 여기로 알린다.
     그러지 않으면 목록마다 빈 채로 떠서, 적어 놓은 것이 사라진 줄 알게 된다.
     토큰은 여덟 시간이면 만료되므로 하루에 한 번은 겪는 길이다. */
  useEffect(() => on끊김(() => {
    set열림(false);
    set암호("");
    say.warn("로그인이 풀렸습니다. 다시 로그인해 주세요.");
  }), []);

  /* 손전화에 따로 깔리도록 머리의 manifest를 관리자 것으로 바꾼다.
     나갈 때 되돌리지 않으면 사용자 화면에서도 관리자 앱으로 깔린다. */
  useEffect(() => {
    관리자앱입히기();
    return 관리자앱벗기기;
  }, []);

  useEffect(() => {
    let 살아있나 = true;
    void 자물쇠상태()
      .then((s) => {
        if (!살아있나) return;
        set걸림(s.걸림);
        set첫암호있나(s.첫암호있나);
      })
      .catch(() => {
        if (살아있나) set걸림(false);
      });
    return () => {
      살아있나 = false;
    };
  }, []);

  const 들어감 = useCallback(async () => {
    if (!암호) {
      say.warn("비밀번호를 입력해 주세요.");
      return;
    }
    try {
      await 들어가기(암호);
      set암호("");
      set열림(true);
    } catch {
      say.warn("비밀번호가 맞지 않습니다.");
    }
  }, [암호]);

  const 나감 = useCallback(async () => {
    await 나가기();
    set열림(false);
  }, []);

  /* ── 비밀번호를 묻는 화면 ──────────────────────────── */
  if (!열림) {
    return (
      <div className="page-wrap admin">
        <AdminHead />
        <AdminRefresh />
        <div className="card admin-gate">
          <h2 className="admin-gate__title">관리자 페이지</h2>
          <p className="admin-gate__note">
            {걸림 === null
              ? "확인하고 있습니다."
              : 걸림
                ? "비밀번호를 넣어 주세요."
                : 첫암호있나
                  ? "처음 로그인합니다. 환경 변수에 적은 비밀번호를 넣어 주세요."
                  : "비밀번호가 정해져 있지 않습니다. 서버의 환경 변수부터 적어 주세요."}
          </p>
          <AdminPwField
            value={암호}
            onChange={set암호}
            onEnter={() => void 들어감()}
            placeholder="(비밀번호)"
            autoComplete="current-password"
          />
          <button type="button" className="ui-btn primary" onClick={() => void 들어감()}>
            로그인
          </button>
        </div>
      </div>
    );
  }

  /* ── 들어온 뒤 ─────────────────────────────────────── */
  return (
    <div className="page-wrap admin">
      <AdminHead />

      {/* 사용자 화면의 갈래 알약을 그대로 쓴다(PageHead.tsx 105줄). 칸 수를
          --tab-n으로 알려 주면 CSS가 폭을 맞춰 나누고, 켜진 자리를 덮는
          조각 하나가 미끄러진다. */}
      <nav
        className="subtabs admin-tabs"
        aria-label="관리자 메뉴"
        style={{ "--tab-n": 자리들.length } as React.CSSProperties}
      >
        <span
          className="subtabs__thumb"
          style={{ transform: `translate3d(${자리들.findIndex((t) => t.key === 자리) * 100}%, 0, 0)` }}
          aria-hidden="true"
        />
        {자리들.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`subtabs__item${자리 === t.key ? " on" : ""}`}
            onClick={() => set자리(t.key)}
          >
            {t.name}
          </button>
        ))}
      </nav>

      {/* 떠 있는 단추는 붙박이로 셈하는 것들 뒤에 둔다. 머리띠와 알약
          사이에 끼면 useHeadPin이 거기서 셈을 멈춘다. */}
      <AdminRefresh />

      {/* 자리를 옮길 때 알맹이만 살짝 갈린다. key를 걸면 자리가 바뀔
          때마다 새로 그려지고, 그때 한 번 애니메이션이 돈다. 머리띠와
          알약은 이 밖에 있으므로 흔들리지 않는다. */}
      <div className="admin-pane" key={자리}>
      {자리 === "dash" ? (
        <AdminDash />
      ) : 자리 === "notice" ? (
        <AdminNotices />
      ) : 자리 === "doodle" ? (
        <AdminDoodle />
      ) : 자리 === "menu" ? (
        <AdminMenu />
      ) : (
        <AdminPassword onLogout={() => void 나감()} />
      )}
      </div>

      {/* 맨 위로. 사용자 화면과 같은 자리, 같은 생김새다. */}
      <ScrollTopButton />
    </div>
  );
}

/**
 * 비밀번호 칸.
 *
 * 오른쪽 끝에 눈을 하나 달아, 적는 중인 글자를 보이거나 감춘다. 여덟 자
 * 이상을 손으로 치다 보면 어디서 틀렸는지 알 길이 없어서다.
 *
 * 칸 셋(들어갈 때 하나, 바꿀 때 두 개)이 같은 꼴이어야 하므로 여기 모은다.
 * 보임 여부는 칸마다 따로 쥔다. 새 비밀번호와 그 확인을 한 번에 여는 것이
 * 편해 보이지만, 그러면 확인 칸의 뜻이 없어진다.
 */
function AdminPwField({
  value,
  onChange,
  placeholder,
  autoComplete,
  onEnter,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  autoComplete: string;
  onEnter?: () => void;
}) {
  const [보임, set보임] = useState(false);
  return (
    <div className="admin-pw-field">
      <input
        type={보임 ? "text" : "password"}
        className="ui-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) onEnter();
        }}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="admin-eye"
        onClick={() => set보임((v) => !v)}
        aria-label={보임 ? "비밀번호 감추기" : "비밀번호 보기"}
        aria-pressed={보임}
      >
        <EyeIcon off={보임} />
      </button>
    </div>
  );
}

/**
 * 새로 고침 단추.
 *
 * 사용자 화면의 단추 넷 가운데 이것 하나만 가져온다(QuickActions.tsx).
 * 묶음과 단추의 클래스를 그대로 써서 생김새가 한 치도 어긋나지 않게 한다.
 * 빛깔은 currentColor를 타고 와 이 쪽의 보라를 따른다.
 *
 * 쓰기와 계산기와 잔소리는 가져오지 않는다. 관리자 화면에서 내역을 적을
 * 일이 없고, 잔소리 종이 여기 뜨면 사용자 화면과 섞인다.
 *
 * 띠 오른쪽을 덮으므로 띠에는 오른쪽에 설 것을 두지 않는다. 로그아웃은
 * 비밀번호 자리로 옮겼다.
 */
function AdminRefresh() {
  return (
    <div className="quick-actions">
      <button
        type="button"
        className="calculator-trigger-button refresh-trigger-button"
        onClick={() => window.location.reload()}
        aria-label="새로 고침"
      >
        <RefreshIcon />
      </button>
    </div>
  );
}

/**
 * 머리띠. 사용자 화면과 가르는 유일한 표시다.
 *
 * 로그아웃은 여기 두지 않는다. 떠 있는 새로 고침 단추가 띠 오른쪽을 덮어서,
 * 자리를 내주려면 띠 여백을 벌려야 했고 그러면 로그아웃이 오른쪽 끝에서
 * 멀찍이 떨어져 어중간하게 섰다. 비밀번호 자리로 옮겼다. 하루에 한 번
 * 누를까 말까 한 단추라 늘 떠 있을 까닭도 없다.
 */
function AdminHead() {
  return (
    <header className="admin-head">
      <span className="admin-head__title">
        <span className="admin-head__in">돈을 쓰다</span>
      </span>
      <span className="admin-head__kind">관리자</span>
      <span className="admin-head__tag">/admin</span>
    </header>
  );
}

/** 비밀번호 변경. 바꾸면 로그인해 있던 기기가 모두 로그아웃된다. */
function AdminPassword({ onLogout }: { onLogout: () => void }) {
  const [새것, set새것] = useState("");
  const [다시, set다시] = useState("");

  const 바꿈 = async () => {
    if (새것.length < 8) {
      say.warn("비밀번호는 여덟 자 이상이어야 합니다.");
      return;
    }
    if (새것 !== 다시) {
      say.warn("두 번 넣은 비밀번호가 서로 다릅니다.");
      return;
    }
    /* 되묻는다. 바꾸면 들어와 있던 기기가 모두 끊기므로, 손이 미끄러져
       눌렸을 때 그대로 나가지 않게 한 겹 둔다. 사용자 화면이 되돌릴 수 없는
       일에 두는 것과 같은 꼴이다(utils/notify.ts의 ask). */
    const 할까 = await ask({
      title: "비밀번호 변경",
      body: "비밀번호를 변경할까요?",
      warn: "로그인해 있던 기기에서 모두 로그아웃됩니다.",
      go: "변경",
      danger: true,
    });
    if (!할까) return;
    try {
      await 암호바꾸기(새것);
      say.ok("저장 완료-!! ;-) 다시 로그인해 주세요.");
      window.location.reload();
    } catch {
      say.bad("저장하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  return (
    <div className="admin-edit">
      <div className="cat-card admin-box admin-pair">
      <section className="admin-group admin-pw">
      <h3 className="admin-card__title">비밀번호 변경</h3>
      <p className="admin-pw__note">
        변경하면 로그인해 있던 기기에서 모두 로그아웃됩니다.
      </p>
      <AdminPwField
        value={새것}
        onChange={set새것}
        placeholder="(새 비밀번호)"
        autoComplete="new-password"
      />
      <AdminPwField
        value={다시}
        onChange={set다시}
        onEnter={() => void 바꿈()}
        placeholder="(다시 한 번)"
        autoComplete="new-password"
      />
      <div className="admin-row admin-row--end">
        <button type="button" className="ui-btn primary" onClick={() => void 바꿈()}>
          변경
        </button>
      </div>
      </section>

      {/* 로그아웃. 머리띠에서 여기로 옮겼다. 이 기기의 토큰만 걷으므로
          다른 기기에 열려 있는 것은 그대로다. */}
      <section className="admin-group">
        <h3 className="admin-card__title">로그아웃</h3>
        <p className="admin-hint">이 기기에서만 나갑니다.</p>
        <div className="admin-row admin-row--end">
          <button type="button" className="ui-btn" onClick={onLogout}>
            로그아웃
          </button>
        </div>
      </section>
      </div>
    </div>
  );
}
