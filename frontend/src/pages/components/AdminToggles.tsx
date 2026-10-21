import { useCallback, useEffect, useState } from "react";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { say, ask } from "../../utils/notify";
import { MENU_REGISTRY } from "../../utils/menuRegistry";
import { PAGE_TITLE } from "../../utils/pageTitles";
import MarkIcon from "./MarkIcon";
import AddButton from "./AddButton";
import CollapseToggle, { CollapseAllButtons } from "./CollapseToggle";
import { invalidateMenuOff, loadMenuOff } from "../../utils/menuOff";
import { invalidateDoodlePool, loadDoodlePool } from "../../utils/doodlePool";

/**
 * 메뉴 On/Off와 애니메이션 문구. 켜고 끄는 두 자리다.
 *
 * 짜임은 설정 탭의 화면들을 그대로 따른다(pages/PaymentMethods.tsx).
 * 위에 줄 하나를 두고 거기에 모두 펼치기와 편집을 세운다. 켜고 끄는 단추는
 * 편집 중에만 나오고, 평소에는 꺼진 줄에 작은 딱지만 붙는다. 편집을 누르면
 * 그 자리가 저장으로 바뀌고, 저장할 때 바뀐 줄만 보낸다.
 *
 * 모양은 이름을 고치지 않는다. 화면이 손으로 그리는 그림이라(PenMark.tsx)
 * 이름은 그 그림을 가리키는 꼬리표일 뿐이다. 문구는 글자 자체가 알맹이라
 * 고칠 수 있다.
 */

type 문구 = { item_key: string; kind: string; label: string; sort_order: number; is_active: number };

/** 바뀐 줄을 가릴 때 쓰는 지문. */
const 지문 = (들: 문구[]) => JSON.stringify(들.map((x) => [x.item_key, x.label, x.is_active]));

export function AdminMenu() {
  const [꺼진것, set꺼진것] = useState<string[] | null>(null);
  const [편집중, set편집중] = useState(false);
  const [편집전, set편집전] = useState<string[]>([]);
  const [접힘, set접힘] = useState<Set<string>>(new Set());

  const 받기 = useCallback(() => {
    axios
      .get("/admin/prefs")
      .then((r) => set꺼진것((r.data?.menu_off as string[]) ?? []))
      .catch(() => set꺼진것([]));
  }, []);

  useEffect(받기, [받기]);

  const 뒤집기 = (key: string) => {
    set꺼진것((v) => {
      const 이제 = v ?? [];
      return 이제.includes(key) ? 이제.filter((k) => k !== key) : [...이제, key];
    });
  };

  const 저장 = async () => {
    const 이제 = 꺼진것 ?? [];
    if (JSON.stringify([...편집전].sort()) === JSON.stringify([...이제].sort())) {
      say.warn("변경된 내용이 없습니다만...?");
      set편집중(false);
      return;
    }
    try {
      await axios.put("/admin/menu-off", { menu_off: 이제 }, { headers: 머리() });
      say.ok("저장 완료-!! ;-)");
      set편집중(false);
      /* 사용자 화면이 쥔 목록을 비우고 다시 받는다. */
      invalidateMenuOff();
      void loadMenuOff();
    } catch {
      say.bad("저장하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  const 묶음 = ["내역", "설정"] as const;

  const 접기 = (이름: string) =>
    set접힘((v) => {
      const 다음 = new Set(v);
      if (다음.has(이름)) 다음.delete(이름);
      else 다음.add(이름);
      return 다음;
    });

  return (
    <div className="admin-edit">
      <div className="cat-toolbar">
        <div className="pm-toolbar-row admin-toolbar-row">
          {/* 할 일 단추는 오른쪽 끝에 모은다. 사용자 화면도 거기에 둔다.
              .set-bulk가 제 margin-left: auto로 밀기도 하는데, 이 줄에서는
              그 값이 먹지 않아 왼쪽에 남았다. 빈자리를 먹는 조각을 앞에
              세우면 어느 판에서나 오른쪽에 붙는다. */}
          <span className="admin-toolbar-row__gap" />
          <CollapseAllButtons
            onExpandAll={() => set접힘(new Set())}
            onCollapseAll={() => set접힘(new Set(묶음))}
          />
          <button
            type="button"
            className="ui-btn primary"
            onClick={() => {
              if (!편집중) {
                set편집전([...(꺼진것 ?? [])]);
                set편집중(true);
              } else {
                void 저장();
              }
            }}
          >
            {편집중 ? "저장" : "편집"}
          </button>
        </div>
      </div>

      <div className="cat-card admin-box admin-pair">
        {묶음.map((g) => (
          <section key={g} className="admin-group">
            <h3 className="admin-card__title admin-card__title--fold">
              <CollapseToggle open={!접힘.has(g)} onToggle={() => 접기(g)} label={g} />
              {g} 탭
            </h3>
            {!접힘.has(g) &&
              (꺼진것 === null ? (
                <p className="page-empty">불러오고 있습니다.</p>
              ) : (
                <ul className="admin-list">
                  {MENU_REGISTRY.filter((m) => m.group === g).map((m) => {
                    const 꺼짐 = 꺼진것.includes(m.key);
                    return (
                      <li key={m.key} className={`admin-list__row${꺼짐 ? " is-off" : ""}`}>
                        <span className="admin-list__name">
                          {PAGE_TITLE[m.path] ?? m.path}
                          {꺼짐 && !편집중 && <span className="set-hide-mark">꺼짐</span>}
                        </span>
                        <span className="admin-list__path">{m.path}</span>
                        {편집중 && (
                          <button
                            type="button"
                            className={`set-hide-btn ${꺼짐 ? "on" : ""}`}
                            title={꺼짐 ? "다시 켠다." : "끈다. 메뉴에서 빠지고 주소로도 못 들어온다."}
                            onClick={() => 뒤집기(m.key)}
                          >
                            {꺼짐 ? "꺼짐" : "끄기"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ))}
          </section>
        ))}
      </div>
    </div>
  );
}

export function AdminDoodle() {
  const [목록, set목록] = useState<문구[] | null>(null);
  const [편집중, set편집중] = useState(false);
  const [편집전, set편집전] = useState("[]");
  /* 접은 카드의 이름. 두 장뿐이라 집합 하나로 넉넉하다. */
  const [접힘, set접힘] = useState<Set<string>>(new Set());
  const [새글, set새글] = useState("");
  /* 담는 칸을 열었나. 떠 있는 단추를 누르면 열린다. */
  const [담는중, set담는중] = useState(false);

  const 받기 = useCallback(() => {
    axios
      .get("/admin/doodle-items", { headers: 머리() })
      .then((r) => set목록(r.data as 문구[]))
      .catch(() => set목록([]));
  }, []);

  useEffect(받기, [받기]);

  /* 사용자 화면이 쥔 목록을 비우고 다시 받는다. */
  const 다시읽히기 = () => {
    invalidateDoodlePool();
    void loadDoodlePool();
  };

  const 고치기 = (key: string, 바꿀: Partial<문구>) =>
    set목록((v) => (v ?? []).map((x) => (x.item_key === key ? { ...x, ...바꿀 } : x)));

  const 저장 = async () => {
    const 이제 = 목록 ?? [];
    if (지문(이제) === 편집전) {
      say.warn("변경된 내용이 없습니다만...?");
      set편집중(false);
      return;
    }
    /* 바뀐 줄만 보낸다. 지문을 줄 단위로 풀어 견준다. */
    const 옛것 = new Map<string, string>();
    for (const x of JSON.parse(편집전) as [string, string, number][]) {
      옛것.set(x[0], JSON.stringify([x[1], x[2]]));
    }
    const 보낼것 = 이제.filter((x) => 옛것.get(x.item_key) !== JSON.stringify([x.label, x.is_active]));
    if (보낼것.some((x) => !x.label.trim())) {
      say.warn("이름을 입력해 주세요.");
      return;
    }
    try {
      for (const x of 보낼것) {
        await axios.put(
          `/admin/doodle-items/${x.item_key}`,
          { label: x.label.trim(), is_active: x.is_active },
          { headers: 머리() },
        );
      }
      say.ok("저장 완료-!! ;-)");
      set편집중(false);
      받기();
      다시읽히기();
    } catch {
      say.bad("저장하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  const 추가 = async () => {
    const 글 = 새글.trim();
    if (!글) {
      say.warn("문구를 입력해 주세요.");
      return;
    }
    try {
      await axios.post("/admin/doodle-items", { label: 글 }, { headers: 머리() });
      say.ok("추가 완료-!! ;-)");
      set새글("");
      set담는중(false);
      받기();
      다시읽히기();
    } catch {
      say.bad("추가하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  const 지우기 = async (it: 문구) => {
    const 할까 = await ask({
      title: "문구 제거",
      body: "이 문구를 제거할까요?",
      warn: "되돌릴 수 없습니다.",
      go: "제거",
      danger: true,
    });
    if (!할까) return;
    try {
      await axios.delete(`/admin/doodle-items/${it.item_key}`, { headers: 머리() });
      say.ok("제거 완료-!! ;-)");
      받기();
      다시읽히기();
    } catch {
      say.bad("제거하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  const 모양들 = (목록 ?? []).filter((x) => x.kind === "mark");
  const 문구들 = (목록 ?? []).filter((x) => x.kind !== "mark");

  const 접기 = (이름: string) =>
    set접힘((v) => {
      const 다음 = new Set(v);
      if (다음.has(이름)) 다음.delete(이름);
      else 다음.add(이름);
      return 다음;
    });

  const 끄기단추 = (it: 문구) => (
    <button
      type="button"
      className={`set-hide-btn ${it.is_active ? "" : "on"}`}
      title={it.is_active ? "끈다. 쪽지에 안 뜬다." : "다시 켠다."}
      onClick={() => 고치기(it.item_key, { is_active: it.is_active ? 0 : 1 })}
    >
      {it.is_active ? "끄기" : "꺼짐"}
    </button>
  );

  return (
    <div className="admin-edit">
      <div className="cat-toolbar">
        <div className="pm-toolbar-row admin-toolbar-row">
          {/* 할 일 단추는 오른쪽 끝에 모은다. 사용자 화면도 거기에 둔다.
              .set-bulk가 제 margin-left: auto로 밀기도 하는데, 이 줄에서는
              그 값이 먹지 않아 왼쪽에 남았다. 빈자리를 먹는 조각을 앞에
              세우면 어느 판에서나 오른쪽에 붙는다. */}
          <span className="admin-toolbar-row__gap" />
          <CollapseAllButtons
            onExpandAll={() => set접힘(new Set())}
            onCollapseAll={() => set접힘(new Set(["모양", "문구"]))}
          />
          <button
            type="button"
            className="ui-btn primary"
            onClick={() => {
              if (!편집중) {
                set편집전(지문(목록 ?? []));
                set편집중(true);
              } else {
                void 저장();
              }
            }}
          >
            {편집중 ? "저장" : "편집"}
          </button>
        </div>
      </div>

      <div className="cat-card admin-box admin-pair">
        <section className="admin-group">
          <h3 className="admin-card__title admin-card__title--fold">
            <CollapseToggle open={!접힘.has("모양")} onToggle={() => 접기("모양")} label="모양" />
            모양
          </h3>
          {!접힘.has("모양") &&
            (목록 === null ? (
              <p className="page-empty">불러오고 있습니다.</p>
            ) : (
              <ul className="admin-list">
                {모양들.map((it) => (
                  <li key={it.item_key} className={`admin-list__row${it.is_active ? "" : " is-off"}`}>
                    <span className="admin-list__mark">
                      <MarkIcon itemKey={it.item_key} />
                    </span>
                    <span className="admin-list__name">
                      {it.label}
                      {!it.is_active && !편집중 && <span className="set-hide-mark">꺼짐</span>}
                    </span>
                    {편집중 && 끄기단추(it)}
                  </li>
                ))}
              </ul>
            ))}
        </section>

        <section className="admin-group">
          <h3 className="admin-card__title admin-card__title--fold">
            <CollapseToggle open={!접힘.has("문구")} onToggle={() => 접기("문구")} label="문구" />
            문구
          </h3>
          {!접힘.has("문구") && (
            <>
              {목록 === null ? (
                <p className="page-empty">불러오고 있습니다.</p>
              ) : 문구들.length === 0 ? (
                <p className="page-empty">등록한 문구가 없습니다.</p>
              ) : (
                <ul className="admin-list">
                  {문구들.map((it) => (
                    <li key={it.item_key} className={`admin-list__row${it.is_active ? "" : " is-off"}`}>
                      {편집중 ? (
                        <input
                          className="ui-input admin-list__edit"
                          value={it.label}
                          onChange={(e) => 고치기(it.item_key, { label: e.target.value })}
                          maxLength={40}
                        />
                      ) : (
                        <span className="admin-list__name">
                          {it.label}
                          {!it.is_active && <span className="set-hide-mark">꺼짐</span>}
                        </span>
                      )}
                      {편집중 && 끄기단추(it)}
                      {편집중 && (
                        <button type="button" className="ui-btn small" onClick={() => void 지우기(it)}>
                          제거
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {/* 적는 칸은 담을 때만 연다. 늘 떠 있으면 목록 아래에 빈 칸이
                  늘 한 줄 붙어 있어 어디까지가 목록인지 흐려진다. */}
              {담는중 && (
                <div className="admin-row">
                  <input
                    className="ui-input"
                    value={새글}
                    onChange={(e) => set새글(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void 추가();
                      if (e.key === "Escape") set담는중(false);
                    }}
                    placeholder="(문구)"
                    maxLength={40}
                    autoFocus
                  />
                  <button type="button" className="ui-btn primary" onClick={() => void 추가()}>
                    추가
                  </button>
                  <button type="button" className="ui-btn" onClick={() => set담는중(false)}>
                    닫기
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* 담기. 누르면 문구 칸이 열린다. 접혀 있으면 함께 펼친다. */}
      <AddButton
        이름="새 문구"
        onClick={() => {
          set접힘((v) => {
            const 다음 = new Set(v);
            다음.delete("문구");
            return 다음;
          });
          set담는중(true);
        }}
      />
    </div>
  );
}
