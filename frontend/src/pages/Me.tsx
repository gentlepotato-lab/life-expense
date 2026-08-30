import { useEffect, useState } from "react";
import axios from "../api/client";
import { apiErrorMessage } from "../utils/apiError";
import QuickActions from "./components/QuickActions";
import EmojiPicker from "./components/EmojiPicker";
import SingleSelect from "./components/SingleSelect";
import { formatDateLabel } from "../utils/dateGroup";
import { putPrefs } from "../utils/prefs";

/**
 * 돈쓴이 — 쓰는 사람과 앱 자신.
 *
 * 다른 화면이 모두 돈에 대한 것이라면 여기는 사람에 대한 것이다.
 * 누구인가 · 얼마나 함께했나 · 어떤 버릇이 있나 · 어떻게 볼까 · 어떻게 내려받나.
 *
 * 프로필 칸은 바깥 인증(구글·카카오)이 돌려주는 것에 맞춰 두었다. 아직 로그인이
 * 없어 손으로 적지만, 나중에 로그인을 붙이면 그 값이 그대로 이 자리에 들어온다.
 * 그래서 provider 가 있는 줄은 손으로 고치지 못하게 막아 둔다 — 바깥에서 온 것을
 * 여기서 덮어써 봐야 다음 로그인에 다시 덮인다.
 *
 * 틀은 씀씀이·잔소리가 쓰는 카드(.chart-card)를 그대로 쓴다. 고치는 흐름은
 * 설정 세 화면과 같다 — [편집] 으로 열고 [저장] 으로 담는다.
 */

type Profile = {
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  provider: string | null;
  emoji: string | null;
  bio: string | null;
  joined_on: string | null;
};

type Prefs = Record<string, string>;

type Summary = {
  first_day: string | null;
  last_day: string | null;
  rows_all: number;
  spend_count: number;
  spend_total: number;
  counts: Record<string, number>;
  top_places: { name: string; count: number }[];
  big_places: { name: string; total: number }[];
  top_methods: { name: string; count: number }[];
  big_day: { day: string; total: number } | null;
  streak: { len: number; from: string; to: string } | null;
};

const EMPTY: Profile = {
  display_name: null, email: null, avatar_url: null,
  provider: null, emoji: null, bio: null, joined_on: null,
};

const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

/** 어디로 들어왔는지 — 로그인을 붙이면 여기 이름이 찍힌다 */
const PROVIDER_NAME: Record<string, string> = { google: "구글", kakao: "카카오" };

/** 첫 화면으로 고를 수 있는 곳 — 탭이 있는 화면만 */
const HOME_CHOICES = [
  { value: "/", label: "홈" },
  { value: "/entries", label: "지출 내역" },
  { value: "/calendar", label: "달력" },
  { value: "/charts", label: "씀씀이" },
  { value: "/nudges", label: "잔소리" },
];

/** 지난 날을 사람이 읽는 말로 — "2년 2개월째" */
function since(from: string): string {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date();
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years <= 0) return `${Math.max(rest, 0)}개월째 내역 입력 중`;
  return rest
    ? `${years}년 ${rest}개월째 내역 입력 중`
    : `${years}년째 내역 입력 중`;
}

/** 순위 한 줄 — 이름과 값 */
function RankRow({ rank, name, right }: { rank: number; name: string; right: string }) {
  return (
    <div className="me-rank">
      <span className="me-rank__no">{rank}</span>
      <span className="me-rank__name">{name}</span>
      <span className="me-rank__count">{right}</span>
    </div>
  );
}

/** 곳간에 쌓인 것 — 청록 딱지로 늘어놓는다 */
function Tags({ items }: { items: string[] }) {
  return (
    <div className="tag-row">
      {items.map((t) => (
        <span key={t} className="tag">
          {t}
        </span>
      ))}
    </div>
  );
}

export default function Me() {
  const [editMode, setEditMode] = useState(false);
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [prefs, setPrefs] = useState<Prefs>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ready, setReady] = useState(false);
  /* [편집] 을 누른 순간의 모습 — 바뀐 것이 없으면 그렇게 알린다 */
  const [before, setBefore] = useState("");

  const load = () => {
    Promise.all([
      axios.get("/profile").then((r) => r.data).catch(() => EMPTY),
      axios.get("/profile/prefs").then((r) => r.data).catch(() => ({})),
      axios.get("/profile/summary").then((r) => r.data).catch(() => null),
    ]).then(([p, f, s]) => {
      setProfile({ ...EMPTY, ...p });
      setPrefs(f);
      putPrefs(f);
      setSummary(s);
      setReady(true);
    });
  };

  useEffect(load, []);

  const set = (key: keyof Profile, value: string) =>
    setProfile((prev) => ({ ...prev, [key]: value }));
  const setPref = (key: string, value: string) =>
    setPrefs((prev) => ({ ...prev, [key]: value }));

  const stamp = () => JSON.stringify([profile, prefs]);

  const toggleEdit = async () => {
    if (!editMode) {
      setBefore(stamp());
      setEditMode(true);
      return;
    }
    if (stamp() === before) {
      alert("변경된 내용이 없습니다만...?");
      setEditMode(false);
      return;
    }
    try {
      await axios.post("/profile", profile);
      await axios.post("/profile/prefs", prefs);
      setEditMode(false);
      load();
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  };

  /* 바깥에서 온 프로필은 손으로 고치지 못한다 — 다음 로그인에 다시 덮인다 */
  const fromOutside = !!profile.provider;
  const face = profile.emoji || "🙂";
  const name = profile.display_name || "이름 없음";

  return (
    <div className="page-wrap">
      <div className="cat-toolbar goal-toolbar">
        <div className="cat-toolbar-btns">
          <div className="btn-row">
            <button className="ui-btn primary" onClick={toggleEdit}>
              {editMode ? "저장" : "편집"}
            </button>
          </div>
        </div>
      </div>

      {!ready && <div className="page-empty">불러오는 중입니다.</div>}

      {ready && (
        <div className="chart-grid">
          {/* ─── 누구인가 ─────────────────────────────────────── */}
          <section className="chart-card chart-card--wide">
            <div className="me-head">
              {/* 편집 중에는 얼굴 자체가 고르는 단추다 — 따로 칸을 두면 이모지가
                  아닌 글자가 들어갈 여지가 생기고, 무엇을 누를지도 헷갈린다. */}
              {editMode && !fromOutside && !profile.avatar_url ? (
                <span className="me-face me-face--pick">
                  <EmojiPicker
                    value={profile.emoji}
                    title="얼굴 고르기"
                    onChange={(v) => set("emoji", v ?? "")}
                  />
                </span>
              ) : (
                <span className="me-face" aria-hidden="true">
                  {profile.avatar_url ? (
                    <img className="me-face__img" src={profile.avatar_url} alt="" />
                  ) : (
                    face
                  )}
                </span>
              )}

              <div className="me-head__text">
                {editMode && !fromOutside ? (
                  <>
                    <div className="me-field">
                      <input
                        className="cat-input"
                        placeholder="(이름)"
                        value={profile.display_name ?? ""}
                        onChange={(e) => set("display_name", e.target.value)}
                      />
                      <input
                        className="cat-input"
                        placeholder="(메일)"
                        value={profile.email ?? ""}
                        onChange={(e) => set("email", e.target.value)}
                      />
                    </div>
                    <input
                      className="cat-input"
                      placeholder="(한마디)"
                      value={profile.bio ?? ""}
                      onChange={(e) => set("bio", e.target.value)}
                    />
                  </>
                ) : (
                  <>
                    <span className="me-name">{name}</span>
                    {profile.email && <span className="me-mail">{profile.email}</span>}
                    {profile.bio && <p className="me-bio">{profile.bio}</p>}
                  </>
                )}
              </div>
            </div>

            <div className="me-head__foot">
              {profile.provider && (
                <span className="me-badge">
                  {PROVIDER_NAME[profile.provider] ?? profile.provider} 로그인
                </span>
              )}
              {summary?.first_day && (
                <span className="me-since">
                  {formatDateLabel(summary.first_day)}부터 {since(summary.first_day)}
                </span>
              )}
            </div>

            {editMode && fromOutside && (
              <p className="me-note">
                로그인으로 받아 온 정보입니다. 여기서 고쳐도 다음 로그인에 다시 덮입니다.
              </p>
            )}
          </section>

          {/* ─── 함께한 시간 ──────────────────────────────────── */}
          <section className="chart-card chart-card--wide">
            <header className="chart-card__head">
              <h3 className="chart-card__title">함께한 시간</h3>
            </header>

            <div className="chart-tiles">
              <div className="chart-tile">
                <span className="chart-tile__label">적은 건수</span>
                <span className="chart-tile__value">
                  {(summary?.spend_count ?? 0).toLocaleString("ko-KR")}
                </span>
                <span className="chart-tile__sub">건</span>
              </div>
              <div className="chart-tile">
                <span className="chart-tile__label">적은 돈</span>
                <span className="chart-tile__value">
                  {Math.round((summary?.spend_total ?? 0) / 10000).toLocaleString("ko-KR")}
                </span>
                <span className="chart-tile__sub">만 원</span>
              </div>
              <div className="chart-tile">
                <span className="chart-tile__label">장소</span>
                <span className="chart-tile__value">
                  {(summary?.counts?.place ?? 0).toLocaleString("ko-KR")}
                </span>
                <span className="chart-tile__sub">곳</span>
              </div>
            </div>

            {/* 딱지 차례 — 내역(대기·정기) 다음에 곳간을 두고, 분류는 중·소·세
                차례대로 놓는다. 셋이 흩어져 있으면 깊이가 눈에 잡히지 않는다. */}
            <Tags
              items={[
                `대기 ${summary?.counts?.pending ?? 0}건`,
                `정기 ${summary?.counts?.scheduled ?? 0}건`,
                `중분류 ${summary?.counts?.cat1 ?? 0}가지`,
                `소분류 ${summary?.counts?.cat2 ?? 0}가지`,
                `세분류 ${summary?.counts?.cat3 ?? 0}가지`,
                `결제 수단 ${summary?.counts?.method ?? 0}가지`,
                `함께한 상대 ${summary?.counts?.counterpart ?? 0}명`,
              ]}
            />
          </section>

          {/* ─── 버릇 ─────────────────────────────────────────── */}
          <section className="chart-card">
            <header className="chart-card__head">
              <h3 className="chart-card__title">자주 간 곳</h3>
              <span className="me-span">최근 3개월</span>
            </header>
            {summary?.top_places?.length ? (
              summary.top_places.map((p, i) => (
                <RankRow key={p.name} rank={i + 1} name={p.name} right={`${p.count}번`} />
              ))
            ) : (
              <div className="page-empty">최근 3개월에 적어 둔 장소가 없습니다.</div>
            )}
          </section>

          <section className="chart-card">
            <header className="chart-card__head">
              <h3 className="chart-card__title">많이 쓴 곳</h3>
              <span className="me-span">최근 3개월</span>
            </header>
            {summary?.big_places?.length ? (
              summary.big_places.map((p, i) => (
                <RankRow key={p.name} rank={i + 1} name={p.name} right={won(p.total)} />
              ))
            ) : (
              <div className="page-empty">최근 3개월에 적어 둔 장소가 없습니다.</div>
            )}
          </section>

          <section className="chart-card chart-card--wide">
            <header className="chart-card__head">
              <h3 className="chart-card__title">결제 수단별 건수</h3>
              <span className="me-span">최근 3개월</span>
            </header>
            {summary?.top_methods?.length ? (
              summary.top_methods.map((m, i) => (
                <RankRow key={m.name} rank={i + 1} name={m.name} right={`${m.count}건`} />
              ))
            ) : (
              <div className="page-empty">최근 3개월에 적어 둔 결제 수단이 없습니다.</div>
            )}
          </section>

          <section className="chart-card chart-card--wide">
            <header className="chart-card__head">
              <h3 className="chart-card__title">AI 리뷰</h3>
              <span className="me-span">TBD</span>
            </header>
            <div className="page-empty">준비 중입니다.</div>
          </section>

          {/* ─── 어떻게 볼까 ──────────────────────────────────── */}
          <section className="chart-card chart-card--wide">
            <header className="chart-card__head">
              <h3 className="chart-card__title">어떻게 볼까?</h3>
            </header>

            <div className="me-pref">
              <span className="me-pref__name">첫 화면</span>
              <div className="me-pref__control">
                {editMode ? (
                  <SingleSelect
                    noun="화면"
                    options={HOME_CHOICES}
                    selected={prefs.home_path ?? "/"}
                    onChange={(v) => setPref("home_path", v)}
                  />
                ) : (
                  <span className="me-pref__value">
                    {HOME_CHOICES.find((x) => x.value === (prefs.home_path ?? "/"))?.label ?? "홈"}
                  </span>
                )}
              </div>
            </div>

            <div className="me-pref">
              <span className="me-pref__name">Blur 처음부터 켜기</span>
              <div className="me-pref__control">
                <button
                  type="button"
                  className={`set-hide-btn${prefs.blur_default === "1" ? " on" : ""}`}
                  disabled={!editMode}
                  onClick={() => setPref("blur_default", prefs.blur_default === "1" ? "0" : "1")}
                >
                  {prefs.blur_default === "1" ? "켬" : "끔"}
                </button>
              </div>
            </div>

            <div className="me-pref">
              <span className="me-pref__name">Exclude 처음부터 켜기</span>
              <div className="me-pref__control">
                <button
                  type="button"
                  className={`set-hide-btn${prefs.exclude_default === "1" ? " on" : ""}`}
                  disabled={!editMode}
                  onClick={() =>
                    setPref("exclude_default", prefs.exclude_default === "1" ? "0" : "1")
                  }
                >
                  {prefs.exclude_default === "1" ? "켬" : "끔"}
                </button>
              </div>
            </div>

            <div className="me-pref">
              <span className="me-pref__name">잔소리 받기</span>
              <div className="me-pref__control">
                <button
                  type="button"
                  className={`set-hide-btn${prefs.nudge_on === "1" ? " on" : ""}`}
                  disabled={!editMode}
                  onClick={() => setPref("nudge_on", prefs.nudge_on === "1" ? "0" : "1")}
                >
                  {prefs.nudge_on === "1" ? "켬" : "끔"}
                </button>
              </div>
            </div>

            <p className="me-note">앱 Refresh 후 적용됩니다.</p>
          </section>

          {/* ─── 내역 다운로드 ────────────────────────────────── */}
          <section className="chart-card chart-card--wide">
            <header className="chart-card__head">
              <h3 className="chart-card__title">내역 다운로드</h3>
            </header>

            <p className="me-note">지금까지 쓴 지출 내역을 파일로 받습니다.</p>

            <div className="btn-row me-export">
              <a className="ui-btn" href="/api/profile/export/entries.xlsx">
                Excel
              </a>
              <a className="ui-btn" href="/api/profile/export/entries.csv">
                CSV
              </a>
              <a className="ui-btn" href="/api/profile/export">
                전체(JSON)
              </a>
            </div>
          </section>
        </div>
      )}

      <QuickActions onSaved={load} />
    </div>
  );
}
