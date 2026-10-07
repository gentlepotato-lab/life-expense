import { useEffect, useState } from "react";
import axios from "../api/client";
import { apiErrorMessage } from "../utils/apiError";
import useBackClose from "../hooks/useBackClose";
import QuickActions from "./components/QuickActions";
import EmojiPicker from "./components/EmojiPicker";
import GoToButton from "./components/GoToButton";
import SingleSelect from "./components/SingleSelect";
import { formatDateLabel } from "../utils/dateGroup";
import { PAGE_TITLE, HOME_TABS, ENTRY_TABS, SETTING_TABS } from "../utils/pageTitles";
import { applyTape, DEFAULT_TAPE, TAPES } from "../utils/tapes";
import { applyPalette, DEFAULT_PALETTE, PALETTES, swatchOf } from "../utils/palettes";
import {
  applyTheme, currentStep, resolveStep, STEPS, DEFAULT_MODE, DEFAULT_LIGHT, DEFAULT_DARK,
} from "../utils/theme";
import type { Step } from "../utils/theme";
import PalettePopup from "./components/PalettePopup";
import { putPrefs } from "../utils/prefs";
import { applyMotion } from "../utils/motion";
import useEditLock from "../hooks/useEditLock";
import { EditLockCover, EditLockTip } from "./components/EditLock";
import { BulbOnIcon, BulbOffIcon } from "./components/SkipIcons";
import { say } from "../utils/notify";
/**
 * 돈쓴이 — 쓰는 사람과 앱 자신.
 *
 * 다른 화면이 모두 돈에 대한 것이라면 여기는 사람에 대한 것이다.
 * 누구인가 · 얼마나 함께했나 · 어떤 버릇이 있나 · 어떻게 볼까 · 어떻게 내려받나.
 *
 * 프로필 칸은 바깥 인증(구글·카카오)이 돌려주는 것에 맞춰 두었다. 아직 로그인이
 * 없어 손으로 적지만, 나중에 로그인을 붙이면 그 값이 그대로 이 자리에 들어온다.
 * 그래서 provider가 있는 줄은 손으로 고치지 못하게 막아 둔다 — 바깥에서 온 것을
 * 여기서 덮어써 봐야 다음 로그인에 다시 덮인다.
 *
 * 틀은 씀씀이·잔소리가 쓰는 카드(.chart-card)를 그대로 쓴다. 고치는 흐름은
 * 설정 세 화면과 같다 — [편집]으로 열고 [저장]으로 담는다.
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

/** 어디로 들어왔는지 — 로그인을 붙이면 여기 이름이 찍힌다. */
const PROVIDER_NAME: Record<string, string> = { google: "구글", kakao: "카카오" };

/**
 * 첫 화면으로 고를 수 있는 곳 — 모든 화면.
 *
 * 아래 이동 막대의 세 묶음(홈 · 내역 · 설정)을 그대로 따라 늘어놓고, 묶음에
 * 딸린 화면은 `홈 > 쓰기`처럼 어디에 딸린 것인지 함께 적는다. 목록은
 * pageTitles가 들고 있는 것을 그대로 쓰므로, 화면을 하나 더해도 여기가
 * 저절로 따라온다.
 *
 * 기간이 붙어야 열리는 화면(달력의 기간 내역)은 뺀다 — 첫 화면으로 열면
 * 고른 날이 없어 빈 화면이 된다.
 */
const TAB_GROUPS: { name: string; root: string; kids: string[] }[] = [
  { name: "홈", root: "/", kids: HOME_TABS.filter((t) => t !== "/") },
  { name: "내역", root: "/history", kids: ENTRY_TABS },
  { name: "설정", root: "/settings", kids: SETTING_TABS },
];

const HOME_CHOICES = TAB_GROUPS.flatMap((g) => [
  { value: g.root, label: g.name },
  ...g.kids.map((to) => ({ value: to, label: `${g.name} > ${PAGE_TITLE[to]}` })),
]);

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

/** 곳간에 쌓인 것 — 청록 딱지로 늘어놓는다. */
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
  /* [편집]을 누른 순간의 모습 — 바뀐 것이 없으면 그렇게 알린다. */
  const [before, setBefore] = useState("");

  /* 빛깔 예시 팝업을 열어 두었는지 */
  const [palOpen, setPalOpen] = useState(false);

  /* 편집이 아닐 때 고칠 자리를 누르면 왜 안 되는지 알려 준다.
     편집 모드를 둔 다른 화면들과 같은 갈고리를 쓴다. */
  const { lockAt, showLock, tipRef } = useEditLock(editMode);

  const lockCover = () => <EditLockCover editMode={editMode} onLock={showLock} />;

  /**
   * 켬·끔 한 쌍.
   *
   * 정기 내역 편집 팝업의 한 번 건너뛰기와 같은 스위치다. 켜진 전구가 켬,
   * 꺼진 전구가 끔이다. 알약 하나로 적던 때와 달리 고를 것이 둘임을 눌러 보지
   * 않아도 알고, 같은 일을 하는 자리가 화면마다 같은 모양으로 선다.
   *
   * 보기 모드에서는 손만 막는다 — 흐려지지 않아, 무엇이 걸려 있는지 알려고
   * 편집을 켰다 끌 일이 없다. 누름은 줄을 덮은 잠금 판이 받아 말을 띄운다.
   */
  const onoff = (key: string, name: string, 켬말: string, 끔말: string) => {
    const on = prefs[key] === "1";
    return (
      <span
        className={`set-fixed set-onoff${on ? " set-onoff--on" : ""}`}
        role="group"
        aria-label={name}
      >
        <button
          type="button"
          className={on ? "on" : ""}
          aria-pressed={on}
          disabled={!editMode}
          title={켬말}
          onClick={() => setPref(key, "1")}
        >
          <BulbOnIcon />
        </button>
        <button
          type="button"
          className={on ? "" : "on"}
          aria-pressed={!on}
          disabled={!editMode}
          title={끔말}
          onClick={() => setPref(key, "0")}
        >
          <BulbOffIcon />
        </button>
      </span>
    );
  };

  const load = () => {
    Promise.all([
      axios.get("/profile").then((r) => r.data).catch(() => EMPTY),
      // 설정은 실패를 빈 값과 구분한다. 빈 값으로 받으면 아래에서 그것으로
      // 브라우저에 담아 둔 사본까지 덮어, 빛깔과 밝기가 기본값으로 돌아간다.
      axios.get("/profile/prefs").then((r) => r.data).catch(() => null),
      axios.get("/profile/summary").then((r) => r.data).catch(() => null),
    ]).then(([p, f, s]) => {
      setProfile({ ...EMPTY, ...p });
      if (f) {
        setPrefs(f);
        putPrefs(f);
      } else {
        say.warn("설정을 불러오지 못했습니다. 담아 둔 값으로 보여 드립니다.");
      }
      setSummary(s);
      setReady(true);
    });
  };

  useEffect(load, []);

  const set = (key: keyof Profile, value: string) =>
    setProfile((prev) => ({ ...prev, [key]: value }));
  const setPref = (key: string, value: string) =>
    setPrefs((prev) => ({ ...prev, [key]: value }));

  /**
   * 줄에서 골라져 있는 밝기 칸.
   *
   * 화면에 끼워진 칸(currentStep)과 다를 수 있다. 밝기는 담아야 끼워지므로,
   * 고치는 동안에는 고른 것과 끼워진 것이 갈린다. 빛깔 알약과 예시 그림은
   * 고른 쪽을 따라가야 한다 — 흰 종이를 골라 놓고 예시만 새벽빛으로 뜨면
   * 벌이 아니라 밝기를 견주게 된다.
   */
  const 고른칸 = () =>
    resolveStep(
      prefs.theme_mode ?? DEFAULT_MODE,
      prefs.theme_light ?? DEFAULT_LIGHT,
      prefs.theme_dark ?? DEFAULT_DARK
    );

  /* 칸을 고르면 그 칸이 선 쪽에 담고, 보는 쪽도 그쪽으로 옮긴다. 밝은 칸과
     어두운 칸을 따로 기억해 두어야 시스템으로 옮겨도 살아남는다. */
  const pickStep = (s: Step) =>
    setPrefs((prev) => ({
      ...prev,
      theme_mode: s.dark ? "dark" : "light",
      [s.dark ? "theme_dark" : "theme_light"]: s.key,
    }));

  /* 뒤로 가기 · Esc로 편집을 무른다. 화면을 떠나는 대신 편집만 닫는다 —
     다른 설정 화면이 모두 그렇다. 여기는 고치기 전 값을 지문으로만 들고
     있어 되돌릴 수 없으므로, 서버에서 다시 읽어 손댄 내용을 버린다.
     Backspace는 받지 않는다. 이름이나 한마디를 지우다 칸이 비면 그 키가
     편집을 닫아 버린다. */
  useBackClose(
    editMode,
    () => {
      setEditMode(false);
      load();
    },
    false
  );

  const stamp = () => JSON.stringify([profile, prefs]);

  const toggleEdit = async () => {
    if (!editMode) {
      setBefore(stamp());
      setEditMode(true);
      return;
    }
    if (stamp() === before) {
      say.warn("변경된 내용이 없습니다만...?");
      setEditMode(false);
      return;
    }
    try {
      await axios.post("/profile", profile);
      await axios.post("/profile/prefs", prefs);
      /* 담긴 뒤에 붙인다. 고르는 동안 미리 바뀌면 담지 않고 나가도 그대로
         남아, 담은 것과 보이는 것이 어긋난다. */
      applyTape(prefs.tape_style ?? DEFAULT_TAPE);
      /* 밝기가 먼저다. 어두운 칸이면 벌도 어두운 쪽 모습으로 끼워야 해서,
         빛깔은 어느 칸인지를 알고 나서야 정해진다. */
      applyTheme(
        prefs.theme_mode ?? DEFAULT_MODE,
        prefs.theme_light ?? DEFAULT_LIGHT,
        prefs.theme_dark ?? DEFAULT_DARK
      );
      applyPalette(prefs.palette ?? DEFAULT_PALETTE, currentStep().dark);
      applyMotion(prefs.motion_on);
      say.ok("저장 완료-!! ;-)");
      setEditMode(false);
      load();
    } catch (err) {
      say.bad(apiErrorMessage(err));
    }
  };

  /* 바깥에서 온 프로필은 손으로 고치지 못한다 — 다음 로그인에 다시 덮인다. */
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
              {!fromOutside && lockCover()}
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

          {/* ─── 함께한 쓰기 ──────────────────────────────────── */}
          <section className="chart-card chart-card--wide">
            <header className="chart-card__head">
              <h3 className="chart-card__title">함께한 쓰기</h3>
            </header>

            {/* 단위는 숫자 오른쪽에 붙인다 — 줄을 바꿔 놓으면 칸만 길어진다. */}
            <div className="chart-tiles me-tiles">
              <div className="chart-tile">
                <span className="chart-tile__label">쓴 건수</span>
                <span className="me-tile__foot">
                  <span className="chart-tile__value">
                    {(summary?.spend_count ?? 0).toLocaleString("ko-KR")}
                  </span>
                  <span className="chart-tile__sub">건</span>
                  <GoToButton to="/entries" label="지출 내역" className="me-tile__go" />
                </span>
              </div>
              <div className="chart-tile">
                <span className="chart-tile__label">장소/가게</span>
                <span className="me-tile__foot">
                  <span className="chart-tile__value">
                    {(summary?.counts?.place ?? 0).toLocaleString("ko-KR")}
                  </span>
                  <span className="chart-tile__sub">곳</span>
                  <GoToButton to="/places" label="어디 쓰나" className="me-tile__go" />
                </span>
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
              {lockCover()}
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
              {lockCover()}
              <span className="me-pref__name">마스킹 테이프 붙이기</span>
              <div className="me-pref__control">
                {onoff(
                  "blur_default",
                  "마스킹 테이프 붙이기",
                  "금액을 테이프로 덮는다.",
                  "금액을 그대로 보인다."
                )}
              </div>
            </div>

            <div className="me-pref">
              {lockCover()}
              <span className="me-pref__name">내역에 메모 보이기</span>
              <div className="me-pref__control">
                {onoff(
                  "memo_show",
                  "내역에 메모 보이기",
                  "카드 아래 메모 판을 보인다.",
                  "메모는 꾹 눌러 뜨는 편집 팝업에서만 본다."
                )}
              </div>
            </div>

            <div className="me-pref">
              {lockCover()}
              <span className="me-pref__name">잔소리 듣기</span>
              <div className="me-pref__control">
                {onoff("nudge_on", "잔소리 듣기", "잔소리를 듣는다.", "잔소리를 듣지 않는다.")}
              </div>
            </div>

            {/* 움직임은 꾸밈이라 끌 수 있어야 하고, 끈다고 하는 일이 달라져서는
                안 된다. 끄면 미끄러지고 떠오르는 동안만 사라져 끝난 자리가 곧바로
                선다 — 꾹 누르기 진행 표시처럼 "언제 열리는지"를 알리는 움직임은
                남는다(index.css 160절). */}
            <div className="me-pref">
              {lockCover()}
              <span className="me-pref__name">화면 애니메이션</span>
              <div className="me-pref__control">
                {onoff(
                  "motion_on",
                  "화면 애니메이션",
                  "미끄러지고 떠오르며 움직인다.",
                  "움직임 없이 곧바로 보인다. 하는 일은 그대로다."
                )}
              </div>
            </div>

            {/* 테이프 무늬 — 고르는 것은 위 다섯과 같다. [저장]을 눌러야 담기고,
                담기는 그때 화면 곳곳의 테이프가 바뀐다. */}
            <div className="me-pref me-pref--tape">
              {lockCover()}
              <span className="me-pref__name">테이프 무늬</span>
              <div className="me-tape">
                {TAPES.map((t) => {
                  const on = (prefs.tape_style ?? DEFAULT_TAPE) === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      className={`me-tape__btn${on ? " on" : ""}`}
                      style={{ backgroundImage: `url("${t.file}")` }}
                      disabled={!editMode}
                      aria-pressed={on}
                      aria-label={t.label}
                      title={t.label}
                      onClick={() => setPref("tape_style", t.key)}
                    />
                  );
                })}
              </div>
            </div>

            {/* 빛깔 — 고르는 손놀림은 위 테이프 줄과 같다. [저장]을 눌러야
                담기고, 담기는 그때 화면 곳곳의 색이 바뀐다.
                눈 단추는 담기 전에 미리 보라고 둔 것이다. 여섯 벌을 머릿속에
                그려 놓고 고르기는 어렵다. */}
            <div className="me-pref me-pref--palette">
              {lockCover()}
              <span className="me-pref__name">빛깔</span>
              <div className="me-pal">
                {PALETTES.map((p) => {
                  const on = (prefs.palette ?? DEFAULT_PALETTE) === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      className={`me-pal__btn${on ? " on" : ""}`}
                      style={{
                        background: (() => {
                          const t = swatchOf(p, 고른칸().dark);
                          return `linear-gradient(90deg, ${t.primary} 0 33.34%, ${t.success} 33.34% 66.67%, ${t.danger} 66.67% 100%)`;
                        })(),
                      }}
                      disabled={!editMode}
                      aria-pressed={on}
                      aria-label={p.label}
                      title={p.label}
                      onClick={() => setPref("palette", p.key)}
                    />
                  );
                })}
                <button
                  type="button"
                  className="me-pal__eye"
                  disabled={!editMode}
                  aria-label="빛깔 예시 보기"
                  title="빛깔 예시 보기"
                  onClick={() => setPalOpen(true)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 밝기 — 여섯 칸과, 운영체제를 따라가는 자리 하나.
                밝은 칸을 고르면 밝은 쪽 값으로, 어두운 칸을 고르면 어두운 쪽
                값으로 담는다. 그래야 시스템으로 옮겨도 애써 고른 칸이 그대로
                살아난다. */}
            <div className="me-pref me-pref--step">
              {lockCover()}
              <span className="me-pref__name">배경 밝기</span>
              <div className="me-step">
                {STEPS.map((s) => {
                  const 자동 = (prefs.theme_mode ?? DEFAULT_MODE) === "system";
                  const 쓰는것 = s.dark
                    ? (prefs.theme_dark ?? DEFAULT_DARK)
                    : (prefs.theme_light ?? DEFAULT_LIGHT);
                  const 같은쪽 = s.dark
                    ? (prefs.theme_mode ?? DEFAULT_MODE) === "dark"
                    : (prefs.theme_mode ?? DEFAULT_MODE) === "light";
                  const on = !자동 && 같은쪽 && 쓰는것 === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      className={`me-step__btn${on ? " on" : ""}`}
                      style={{
                        background: `linear-gradient(180deg, ${s.surface} 0 52%, ${s.bg} 52% 100%)`,
                      }}
                      disabled={!editMode}
                      aria-pressed={on}
                      aria-label={s.label}
                      title={s.label}
                      onClick={() => pickStep(s)}
                    />
                  );
                })}
                <button
                  type="button"
                  className={`me-step__auto${
                    (prefs.theme_mode ?? DEFAULT_MODE) === "system" ? " on" : ""
                  }`}
                  disabled={!editMode}
                  aria-pressed={(prefs.theme_mode ?? DEFAULT_MODE) === "system"}
                  aria-label="시스템 설정 따라가기"
                  title="시스템 설정 따라가기"
                  onClick={() => setPref("theme_mode", "system")}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="2.8" y="4.4" width="18.4" height="12.2" rx="2" />
                    <path d="M8.5 20.4h7" />
                  </svg>
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

      <EditLockTip lockAt={lockAt} tipRef={tipRef} />

      {palOpen && (
        <PalettePopup
          value={prefs.palette ?? DEFAULT_PALETTE}
          step={고른칸()}
          onPick={(key) => setPref("palette", key)}
          onClose={() => setPalOpen(false)}
        />
      )}

      <QuickActions onSaved={load} />
    </div>
  );
}
