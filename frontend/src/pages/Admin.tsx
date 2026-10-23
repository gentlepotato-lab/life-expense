import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { say, ask } from "../utils/notify";
import { 자물쇠상태, 들어가기, 나가기, 토큰, 암호바꾸기, on끊김 } from "../utils/adminAuth";
import { 관리자앱입히기, 관리자앱벗기기 } from "../utils/adminPwa";
import RefreshIcon from "./components/RefreshIcon";
import EyeIcon from "./components/EyeIcon";
import ScrollTopButton from "./components/ScrollTopButton";
import AdminPageHead from "./components/AdminPageHead";
import AdminTabBar from "./components/AdminTabBar";
import useHeadPin from "../hooks/useHeadPin";
/* 쪽들은 이 묶음에 함께 담는다. 쪽마다 따로 쪼개면 어느 쪽에 처음 들어갈
   때마다 기다리는 자리가 한 번 뜨고, 그러면 React 가 알맹이를 300ms 뒤에야
   보여 준다. 관리자 쪽은 들어오는 사람이 하나뿐이라 한 묶음으로 받는 편이
   낫다(App.tsx). */
import AdminMain from "./AdminMain";
import AdminTabHome from "./AdminTabHome";
import AdminDash from "./components/AdminDash";
import AdminLogs from "./components/AdminLogs";
import AdminLogDetail from "./components/AdminLogDetail";
import AdminNotices from "./components/AdminNotices";
import AdminNoticeDetail from "./components/AdminNoticeDetail";
import { AdminDoodle, AdminMenu } from "./components/AdminToggles";
import AdminBatch from "./components/AdminBatch";
import AdminBatchRuns from "./components/AdminBatchRuns";
import AdminApis from "./components/AdminApis";
import AdminApiDetail from "./components/AdminApiDetail";
import AdminDb from "./components/AdminDb";
import AdminDbDetail from "./components/AdminDbDetail";
import AdminLoginLog from "./components/AdminLoginLog";
import AdminSoon from "./components/AdminSoon";

/**
 * 관리자 페이지.
 *
 * 메뉴에 띄우지 않는다. 주소를 치고 들어와 비밀번호를 넣어야 열린다.
 *
 * 사용자 화면과 섞이지 않게 틀을 따로 둔다. 떠 있는 단추 넷도 아래 이동
 * 막대도 띄우지 않는다. 같은 틀을 쓰면 잔소리 종이 관리자 화면 위에도 떠서,
 * 거기서 내역을 적을 수 있게 된다.
 *
 * 생김새는 앱 것을 그대로 쓴다. 빛깔과 글꼴과 여백과 모서리를 같은 토큰에서
 * 꺼내 쓰고, 카드는 .card, 단추는 .ui-btn, 알약은 .subtabs를 쓴다. 다른 것은
 * 셋뿐이다. 제목을 묶는 연보라 네모와 /admin 딱지와 떠 있는 단추다.
 *
 * 손전화를 기준으로 짠다. 자리 다섯은 가로 알약 한 줄이고, 넓어져도 그대로
 * 가운데에 선다(index.css 186절).
 */

export default function Admin() {
  const [열림, set열림] = useState(() => !!토큰());
  const [걸림, set걸림] = useState<boolean | null>(null);
  const [첫암호있나, set첫암호있나] = useState(false);
  const [암호, set암호] = useState("");

  /* 지금 어느 자리인가는 주소가 쥔다. 상태로 들고 있던 때는 새로 고치면
     첫 자리로 돌아갔고, 뒤로 가기도 관리자 화면을 통째로 떠났다.
     자리마다 길이 있으므로 즐겨찾기도 걸리고 기록도 ViewTracker가 적는다. */
  const { pathname } = useLocation();
  /* 메인 탭의 첫 쪽인가. 홈 표가 여기에 걸린다. */
  const 메인쪽 = pathname === "/admin";

  /* 내릴 때 머리띠와 알약이 함께 올라가고, 올릴 때 다시 내려온다. 사용자
     화면과 같은 장치를 쓴다(hooks/useHeadPin.ts). 거기는 PageHead가 부르는데
     관리자 화면에는 그 머리말이 없으므로 여기서 부른다. */
  useHeadPin();

  /* 브라우저 탭 제목. 두 사이트가 한 글자로 갈린다 — 사용자 쪽은
     「돈을 쓰다」, 이쪽은 「돈을 쓰다(admin)」이다. 쪽 이름은 적지 않는다.
     탭에 보이는 자리가 좁아 앞의 몇 글자만 뜨는데, 거기에 쪽 이름이 먼저
     서면 탭 여럿을 열어 놓았을 때 어느 것이 어느 사이트인지 알 수 없다.

     자리를 옮길 때마다 다시 적는다. 한 번만 적으면 다른 자리가 덮어쓸 때
     되돌릴 길이 없다. */
  useEffect(() => {
    document.title = "돈을 쓰다(admin)";
  }, [pathname]);

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
    /* 머리말의 안내 한 줄. 카드 안에 적던 것을 올렸다. 다른 쪽은 모두 제목
       밑에 한 줄이 서는데 이 쪽만 그 자리가 비어, 주소 딱지가 설 자리도
       없었다. 카드의 제목도 함께 걷었다. 바로 위에 「돈을 쓰다 관리자」가
       서 있어 같은 말이 두 번이었다. */
    const 안내 =
      걸림 === null
        ? "확인하는 중입니다."
        : 걸림
          ? "비밀번호를 넣어 주세요."
          : 첫암호있나
            ? "처음 로그인합니다. 환경 변수에 적은 비밀번호를 넣어 주세요."
            : "비밀번호가 정해져 있지 않습니다. 서버의 환경 변수부터 적어 주세요.";

    return (
      <div className="page-wrap admin">
        <AdminHead 안내={안내} />
        <AdminRefresh />
        <div className="card admin-gate">
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
    <div className={`page-wrap admin${메인쪽 ? " home" : ""}`}>
      {/* 제목과 안내 한 줄과 갈래 알약. 사용자 사이트의 머리말과 같은
          조각, 같은 차례다(AdminPageHead.tsx). 메인 탭의 첫 쪽에는 서비스
          이름이 제목으로 선다. */}
      <AdminPageHead />

      {/* 떠 있는 단추는 붙박이로 세는 것들 뒤에 둔다. 머리띠와 머리말
          사이에 끼면 useHeadPin이 거기서 집계를 멈춘다. */}
      <AdminRefresh />

      {/* 자리를 옮길 때 알맹이만 살짝 갈린다. key를 걸면 길이 바뀔 때마다
          새로 그려지고, 그때 한 번 애니메이션이 돈다. 머리말과 알약은 이
          밖에 있으므로 흔들리지 않는다.

          쪽을 여기서 가른다. 바깥(App.tsx)이 /admin/* 하나만 들고 있으므로
          아래 길은 /admin 에서부터 센다. 로그아웃은 비밀번호 쪽만 쓰므로
          그 쪽에만 내려보낸다. */}
      <div className="admin-pane" key={pathname}>
        <Routes>
          {/* 메인 탭(사용)의 첫 쪽. 홈처럼 생겼고 서비스 이름이 제목으로 선다. */}
          <Route path="/" element={<AdminMain />} />
          <Route path="dash" element={<AdminDash />} />
          <Route path="logs" element={<AdminLogs />} />
          {/* 줄을 눌러 들어가는 곁가지. 갈래 알약에는 서지 않는다
              (utils/adminTabs.ts의 곁가지). */}
          <Route path="log-detail" element={<AdminLogDetail />} />
          <Route path="users" element={<AdminSoon />} />

          {/* 화면 탭 */}
          <Route path="screen" element={<AdminTabHome />} />
          <Route path="notice" element={<AdminNotices />} />
          <Route path="notice-detail" element={<AdminNoticeDetail />} />
          <Route path="doodle" element={<AdminDoodle />} />
          <Route path="menu" element={<AdminMenu />} />

          {/* 서버 탭 */}
          <Route path="server" element={<AdminTabHome />} />
          <Route path="batch" element={<AdminBatch />} />
          {/* 배치 카드에서만 들어가는 곁가지. 갈래 알약에는 서지 않는다
              (utils/adminTabs.ts의 곁가지). */}
          <Route path="batch-runs" element={<AdminBatchRuns />} />
          <Route path="api" element={<AdminApis />} />
          <Route path="api-detail" element={<AdminApiDetail />} />
          <Route path="db" element={<AdminDb />} />
          <Route path="db-detail" element={<AdminDbDetail />} />

          {/* 계정 탭 */}
          <Route path="account" element={<AdminTabHome />} />
          <Route path="pw" element={<AdminPasswordBody onLogout={() => void 나감()} />} />
          <Route path="login-log" element={<AdminLoginLog />} />

          {/* 모르는 자리는 메인 탭으로. */}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>

      {/* 맨 위로. 사용자 화면과 같은 자리, 같은 생김새다. */}
      <ScrollTopButton />

      {/* 아래 이동 막대. 사용자 사이트의 것과 같은 조각이다(AdminTabBar.tsx).
          막대에 가려지는 만큼 쪽 아래를 비우는 일은 CSS가 맡는다. */}
      <AdminTabBar />
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
 * 자물쇠 화면의 머리말.
 *
 * 들어오고 나면 등록부를 보고 그 쪽의 제목을 그리는 조각이 맡는다
 * (AdminPageHead.tsx). 자물쇠 화면은 어느 쪽도 아니라 거기 기댈 수 없어
 * 여기서 서비스 이름을 적는다.
 *
 * 생김새는 다른 쪽의 제목과 같다. 전에는 보라 띠를 깔고 흰 글씨를 썼는데,
 * 그 띠만 다른 쪽과 달라 제목이 선 자리도 함께 어긋났다.
 */
function AdminHead({ 안내 }: { 안내: string }) {
  return (
    <header className="page-head">
      <div className="page-head__row">
        <h1 className="page-title">
          <span className="page-title__in">돈을 쓰다</span>
        </h1>
        <span className="admin-head__kind">관리자</span>
      </div>

      {/* 안내 한 줄과, 그 줄 오른쪽 끝의 주소 딱지. 다른 쪽의 머리말과 같은
          조각, 같은 자리다(AdminPageHead.tsx). 제목 줄 오른쪽 끝에 달던
          때는 떠 있는 새로 고침 단추가 그 자리를 덮었고, 쪽마다 제목 폭이
          달라 딱지가 오갔다. */}
      <p className="page-note">
        {안내}
        <span className="admin-path-tag">/admin</span>
      </p>
    </header>
  );
}

function AdminPasswordBody({ onLogout }: { onLogout: () => void }) {
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
