import { useCallback, useEffect, useState } from "react";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { say, ask } from "../../utils/notify";

/**
 * 공지사항 편집.
 *
 * 적고 고치고 끄고 지운다. 끈 공지는 사용자 화면에 안 뜨되 목록에는 남으므로,
 * 잠시 치우려면 지우지 말고 끄면 된다.
 *
 * 되묻기와 알림은 앱이 쓰는 것을 그대로 쓴다(utils/notify.ts). 브라우저 창을
 * 띄우지 않는다.
 */

type 공지 = {
  notice_id: number;
  title: string;
  body: string | null;
  start_on: string | null;
  end_on: string | null;
  sort_order: number;
  is_active: number;
};

/** 새로 등록할 때의 빈 줄. */
const 빈것 = { title: "", body: "", start_on: "", end_on: "", sort_order: 0, is_active: 1 };

export default function AdminNotices() {
  const [목록, set목록] = useState<공지[] | null>(null);
  const [고치는것, set고치는것] = useState<number | null>(null);
  const [초안, set초안] = useState({ ...빈것 });

  const 받기 = useCallback(() => {
    axios
      .get("/admin/notices", { headers: 머리() })
      .then((r) => set목록(r.data as 공지[]))
      .catch(() => set목록([]));
  }, []);

  useEffect(받기, [받기]);

  const 적기 = async () => {
    if (!초안.title.trim()) {
      say.warn("공지 제목을 적어 주세요.");
      return;
    }
    try {
      if (고치는것 === null) {
        await axios.post("/admin/notices", 초안, { headers: 머리() });
        say.ok("공지를 적었습니다.");
      } else {
        await axios.put(`/admin/notices/${고치는것}`, 초안, { headers: 머리() });
        say.ok("공지를 고쳤습니다.");
      }
      set고치는것(null);
      set초안({ ...빈것 });
      받기();
    } catch {
      say.bad("공지를 저장하지 못했습니다.");
    }
  };

  const 끄고켜기 = async (n: 공지) => {
    try {
      await axios.put(`/admin/notices/${n.notice_id}`,
        { ...n, body: n.body ?? "", start_on: n.start_on ?? "", end_on: n.end_on ?? "", is_active: n.is_active ? 0 : 1 },
        { headers: 머리() });
      받기();
    } catch {
      say.bad("바꾸지 못했습니다.");
    }
  };

  const 지우기 = async (n: 공지) => {
    const 할까 = await ask({
      title: "공지 제거",
      body: "이 공지를 제거할까요?",
      warn: "되돌릴 수 없습니다.",
      go: "제거",
      danger: true,
    });
    if (!할까) return;
    try {
      await axios.delete(`/admin/notices/${n.notice_id}`, { headers: 머리() });
      say.ok("공지를 제거했습니다.");
      받기();
    } catch {
      say.bad("제거하지 못했습니다.");
    }
  };

  return (
    <div className="admin-edit">
      <section className="card admin-card">
        <h3 className="admin-card__title">{고치는것 === null ? "새 공지" : "공지 고치기"}</h3>
        <input
          className="ui-input"
          value={초안.title}
          onChange={(e) => set초안({ ...초안, title: e.target.value })}
          placeholder="제목"
        />
        {/* 일곱 줄로 못 박는다. 글에 맞춰 자라게 두면 적는 동안 아래 단추가
            밀려 내려가, 적다 말고 눌러야 할 자리를 다시 찾게 된다. 넘치면
            칸 안에서 구른다(index.css의 textarea.admin-area). */}
        <textarea
          className="admin-area"
          value={초안.body}
          onChange={(e) => set초안({ ...초안, body: e.target.value })}
          placeholder="본문"
          rows={7}
        />
        <div className="admin-row">
          <input
            type="date"
            className="ui-input"
            value={초안.start_on}
            onChange={(e) => set초안({ ...초안, start_on: e.target.value })}
          />
          <input
            type="date"
            className="ui-input"
            value={초안.end_on}
            onChange={(e) => set초안({ ...초안, end_on: e.target.value })}
          />
        </div>
        <p className="admin-hint">기간을 비우면 늘 뜹니다.</p>
        <div className="admin-row">
          <button type="button" className="ui-btn primary" onClick={() => void 적기()}>
            {고치는것 === null ? "등록" : "저장"}
          </button>
          {고치는것 !== null && (
            <button
              type="button"
              className="ui-btn"
              onClick={() => {
                set고치는것(null);
                set초안({ ...빈것 });
              }}
            >
              되돌리기
            </button>
          )}
        </div>
      </section>

      <section className="card admin-card">
        <h3 className="admin-card__title">등록한 공지</h3>
        {목록 === null ? (
          <p className="page-empty">불러오고 있습니다.</p>
        ) : 목록.length === 0 ? (
          <p className="page-empty">등록한 공지가 없습니다.</p>
        ) : (
          <ul className="admin-list">
            {목록.map((n) => (
              <li key={n.notice_id} className={`admin-list__row${n.is_active ? "" : " is-off"}`}>
                <span className="admin-list__name">{n.title}</span>
                <button type="button" className="ui-btn small" onClick={() => void 끄고켜기(n)}>
                  {n.is_active ? "끄기" : "켜기"}
                </button>
                <button
                  type="button"
                  className="ui-btn small"
                  onClick={() => {
                    set고치는것(n.notice_id);
                    set초안({
                      title: n.title,
                      body: n.body ?? "",
                      start_on: n.start_on ?? "",
                      end_on: n.end_on ?? "",
                      sort_order: n.sort_order,
                      is_active: n.is_active,
                    });
                  }}
                >
                  고치기
                </button>
                <button type="button" className="ui-btn small" onClick={() => void 지우기(n)}>
                  제거
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
