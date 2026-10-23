import { useCallback, useEffect, useState } from "react";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { say, ask } from "../../utils/notify";
import { MENU_REGISTRY } from "../../utils/menuRegistry";
import { PAGE_TITLE } from "../../utils/pageTitles";
import MarkIcon from "./MarkIcon";
import AddButton from "./AddButton";
import useEditLock from "../../hooks/useEditLock";
import { EditLockTip } from "./EditLock";
import OnOffToggle from "./OnOffToggle";
import CollapseToggle, { CollapseAllButtons } from "./CollapseToggle";
import { invalidateMenuOff, loadMenuOff } from "../../utils/menuOff";
import { invalidateDoodlePool, loadDoodlePool } from "../../utils/doodlePool";
import AdminFilterPopup from "./AdminFilterPopup";
import SingleSelect from "./SingleSelect";
import { EditField } from "./CardEditModal";

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
                <p className="page-empty">불러오는 중입니다.</p>
              ) : (
                <ul className="admin-list">
                  {MENU_REGISTRY.filter((m) => m.group === g).map((m) => {
                    const 꺼짐 = 꺼진것.includes(m.key);
                    return (
                      <li key={m.key} className={`admin-list__row${꺼짐 ? " is-off" : ""}`}>
                        <span className="admin-list__name">
                          {PAGE_TITLE[m.path] ?? m.path}
                        </span>
                        <span className="admin-list__path">{m.path}</span>
                        {/* 스위치는 늘 선다. 편집 중이 아니면 막혀 있을
                            뿐이다. 켜졌는지 보려고 편집에 들어가야 한다면
                            목록으로서 제 몫을 못 한다. */}
                        <OnOffToggle
                          이름={PAGE_TITLE[m.path] ?? m.path}
                          켜짐={!꺼짐}
                          막힘={!편집중}
                          켬말="켠다. 메뉴에 뜬다."
                          끔말="끈다. 메뉴에서 빠지고 주소로도 못 들어온다."
                          on바뀜={(켠다) => {
                            /* 이미 그쪽이면 아무 일도 하지 않는다. */
                            if (켠다 === !꺼짐) return;
                            뒤집기(m.key);
                          }}
                        />
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

/**
 * 문구를 거르는 조건.
 *
 * 켜짐은 ""이 전체, "1"이 켜진 것, "0"이 꺼진 것이다. 글은 든 글자로 찾는다.
 * 공지의 거르기와 같은 꼴이다(AdminNotices.tsx).
 *
 * 서버에 묻지 않고 받은 목록에서 골라낸다. 모양 여덟에 문구 몇이라,
 * 조건마다 요청을 새로 내는 쪽이 오히려 더 느리다.
 */
type 거름 = { 켜짐: string; 글: string };
const 안거름: 거름 = { 켜짐: "", 글: "" };
const 걸렸나 = (f: 거름) => !!(f.켜짐 || f.글.trim());

export function AdminDoodle() {
  const [목록, set목록] = useState<문구[] | null>(null);
  const [편집중, set편집중] = useState(false);
  /* 편집 중에 담기를 누르면 왜 안 되는지 그 자리에 띄운다. 사용자 사이트의
     다섯 화면이 쓰는 것을 그대로 쓴다(hooks/useEditLock.ts). */
  const { lockAt, showLock, tipRef } = useEditLock(편집중);
  const [편집전, set편집전] = useState("[]");
  /* 접은 카드의 이름. 두 장뿐이라 집합 하나로 넉넉하다. */
  const [접힘, set접힘] = useState<Set<string>>(new Set());
  const [새글, set새글] = useState("");
  /* 담는 칸을 열었나. 떠 있는 단추를 누르면 열린다. */
  const [담는중, set담는중] = useState(false);
  const [걸림, set걸림] = useState<거름>(안거름);
  /* 팝업 안에서 고치는 중인 조건. [적용]을 누르지 않고 닫으면 버린다. */
  const [초안, set초안] = useState<거름>(안거름);
  const [필터열림, set필터열림] = useState(false);

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

  /* 거른 뒤의 목록. 편집 중에도 거른 채로 둔다. 저장은 바뀐 줄만 보내므로
     가려진 줄이 함께 지워지거나 덮이는 일은 없다. */
  const 걸러낸것 = (들: 문구[]) =>
    들.filter((x) => {
      if (걸림.켜짐 === "1" && !x.is_active) return false;
      if (걸림.켜짐 === "0" && x.is_active) return false;
      const 글 = 걸림.글.trim();
      if (글 && !x.label.includes(글)) return false;
      return true;
    });

  const 모양들 = 걸러낸것((목록 ?? []).filter((x) => x.kind === "mark"));
  const 문구들 = 걸러낸것((목록 ?? []).filter((x) => x.kind !== "mark"));
  const 다해서 = (목록 ?? []).length;
  const 보는것 = 모양들.length + 문구들.length;

  const 접기 = (이름: string) =>
    set접힘((v) => {
      const 다음 = new Set(v);
      if (다음.has(이름)) 다음.delete(이름);
      else 다음.add(이름);
      return 다음;
    });

  const 끄기단추 = (it: 문구) => (
    <OnOffToggle
      이름={it.label}
      켜짐={!!it.is_active}
      막힘={!편집중}
      켬말="켠다. 쪽지에 뜬다."
      끔말="끈다. 쪽지에 안 뜬다."
      on바뀜={(켠다) => {
        if (켠다 === !!it.is_active) return;
        고치기(it.item_key, { is_active: 켠다 ? 1 : 0 });
      }}
    />
  );

  return (
    <div className="admin-edit">
      <div className="cat-toolbar">
        <div className="pm-toolbar-row admin-toolbar-row">
          {/* 할 일 단추는 오른쪽 끝에 모은다. 사용자 화면도 거기에 둔다.
              .set-bulk가 제 margin-left: auto로 밀기도 하는데, 이 줄에서는
              그 값이 먹지 않아 왼쪽에 남았다. 빈자리를 먹는 조각을 앞에
              세우면 어느 판에서나 오른쪽에 붙는다. */}
          {/* 거른 집계는 왼쪽 끝에 딱지로 적는다. 걸면 목록에서 줄이
              빠지는데, 몇 줄 가운데 몇 줄을 보고 있는지 적지 않으면
              줄이 사라진 것처럼 읽힌다. 공지와 같은 자리, 같은 꼴이다. */}
          {걸렸나(걸림) && 목록 && (
            <span className="admin-span__tag">
              {보는것}건 / 전체 {다해서}건
            </span>
          )}
          <span className="admin-toolbar-row__gap" />
          <CollapseAllButtons
            onExpandAll={() => set접힘(new Set())}
            onCollapseAll={() => set접힘(new Set(["모양", "문구"]))}
          />
          <button
            type="button"
            className={`filter-pill${걸렸나(걸림) ? " on" : ""}`}
            aria-pressed={걸렸나(걸림)}
            title={걸렸나(걸림) ? "필터가 걸려 있다. 눌러서 고친다." : "필터"}
            onClick={() => {
              set초안(걸림);
              set필터열림(true);
            }}
          >
            필터
          </button>
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
              <p className="page-empty">불러오는 중입니다.</p>
            ) : 모양들.length === 0 ? (
              <p className="page-empty">조건에 맞는 모양이 없습니다.</p>
            ) : (
              <ul className="admin-list">
                {모양들.map((it) => (
                  <li key={it.item_key} className={`admin-list__row${it.is_active ? "" : " is-off"}`}>
                    <span className="admin-list__mark">
                      <MarkIcon itemKey={it.item_key} />
                    </span>
                    <span className="admin-list__name">{it.label}</span>
                    {/* 꺼짐 딱지는 줄의 오른쪽 끝에 선다. 이름 칸 안에 두니
                        이름 바로 뒤에 붙어, 줄마다 딱지가 선 자리가 들쭉날쭉했다.
                        줄의 직계 자식으로 내면 이름 칸이 남은 자리를 다 먹으므로
                        저절로 끝으로 밀린다. 편집 중에는 그 자리에 스위치가
                        서므로 딱지를 내리지 않는다. */}
                    {!it.is_active && !편집중 && <span className="set-hide-mark">꺼짐</span>}
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
                <p className="page-empty">불러오는 중입니다.</p>
              ) : 문구들.length === 0 ? (
                <p className="page-empty">
                  {걸렸나(걸림) ? "조건에 맞는 문구가 없습니다." : "등록한 문구가 없습니다."}
                </p>
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
                        <>
                          <span className="admin-list__name">{it.label}</span>
                          {/* 모양 줄과 같은 자리. 줄의 오른쪽 끝이다. */}
                          {!it.is_active && <span className="set-hide-mark">꺼짐</span>}
                        </>
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

      {필터열림 && (
        <AdminFilterPopup
          on초기화={() => set초안(안거름)}
          on적용={() => {
            set걸림(초안);
            set필터열림(false);
          }}
          onClose={() => set필터열림(false)}
        >
          <EditField label="켜짐" span={6}>
            <SingleSelect
              noun="상태"
              options={[
                { value: "", label: "(전체)" },
                { value: "1", label: "켜짐" },
                { value: "0", label: "꺼짐" },
              ]}
              selected={초안.켜짐}
              onChange={(v) => set초안({ ...초안, 켜짐: v })}
              placeholder="(전체)"
            />
          </EditField>

          <EditField label="글" span={6}>
            <input
              type="text"
              value={초안.글}
              placeholder="(글)"
              onChange={(e) => set초안({ ...초안, 글: e.target.value })}
            />
          </EditField>

          <EditField label="" span={12}>
            <p className="admin-hint">모양과 문구를 함께 찾습니다.</p>
          </EditField>
        </AdminFilterPopup>
      )}

      {/* 담기. 누르면 문구 칸이 열린다. 접혀 있으면 함께 펼친다.

          편집 중에는 막는다. 고치던 것을 저장하지 않은 채로 새 줄을 담으면
          어느 것이 담긴 것인지 흐려진다. 사용자 사이트의 분류와 결제 수단도
          그렇게 막는다(pages/Categories.tsx). */}
      <AddButton
        이름="새 문구"
        잠김={편집중}
        onClick={(e) => {
          if (편집중) {
            showLock(e, "편집을 마친 후 추가하세요.");
            return;
          }
          set접힘((v) => {
            const 다음 = new Set(v);
            다음.delete("문구");
            return 다음;
          });
          set담는중(true);
        }}
      />

      <EditLockTip lockAt={lockAt} tipRef={tipRef} />
    </div>
  );
}
