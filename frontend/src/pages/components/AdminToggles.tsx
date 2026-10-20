import { useCallback, useEffect, useState } from "react";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { say, ask } from "../../utils/notify";
import { MENU_REGISTRY } from "../../utils/menuRegistry";
import { PAGE_TITLE } from "../../utils/pageTitles";
import MarkIcon from "./MarkIcon";
import { invalidateMenuOff, loadMenuOff } from "../../utils/menuOff";
import { invalidateDoodlePool, loadDoodlePool } from "../../utils/doodlePool";

/**
 * 메뉴 On/Off와 애니메이션 문구. 켜고 끄는 두 자리다.
 *
 * 문구 자리는 모양과 문구로 다시 갈린다. 모양은 화면이 손으로 그리는
 * 그림이라(PenMark.tsx) 켜고 끄는 것만 되고, 문구는 글자뿐이라 더하고
 * 지우는 것까지 된다.
 *
 * 메뉴는 등록부(utils/menuRegistry.ts)에 적힌 것을 늘어놓는다. 거기 한 줄
 * 더하면 여기 스위치가 하나 저절로 늘어난다. 이름은 사용자 화면이 쓰는
 * 것을 그대로 꺼내 쓰고(utils/pageTitles.ts), 경로는 그 옆에 작게 붙인다.
 *
 * 켜고 끄는 꼴은 함께한 상대 화면의 것(.cp-toggle)을 그대로 쓴다. 처음에는
 * 꽉 찬 단추를 줄마다 놓았는데, 아홉 개가 나란히 서니 머리띠와 서로
 * 다투어 어느 쪽을 봐야 할지 흐려졌다.
 *
 * 바꾸고 나면 사용자 화면이 쥔 목록도 비운다. 그러지 않으면 같은 창에서
 * 홈으로 돌아갔을 때 옛 목록이 그대로 걸려 있다.
 */

type 문구 = { item_key: string; kind: string; label: string; sort_order: number; is_active: number };

export function AdminMenu() {
  const [꺼진것, set꺼진것] = useState<string[] | null>(null);

  const 받기 = useCallback(() => {
    axios
      .get("/admin/prefs")
      .then((r) => set꺼진것((r.data?.menu_off as string[]) ?? []))
      .catch(() => set꺼진것([]));
  }, []);

  useEffect(받기, [받기]);

  const 뒤집기 = async (key: string) => {
    if (!꺼진것) return;
    const 다음 = 꺼진것.includes(key) ? 꺼진것.filter((k) => k !== key) : [...꺼진것, key];
    try {
      await axios.put("/admin/menu-off", { menu_off: 다음 }, { headers: 머리() });
      set꺼진것(다음);
      /* 사용자 화면이 쥔 목록을 비우고 다시 받는다. */
      invalidateMenuOff();
      void loadMenuOff();
    } catch {
      say.bad("바꾸지 못했습니다.");
    }
  };

  const 묶음 = ["내역", "설정"] as const;

  return (
    <div className="admin-edit">
      {묶음.map((g) => (
        <section key={g} className="card admin-card">
          <h3 className="admin-card__title">{g} 탭</h3>
          {꺼진것 === null ? (
            <p className="page-empty">불러오고 있습니다.</p>
          ) : (
            <ul className="admin-list">
              {MENU_REGISTRY.filter((m) => m.group === g).map((m) => {
                const 꺼짐 = 꺼진것.includes(m.key);
                return (
                  <li key={m.key} className={`admin-list__row${꺼짐 ? " is-off" : ""}`}>
                    <span className="admin-list__name">{PAGE_TITLE[m.path] ?? m.path}</span>
                    <span className="admin-list__path">{m.path}</span>
                    <label className="cp-toggle admin-switch">
                      <input type="checkbox" checked={!꺼짐} onChange={() => void 뒤집기(m.key)} />
                      {꺼짐 ? "꺼짐" : "켜짐"}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

export function AdminDoodle() {
  const [목록, set목록] = useState<문구[] | null>(null);
  const [새글, set새글] = useState("");

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

  const 뒤집기 = async (it: 문구) => {
    try {
      await axios.put(`/admin/doodle-items/${it.item_key}`, { is_active: it.is_active ? 0 : 1 }, { headers: 머리() });
      set목록((v) => (v ?? []).map((x) => (x.item_key === it.item_key ? { ...x, is_active: x.is_active ? 0 : 1 } : x)));
      다시읽히기();
    } catch {
      say.bad("바꾸지 못했습니다.");
    }
  };

  const 더하기 = async () => {
    const 글 = 새글.trim();
    if (!글) {
      say.warn("문구를 적어 주세요.");
      return;
    }
    try {
      await axios.post("/admin/doodle-items", { label: 글 }, { headers: 머리() });
      say.ok("문구를 더했습니다.");
      set새글("");
      받기();
      다시읽히기();
    } catch {
      say.bad("더하지 못했습니다.");
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
      say.ok("문구를 제거했습니다.");
      받기();
      다시읽히기();
    } catch {
      say.bad("제거하지 못했습니다.");
    }
  };

  const 모양들 = (목록 ?? []).filter((x) => x.kind === "mark");
  const 문구들 = (목록 ?? []).filter((x) => x.kind !== "mark");
  const 켠수 = (목록 ?? []).filter((x) => x.is_active).length;

  return (
    <div className="admin-edit">
      <section className="card admin-card">
        <h3 className="admin-card__title">모양</h3>
        <p className="admin-hint">켜진 것 가운데 하나를 골라 띄웁니다.</p>
        {목록 === null ? (
          <p className="page-empty">불러오고 있습니다.</p>
        ) : (
          <ul className="admin-list">
            {모양들.map((it) => (
              <li key={it.item_key} className={`admin-list__row${it.is_active ? "" : " is-off"}`}>
                <span className="admin-list__mark">
                  <MarkIcon itemKey={it.item_key} />
                </span>
                <span className="admin-list__name">{it.label}</span>
                <label className="cp-toggle admin-switch">
                  <input type="checkbox" checked={!!it.is_active} onChange={() => void 뒤집기(it)} />
                  {it.is_active ? "켜짐" : "꺼짐"}
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card admin-card">
        <h3 className="admin-card__title">문구</h3>
        <p className="admin-hint">모양과 한 벌로 섞여 하나가 뜹니다.</p>
        <div className="admin-row">
          <input
            className="ui-input"
            value={새글}
            onChange={(e) => set새글(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void 더하기();
            }}
            placeholder="적을 문구"
            maxLength={40}
          />
          <button type="button" className="ui-btn primary" onClick={() => void 더하기()}>
            더하기
          </button>
        </div>
        {목록 === null ? (
          <p className="page-empty">불러오고 있습니다.</p>
        ) : 문구들.length === 0 ? (
          <p className="page-empty">등록한 문구가 없습니다.</p>
        ) : (
          <ul className="admin-list">
            {문구들.map((it) => (
              <li key={it.item_key} className={`admin-list__row${it.is_active ? "" : " is-off"}`}>
                <span className="admin-list__name">{it.label}</span>
                <label className="cp-toggle admin-switch">
                  <input type="checkbox" checked={!!it.is_active} onChange={() => void 뒤집기(it)} />
                  {it.is_active ? "켜짐" : "꺼짐"}
                </label>
                <button type="button" className="ui-btn small" onClick={() => void 지우기(it)}>
                  제거
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="admin-hint">지금 켜진 것은 모두 {켠수}가지입니다.</p>
      </section>
    </div>
  );
}
