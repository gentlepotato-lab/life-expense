import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "../../api/client";
import useBackClose from "../../hooks/useBackClose";
import { visible } from "../../utils/visible";
import { apiErrorMessage } from "../../utils/apiError";
import { loadKakaoMap } from "../../utils/kakaoMap";
import DayGrid from "./DayGrid";
import { todayStr, viewOf, type View } from "../../utils/day";
import { formatDateLabel } from "../../utils/dateGroup";
import { say } from "../../utils/notify";
/**
 * 쓰기 슬라이드(Quick).
 *
 * 한 화면에 모든 칸을 늘어놓는 기존 쓰기와 달리, 한 번에 하나씩 묻고 고르면
 * 곧바로 다음 장으로 넘어간다. 손가락 하나로 빠르게 적어 내려가는 것이
 * 목적이라, 고르는 자리는 모두 큼직한 단추로 둔다.
 *
 * 기존 쓰기(EntryForm · WriteEntryModal)는 한 줄도 건드리지 않는다. 적는 길도
 * 그쪽과 같은 POST /api/entries를 쓴다 — 적는 길이 둘이 되면 언젠가 한쪽만
 * 고쳐진다.
 *
 * 껍데기는 편집 팝업의 것(.popup-panel · .edit-modal__*)을 그대로 쓴다.
 * 바닥 짜임만 달라(이전 · 걸음점 · 다음) CardEditModal을 쓰지 않고 직접 짰다.
 */

type Cat1 = { id: number; name: string; emoji?: string | null; is_active?: number };
type Cat2 = { id: number; name: string; cat1_id?: number; inout?: number | null; is_active?: number };
type Cat3 = { id: number; name: string; cat2_id?: number; is_active?: number };
/* 이모지는 결제 수단 제 것이 아니라 그것이 속한 묶음(카드 · 계좌 따위)의
   것이다. 묶음이 없는 수단은 비어 있다. */
type Pay = { code: string; name: string; emoji?: string | null; is_active?: number };

/** 저장된 장소 한 줄. /places/search가 주는 것 중 쓰는 것만 */
type DbPlace = { place_id: number; place_name: string; address?: string; lat?: number; lng?: number };

/** 카카오에서 찾은 장소 한 줄 */
type KakaoPlace = {
  id: string;
  place_name: string;
  address_name?: string;
  road_address_name?: string;
  phone?: string;
  category_name?: string;
  category_group_code?: string;
  category_group_name?: string;
  place_url?: string;
  x: string;
  y: string;
};

/**
 * 큰 단계 다섯과 그 안의 장들.
 *
 * 세분류가 없는 소분류를 고르면 그 장은 아예 건너뛴다. 빈 화면을 한 번
 * 보여 주고 넘기는 것은 빠르게 적자는 취지에 어긋난다.
 */
type Slide = "date" | "cat1" | "cat2" | "cat3" | "pay" | "amount" | "place" | "memo";

const STEP_OF: Record<Slide, number> = {
  date: 1, cat1: 2, cat2: 2, cat3: 2, pay: 3, amount: 3, place: 4, memo: 5,
};

export default function WriteSlideModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved?: () => void;
}) {
  useBackClose(true, onClose);

  /* ── 고른 값 ─────────────────────────────────────────────── */
  const [txDate, setTxDate] = useState(todayStr);
  /* 달력이 펼쳐 보이는 달. 달력 쪽이 밖에서 쥐도록 바뀌어 여기서 들고 있다. */
  const [calView, setCalView] = useState<View>(() => viewOf(todayStr()));
  const [cat1, setCat1] = useState<Cat1 | null>(null);
  const [cat2, setCat2] = useState<Cat2 | null>(null);
  const [cat3, setCat3] = useState<Cat3 | null>(null);
  const [pay, setPay] = useState<Pay | null>(null);
  const [amount, setAmount] = useState("");
  const [place, setPlace] = useState<{ name: string; db?: DbPlace; kakao?: KakaoPlace } | null>(null);
  const [memo, setMemo] = useState("");

  /* ── 고르개에 늘어놓을 것 ────────────────────────────────── */
  const [cat1List, setCat1List] = useState<Cat1[]>([]);
  const [cat2All, setCat2All] = useState<Cat2[]>([]);
  const [cat3All, setCat3All] = useState<Cat3[]>([]);
  const [payList, setPayList] = useState<Pay[]>([]);
  const [quick, setQuick] = useState<number[]>([]);

  /* 슬라이드의 시작은 2단계다. 날짜는 오늘로 깔려 있으니 고칠 때만
     [이전]으로 돌아가면 된다. */
  const [slide, setSlide] = useState<Slide>("cat1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get("/categories/lvl1").then((r) => setCat1List(r.data)).catch(() => setCat1List([]));
    axios.get("/categories/lvl2").then((r) => setCat2All(r.data)).catch(() => setCat2All([]));
    axios.get("/categories/lvl3").then((r) => setCat3All(r.data)).catch(() => setCat3All([]));
    axios
      .get("/payment-methods")
      .then((r) =>
        setPayList(
          (
            r.data as {
              method_id: number;
              method_name: string;
              category_emoji?: string | null;
              is_active?: number;
            }[]
          ).map((m) => ({
            code: String(m.method_id),
            name: m.method_name,
            emoji: m.category_emoji ?? null,
            is_active: m.is_active,
          }))
        )
      )
      .catch(() => setPayList([]));
  }, []);

  /* 빠른 입력 금액은 고른 소분류를 따른다. 점심과 월세가 같은 값을 내놓으면
     눌러 볼 까닭이 없다. */
  useEffect(() => {
    axios
      .get("/write-slide/quick-amounts", {
        params: cat2 ? { cat2_id: cat2.id } : undefined,
      })
      .then((r) => setQuick(r.data?.amounts ?? []))
      .catch(() => setQuick([]));
  }, [cat2]);

  /* IN/OUT은 고른 소분류가 데려온다 — 기존 쓰기와 같은 잣대다.
     소분류에 적혀 있지 않으면 나가는 돈으로 본다. */
  const inout = cat2 && cat2.inout !== null && cat2.inout !== undefined ? Number(cat2.inout) : -1;

  const cat2Options = useMemo(
    () => visible(cat2All).filter((c) => c.cat1_id === cat1?.id),
    [cat2All, cat1]
  );
  const cat3Options = useMemo(
    () => visible(cat3All).filter((c) => c.cat2_id === cat2?.id),
    [cat3All, cat2]
  );

  /* 장을 잇는 차례. 세분류가 없으면 그 장은 아예 빠진다. */
  const order = useMemo<Slide[]>(() => {
    const list: Slide[] = ["date", "cat1", "cat2"];
    if (cat3Options.length > 0) list.push("cat3");
    list.push("pay", "amount", "place", "memo");
    return list;
  }, [cat3Options.length]);

  const at = order.indexOf(slide);
  const go = (step: number) => {
    const next = order[at + step];
    if (next) setSlide(next);
  };

  /* 고르면 곧바로 다음 장으로 넘어간다. 한 번 더 누르게 하지 않는다. */
  const pickAnd = (fn: () => void) => {
    fn();
    window.setTimeout(() => go(1), 120);
  };

  /* ── 장소 찾기 — 기존 장소 고르개와 같은 길을 쓴다 ───────── */
  const [keyword, setKeyword] = useState("");
  const [source, setSource] = useState<"db" | "kakao">("db");
  const [dbRows, setDbRows] = useState<DbPlace[]>([]);
  const [kakaoRows, setKakaoRows] = useState<KakaoPlace[]>([]);
  const [searched, setSearched] = useState(false);

  const searchDb = useCallback(async () => {
    setSource("db");
    setSearched(true);
    try {
      const r = await axios.get("/places/search", { params: { q: keyword } });
      setDbRows(r.data ?? []);
    } catch {
      setDbRows([]);
    }
  }, [keyword]);

  const searchKakao = useCallback(async () => {
    setSource("kakao");
    setSearched(true);
    /* SDK를 먼저 띄운다. 예전에는 window.kakao가 있나만 보고 없으면 빈손으로
       돌아섰는데, 그러면 장소 고르개를 한 번도 연 적이 없는 사람에게는
       카카오 찾기가 아무 일도 하지 않았다. */
    await loadKakaoMap();
    const kakao = (window as unknown as { kakao?: KakaoNamespace }).kakao;
    if (!kakao?.maps?.services) {
      setKakaoRows([]);
      return;
    }
    const ps = new kakao.maps.services.Places();
    ps.keywordSearch(keyword, (data: KakaoPlace[], status: string) => {
      setKakaoRows(status === kakao.maps.services.Status.OK ? data : []);
    });
  }, [keyword]);

  /* 고른 장소를 지도에 찍는다 — 장소 고르개와 같은 짜임이다.
     이름만 보고는 거기가 맞는지 알기 어려워 눈으로 확인할 자리를 둔다. */
  useEffect(() => {
    const lat = place?.db?.lat ?? (place?.kakao ? Number(place.kakao.y) : null);
    const lng = place?.db?.lng ?? (place?.kakao ? Number(place.kakao.x) : null);
    if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) return;

    let 살아있나 = true;
    void loadKakaoMap().then(() => {
      if (!살아있나) return;
      const kakao = (window as unknown as { kakao?: KakaoMapNamespace }).kakao;
      const box = document.getElementById("ws-map");
      if (!kakao?.maps || !box) return;
      const map = new kakao.maps.Map(box, {
        center: new kakao.maps.LatLng(lat, lng),
        level: 3,
      });
      new kakao.maps.Marker({ position: new kakao.maps.LatLng(lat, lng), map });
    });
    return () => {
      살아있나 = false;
    };
  }, [place]);

  /* ── 담기 ────────────────────────────────────────────────── */
  const save = async () => {
    if (!cat1 || !cat2 || !pay || amount === "") return;
    setSaving(true);
    try {
      const res = await axios.post("/entries", [
        {
          tx_date: txDate,
          cat1_id: cat1.id,
          cat2_id: cat2.id,
          cat3_id: cat3 ? cat3.id : null,
          inout,
          amount: Number(amount),
          pay_method: pay.code,
          memo: memo || null,
          place_id: place?.db?.place_id ?? null,
          /* 카카오에서 새로 고른 장소는 서버가 적어 둔다 — 기존 쓰기와 같다. */
          place_name: place?.kakao?.place_name ?? null,
          place_lat: place?.kakao ? Number(place.kakao.y) : null,
          place_lng: place?.kakao ? Number(place.kakao.x) : null,
          kakao_id: place?.kakao?.id ?? null,
          address_name: place?.kakao?.address_name ?? null,
          road_address_name: place?.kakao?.road_address_name ?? null,
          phone: place?.kakao?.phone ?? null,
          category_name: place?.kakao?.category_name ?? null,
          category_group_code: place?.kakao?.category_group_code ?? null,
          category_group_name: place?.kakao?.category_group_name ?? null,
          place_url: place?.kakao?.place_url ?? null,
        },
      ]);
      void res;
      say.ok("전송 완료-!! ;-)");
      onSaved?.();
      onClose();
    } catch (err) {
      console.error(err);
      say.bad(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /* ── 바닥의 두 단추 ──────────────────────────────────────── */
  const 마지막 = slide === "memo";
  const 건너뛸수있나 = slide === "cat3" || slide === "place" || slide === "memo";
  const 골랐나 =
    slide === "date" ? !!txDate
      : slide === "cat1" ? !!cat1
      : slide === "cat2" ? !!cat2
      : slide === "cat3" ? !!cat3
      : slide === "pay" ? !!pay
      : slide === "amount" ? amount !== "" && Number(amount) > 0
      : slide === "place" ? !!place
      : true;
  const 다음켬 = 골랐나 || 건너뛸수있나;
  /* 건너뛸 수 있는 장에서 아직 안 골랐을 때만 [건너뛰기]다. 못 건너뛰는
     장에서는 꺼진 채로 [다음]이라 적어야 — 꺼진 [건너뛰기]는 넘어갈 수
     있는데 막아 둔 것처럼 읽힌다. */
  const 다음말 = 마지막
    ? "전송"
    : 건너뛸수있나 && !골랐나
    ? "건너뛰기"
    : "다음";

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel edit-modal write-slide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="쓰기"
      >
        <header className="edit-modal__head">
          <div className="edit-modal__head-text">
            <h3 className="edit-modal__title">쓰기</h3>
          </div>
          <button type="button" className="edit-modal__close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        {/* 고른 값을 이고 간다. 날짜는 오늘로 깔려 있어 이 줄이 빌 일은
            없다 — 그래서 "아직 고른 것이 없다." 같은 자리는 두지 않는다. */}
        <div className="edit-modal__headfields">
          <div className="ws-tags">
            {/* 요일까지 적는다. 날짜 단 머리말과 같은 함수를 써서, 같은 날이
                딱지와 내역에서 다르게 적히는 일이 없게 한다. */}
            <span className="ws-tag ws-tag--now">{formatDateLabel(txDate)}</span>
            {cat1 && (
              <span className="ws-tag">
                {cat1.name}
                {cat2 ? ` › ${cat2.name}` : ""}
                {cat3 ? ` › ${cat3.name}` : ""}
              </span>
            )}
            {/* IN/OUT은 분류가 데려오는 것이라 분류 딱지 바로 옆에 붙인다. */}
            {cat2 && (
              <span className={`ws-tag ws-tag--${inout === 1 ? "in" : "out"}`}>
                {inout === 1 ? "IN(+)" : "OUT(−)"}
              </span>
            )}
            {pay && <span className="ws-tag">{pay.name}</span>}
            {amount !== "" && <span className="ws-tag">{Number(amount).toLocaleString()}원</span>}
            {place && <span className="ws-tag">{place.name}</span>}
          </div>
        </div>

        <div className="edit-modal__body">
          {slide === "date" && (
            <>
              <div className="ws-lab">날짜</div>
              {/* 달력을 바로 펼친다. 날짜는 이미 오늘로 잡혀 있으니 여기까지
                  돌아온 사람은 다른 날을 고르러 온 것이다. */}
              <DayGrid
                value={txDate}
                view={calView}
                onView={setCalView}
                onPick={(d) => pickAnd(() => setTxDate(d))}
              />
            </>
          )}

          {slide === "cat1" && (
            <>
              <div className="ws-lab">중분류</div>
              <div className="ws-scroll">
                <div className="ws-grid">
                  {visible(cat1List).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`ws-pick${cat1?.id === c.id ? " on" : ""}`}
                      onClick={() =>
                        pickAnd(() => {
                          setCat1(c);
                          setCat2(null);
                          setCat3(null);
                        })
                      }
                    >
                      {/* 이모지는 이름 앞에 — 분류 화면과 같은 차례다.
                          소분류 · 세분류에는 이모지 칸이 없어 여기만 붙는다. */}
                      {c.emoji && <span className="ws-pick__emoji">{c.emoji}</span>}
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {slide === "cat2" && (
            <>
              <div className="ws-lab">소분류</div>
              <div className="ws-scroll">
                <div className="ws-grid">
                  {cat2Options.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`ws-pick${cat2?.id === c.id ? " on" : ""}`}
                      onClick={() =>
                        pickAnd(() => {
                          setCat2(c);
                          setCat3(null);
                        })
                      }
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {slide === "cat3" && (
            <>
              <div className="ws-lab">세분류</div>
              <div className="ws-scroll">
                <div className="ws-grid">
                  {cat3Options.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`ws-pick${cat3?.id === c.id ? " on" : ""}`}
                      onClick={() => pickAnd(() => setCat3(c))}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {slide === "pay" && (
            <>
              <div className="ws-lab">결제 수단</div>
              <div className="ws-scroll">
                <div className="ws-grid">
                  {visible(payList).map((p) => (
                    <button
                      key={p.code}
                      type="button"
                      className={`ws-pick${pay?.code === p.code ? " on" : ""}`}
                      onClick={() => pickAnd(() => setPay(p))}
                    >
                      {p.emoji && <span className="ws-pick__emoji">{p.emoji}</span>}
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {slide === "amount" && (
            <>
              <div className="ws-lab">금액</div>
              {/* 아래 숫자판으로만 친다. 눌러서 기기 자판이 올라오면 딱지
                  줄과 걸음점이 가려져 지금 어디쯤인지 놓친다. */}
              <input
                type="text"
                inputMode="none"
                readOnly
                className={`ws-amount${inout === 1 ? " ws-amount--in" : ""}`}
                value={amount === "" ? "" : Number(amount).toLocaleString()}
                placeholder="0"
              />
              <div className="ws-quick">
                {quick.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`ws-quick__btn${Number(amount) === a ? " on" : ""}`}
                    onClick={() => setAmount(String(a))}
                  >
                    {a.toLocaleString()}
                  </button>
                ))}
              </div>

              {/* 숫자판 — 기기 자판을 올리지 않고 그 자리에서 친다. 자판이
                  올라오면 딱지 줄과 걸음점이 가려져 어디쯤인지 놓친다. */}
              <div className="ws-pad">
                {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="ws-pad__key"
                    onClick={() => setAmount((v) => (v === "0" ? k : v + k))}
                  >
                    {k}
                  </button>
                ))}
                <button
                  type="button"
                  className="ws-pad__key"
                  onClick={() => setAmount((v) => (v === "" || v === "0" ? v : v + "00"))}
                >
                  00
                </button>
                <button
                  type="button"
                  className="ws-pad__key"
                  onClick={() => setAmount((v) => (v === "" || v === "0" ? "0" : v + "0"))}
                >
                  0
                </button>
                <button
                  type="button"
                  className="ws-pad__key ws-pad__key--back"
                  aria-label="한 자 지우기"
                  onClick={() => setAmount((v) => v.slice(0, -1))}
                >
                  ⌫
                </button>
              </div>
            </>
          )}

          {slide === "place" && (
            <>
              <div className="ws-lab">장소/가게</div>
              <input
                className="ui-input ws-keyword"
                placeholder="(검색어)"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (source === "db" ? searchDb : searchKakao)();
                }}
              />
              {/* 찾아본 뒤에만 그쪽이 켜진다 — 장소 고르개와 같은 잣대다. */}
              <div className="place-picker__tabs ws-tabs">
                <button
                  type="button"
                  className={`place-tab ${searched && source === "db" ? "active" : ""}`}
                  onClick={searchDb}
                >
                  저장된 장소/가게
                </button>
                <button
                  type="button"
                  className={`place-tab ${searched && source === "kakao" ? "active" : ""}`}
                  onClick={searchKakao}
                >
                  [+] 새로운 장소/가게
                </button>
              </div>
              <div className="place-picker__listhead ws-listhead">
                <span className="place-picker__listtitle">
                  {source === "db" ? "저장된 장소/가게" : "새로운 장소/가게"}
                </span>
                {searched && (
                  <span className="place-picker__count">
                    {(source === "db" ? dbRows : kakaoRows).length}건
                  </span>
                )}
              </div>
              <div className="place-picker__list ws-plist">
                {(source === "db" ? dbRows : kakaoRows).length === 0 ? (
                  <div className="popup-empty">
                    {searched ? "검색 결과가 없습니다." : "검색어를 입력하고 위 버튼을 누르세요."}
                  </div>
                ) : source === "db" ? (
                  dbRows.map((r) => (
                    <div
                      key={r.place_id}
                      className={`popup-item ${
                        place?.db?.place_id === r.place_id ? "popup-selected" : ""
                      }`}
                      onClick={() => setPlace({ name: r.place_name, db: r })}
                    >
                      <strong>{r.place_name}</strong>
                      <div className="popup-sub">{r.address}</div>
                    </div>
                  ))
                ) : (
                  kakaoRows.map((r) => (
                    <div
                      key={r.id}
                      className={`popup-item ${place?.kakao?.id === r.id ? "popup-selected" : ""}`}
                      onClick={() => setPlace({ name: r.place_name, kakao: r })}
                    >
                      <strong>{r.place_name}</strong>
                      <div className="popup-sub">{r.address_name}</div>
                    </div>
                  ))
                )}
              </div>

              {/* 지도 — 자리는 늘 잡아 두고, 고르기 전에는 안내를 띄운다.
                  자리가 생겼다 없어졌다 하면 목록이 밀려 눌리던 줄이 바뀐다. */}
              <div className="ws-mapwrap">
                <div id="ws-map" className="ws-map" />
                {!place && <div className="ws-mapempty">장소를 고르면 지도가 뜬다.</div>}
              </div>
            </>
          )}

          {slide === "memo" && (
            <>
              <div className="ws-lab">메모</div>
              <textarea
                className="ws-memo"
                value={memo}
                placeholder="(메모)"
                maxLength={200}
                onChange={(e) => setMemo(e.target.value)}
              />
            </>
          )}
        </div>

        <footer className="edit-modal__foot">
          <button type="button" className="ui-btn" onClick={at === 0 ? onClose : () => go(-1)}>
            {at === 0 ? "닫기" : "이전"}
          </button>

          {/* 걸음점 — 큰 단계 다섯. 지금 선 단계만 펴져 속 장수를 보인다. */}
          <span className="ws-dots" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => {
              const 속 = order.filter((s) => STEP_OF[s] === n);
              if (n !== STEP_OF[slide]) {
                return <i key={n} className={n < STEP_OF[slide] ? "done" : ""} />;
              }
              return (
                <span key={n} className="ws-dots__grp">
                  {속.map((s) => (
                    <b key={s} className={s === slide ? "on" : ""} />
                  ))}
                </span>
              );
            })}
          </span>

          <div className="edit-modal__foot-right">
            <button
              type="button"
              className="ui-btn primary"
              disabled={!다음켬 || saving}
              onClick={마지막 ? save : () => go(1)}
            >
              {saving ? "전송 중..." : 다음말}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/** 지도를 그릴 때 쓰는 자리. 좌표 하나와 표 하나면 된다. */
type KakaoMapNamespace = {
  maps: {
    Map: new (el: HTMLElement, opt: { center: unknown; level: number }) => unknown;
    Marker: new (opt: { position: unknown; map: unknown }) => unknown;
    LatLng: new (lat: number, lng: number) => unknown;
  };
};

/** 장소를 찾을 때 쓰는 자리. */
type KakaoNamespace = {
  maps: {
    services: {
      Places: new () => {
        keywordSearch: (q: string, cb: (data: KakaoPlace[], status: string) => void) => void;
      };
      Status: { OK: string };
    };
  };
};
