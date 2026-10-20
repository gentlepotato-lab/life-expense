import { useCallback, useEffect, useState } from "react";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { say } from "../../utils/notify";
import { MENU_REGISTRY } from "../../utils/menuRegistry";
import { PAGE_TITLE } from "../../utils/pageTitles";
import { invalidateMenuOff, loadMenuOff } from "../../utils/menuOff";
import { invalidateDoodlePool, loadDoodlePool } from "../../utils/doodlePool";

/**
 * 메뉴 On/Off와 애니메이션 문구 — 켜고 끄는 두 자리.
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

  const 받기 = useCallback(() => {
    axios
      .get("/admin/doodle-items", { headers: 머리() })
      .then((r) => set목록(r.data as 문구[]))
      .catch(() => set목록([]));
  }, []);

  useEffect(받기, [받기]);

  const 뒤집기 = async (it: 문구) => {
    try {
      await axios.put(`/admin/doodle-items/${it.item_key}`, { is_active: it.is_active ? 0 : 1 }, { headers: 머리() });
      set목록((v) => (v ?? []).map((x) => (x.item_key === it.item_key ? { ...x, is_active: x.is_active ? 0 : 1 } : x)));
      /* 문구를 띄우는 쪽이 쥔 목록도 비운다. */
      invalidateDoodlePool();
      void loadDoodlePool();
    } catch {
      say.bad("바꾸지 못했습니다.");
    }
  };

  const 켠수 = (목록 ?? []).filter((x) => x.is_active).length;

  return (
    <div className="admin-edit">
      <section className="card admin-card">
        <h3 className="admin-card__title">화면에 뜨는 문구</h3>
        <p className="admin-hint">
          켜진 것 가운데 하나를 골라 띄웁니다. 지금 켜진 것은 {켠수}가지입니다.
          모두 끄면 기본 열 가지를 씁니다.
        </p>
        {목록 === null ? (
          <p className="page-empty">불러오고 있습니다.</p>
        ) : 목록.length === 0 ? (
          <p className="page-empty">등록한 문구가 없습니다.</p>
        ) : (
          <ul className="admin-list">
            {목록.map((it) => (
              <li key={it.item_key} className={`admin-list__row${it.is_active ? "" : " is-off"}`}>
                <span className="admin-list__kind">{it.kind === "mark" ? "그림" : "인사"}</span>
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
    </div>
  );
}
