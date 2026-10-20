import { useCallback, useEffect, useState } from "react";
import { say } from "../utils/notify";
import { 자물쇠상태, 들어가기, 나가기, 토큰, 암호바꾸기 } from "../utils/adminAuth";
import AdminDash from "./components/AdminDash";

/**
 * 관리자 페이지.
 *
 * 메뉴에 띄우지 않는다. 주소를 치고 들어와 암호를 넣어야 열린다.
 *
 * 사용자 화면과 섞이지 않게 틀을 따로 둔다 — 떠 있는 단추 넷도 아래 이동
 * 막대도 띄우지 않는다. 같은 틀을 쓰면 잔소리 종이 관리자 화면 위에도 떠서,
 * 거기서 내역을 적을 수 있게 된다.
 *
 * 생김새는 앱 것을 그대로 쓴다. 빛깔과 글꼴과 여백과 모서리를 같은 토큰에서
 * 꺼내 쓰고, 카드는 .card, 단추는 .ui-btn, 알약은 .subtabs를 쓴다. 다른 것은
 * 넷뿐이다 — 머리띠, /admin 딱지, 떠 있는 단추 없음, 바닥 탭 없음.
 *
 * 손전화를 기준으로 짠다. 자리 다섯은 가로로 넘기는 알약이고, 넓어지면
 * 왼쪽으로 간다(index.css 186절).
 */

/** 관리자 페이지의 자리들. 더하면 알약이 하나 늘어난다. */
const 자리들 = [
  { key: "dash", name: "대시보드" },
  { key: "notice", name: "공지사항" },
  { key: "doodle", name: "애니메이션 문구" },
  { key: "menu", name: "메뉴 On/Off" },
  { key: "pw", name: "암호 바꾸기" },
] as const;

type 자리 = (typeof 자리들)[number]["key"];

export default function Admin() {
  const [열림, set열림] = useState(() => !!토큰());
  const [걸림, set걸림] = useState<boolean | null>(null);
  const [첫암호있나, set첫암호있나] = useState(false);
  const [암호, set암호] = useState("");
  const [자리, set자리] = useState<자리>("dash");

  /* 브라우저 탭 제목도 맞춘다. 화면을 캡처해 놓고 나중에 볼 때 어느 쪽인지
     헷갈리지 않게 한다. */
  useEffect(() => {
    document.title = "관리자 · 돈을 쓰다";
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
      say.warn("암호를 적어 주세요.");
      return;
    }
    try {
      await 들어가기(암호);
      set암호("");
      set열림(true);
    } catch {
      say.warn("암호가 맞지 않습니다.");
    }
  }, [암호]);

  const 나감 = useCallback(async () => {
    await 나가기();
    set열림(false);
  }, []);

  /* ── 암호를 묻는 자리 ──────────────────────────────── */
  if (!열림) {
    return (
      <div className="page-wrap admin">
        <AdminHead onLogout={null} />
        <div className="card admin-gate">
          <h2 className="admin-gate__title">관리자 페이지</h2>
          <p className="admin-gate__note">
            {걸림 === null
              ? "자물쇠를 확인하고 있습니다."
              : 걸림
                ? "암호를 넣어 주세요."
                : 첫암호있나
                  ? "처음 들어가는 자리입니다. 환경 변수에 적은 암호를 넣어 주세요."
                  : "암호가 정해져 있지 않습니다. 서버의 환경 변수부터 적어 주세요."}
          </p>
          <input
            type="password"
            className="admin-gate__input"
            value={암호}
            onChange={(e) => set암호(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void 들어감();
            }}
            placeholder="암호"
            autoComplete="current-password"
          />
          <button type="button" className="ui-btn primary" onClick={() => void 들어감()}>
            들어가기
          </button>
        </div>
      </div>
    );
  }

  /* ── 들어온 뒤 ─────────────────────────────────────── */
  return (
    <div className="page-wrap admin">
      <AdminHead onLogout={() => void 나감()} />

      <nav className="subtabs admin-tabs" aria-label="관리자 자리">
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

      {자리 === "dash" ? (
        <AdminDash />
      ) : 자리 === "pw" ? (
        <AdminPassword />
      ) : (
        <div className="card admin-soon">
          <p className="page-empty">{자리들.find((t) => t.key === 자리)?.name}는 아직 비어 있습니다.</p>
        </div>
      )}
    </div>
  );
}

/** 머리띠. 사용자 화면과 가르는 유일한 표시다. */
function AdminHead({ onLogout }: { onLogout: (() => void) | null }) {
  return (
    <header className="admin-head">
      <span className="admin-head__title">돈을 쓰다 · 관리자</span>
      <span className="admin-head__tag">/admin</span>
      {onLogout && (
        <button type="button" className="admin-head__out" onClick={onLogout}>
          나가기
        </button>
      )}
    </header>
  );
}

/** 암호 바꾸기. 바꾸면 들어와 있던 자리가 모두 걷힌다. */
function AdminPassword() {
  const [새것, set새것] = useState("");
  const [다시, set다시] = useState("");

  const 바꿈 = async () => {
    if (새것.length < 8) {
      say.warn("암호는 여덟 자 이상으로 적어 주세요.");
      return;
    }
    if (새것 !== 다시) {
      say.warn("두 번 적은 암호가 서로 다릅니다.");
      return;
    }
    try {
      await 암호바꾸기(새것);
      say.ok("암호를 바꿨습니다. 다시 들어와 주세요.");
      window.location.reload();
    } catch {
      say.bad("암호를 바꾸지 못했습니다.");
    }
  };

  return (
    <div className="card admin-pw">
      <p className="admin-pw__note">
        바꾸면 들어와 있던 자리가 모두 걷힙니다. 다른 기기에 열려 있던 것도 함께 닫힙니다.
      </p>
      <input
        type="password"
        className="admin-gate__input"
        value={새것}
        onChange={(e) => set새것(e.target.value)}
        placeholder="새 암호"
        autoComplete="new-password"
      />
      <input
        type="password"
        className="admin-gate__input"
        value={다시}
        onChange={(e) => set다시(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void 바꿈();
        }}
        placeholder="새 암호 다시"
        autoComplete="new-password"
      />
      <button type="button" className="ui-btn primary" onClick={() => void 바꿈()}>
        바꾸기
      </button>
    </div>
  );
}
