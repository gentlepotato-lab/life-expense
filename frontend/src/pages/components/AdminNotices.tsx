import { useCallback, useEffect, useState } from "react";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { say, ask } from "../../utils/notify";
import AdminNoticePopup, { type 초안 } from "./AdminNoticePopup";
import AddButton from "./AddButton";

/**
 * 공지사항.
 *
 * 화면은 목록 하나다. 적는 것도 고치는 것도 팝업에서 한다. 내역 카드와 같은
 * 결이다. 목록에서 한 줄을 누르면 그 줄이 팝업으로 열린다. 적는 칸을 목록
 * 위에 붙박이로 두었더니, 손전화에서 목록 아래쪽 줄의 편집을 눌러도 화면
 * 위쪽만 바뀌어 아무 일도 안 일어난 것처럼 보였다.
 *
 * 켜고 끄기와 제거는 편집 중에만 나온다. 설정 탭의 화면들과 같다
 * (pages/PaymentMethods.tsx).
 */

type 공지 = {
  notice_id: number;
  title: string;
  body: string | null;
  start_on: string | null;
  end_on: string | null;
  sort_order: number;
  is_active: number;
  created_on: string | null;
  updated_on: string | null;
};

/** 새로 적을 때의 빈 줄. */
const 빈것: 초안 = { title: "", body: "", start_on: "", end_on: "", sort_order: 0, is_active: 1 };

export default function AdminNotices() {
  const [목록, set목록] = useState<공지[] | null>(null);
  const [편집중, set편집중] = useState(false);
  /* 편집에 들어갈 때의 켜짐 상태. 저장할 때 바뀐 줄만 가려내는 데 쓴다.
     문구와 메뉴도 같은 꼴이다(AdminToggles.tsx). */
  const [편집전, set편집전] = useState("[]");
  /* 팝업이 쥔 것. 열쇠가 null이면 새로 적는 중이고, 수가 들어 있으면 그 줄을
     고치는 중이다. 팝업이 닫혀 있으면 아예 없다. */
  const [연것, set연것] = useState<{ id: number | null; 값: 초안 } | null>(null);

  const 받기 = useCallback(() => {
    axios
      .get("/admin/notices", { headers: 머리() })
      .then((r) => set목록(r.data as 공지[]))
      .catch(() => set목록([]));
  }, []);

  useEffect(받기, [받기]);

  const 담기 = async () => {
    if (!연것) return;
    const 값 = 연것.값;
    if (!값.title.trim()) {
      say.warn("제목을 입력해 주세요.");
      return;
    }
    try {
      if (연것.id === null) {
        await axios.post("/admin/notices", 값, { headers: 머리() });
        say.ok("추가 완료-!! ;-)");
      } else {
        await axios.put(`/admin/notices/${연것.id}`, 값, { headers: 머리() });
        say.ok("저장 완료-!! ;-)");
      }
      set연것(null);
      받기();
    } catch {
      say.bad("저장하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  /** 켜고 끄기는 화면에서만 바꾼다. 서버에는 저장할 때 한 번에 보낸다. */
  const 끄고켜기 = (n: 공지) =>
    set목록((v) =>
      (v ?? []).map((x) => (x.notice_id === n.notice_id ? { ...x, is_active: x.is_active ? 0 : 1 } : x)),
    );

  /** 바뀐 줄을 가릴 때 쓰는 지문. */
  const 지문 = (들: 공지[]) => JSON.stringify(들.map((x) => [x.notice_id, x.is_active]));

  const 저장 = async () => {
    const 이제 = 목록 ?? [];
    if (지문(이제) === 편집전) {
      say.warn("변경된 내용이 없습니다만...?");
      set편집중(false);
      return;
    }
    const 옛것 = new Map<number, number>();
    for (const x of JSON.parse(편집전) as [number, number][]) 옛것.set(x[0], x[1]);
    const 보낼것 = 이제.filter((x) => 옛것.get(x.notice_id) !== x.is_active);
    try {
      for (const x of 보낼것) {
        await axios.put(
          `/admin/notices/${x.notice_id}`,
          {
            ...x,
            body: x.body ?? "",
            start_on: x.start_on ?? "",
            end_on: x.end_on ?? "",
          },
          { headers: 머리() },
        );
      }
      say.ok("저장 완료-!! ;-)");
      set편집중(false);
      받기();
    } catch {
      say.bad("저장하지 못했습니다. 다시 시도해 주세요.");
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
      say.ok("제거 완료-!! ;-)");
      받기();
    } catch {
      say.bad("제거하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  return (
    <div className="admin-edit">
      <div className="cat-toolbar">
        <div className="pm-toolbar-row admin-toolbar-row">
          {/* 할 일 단추는 오른쪽 끝에 모은다. 사용자 화면도 거기에 둔다.
              담기는 떠 있는 동그란 단추가 맡는다(AddButton). */}
          <span className="admin-toolbar-row__gap" />
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

      <div className="cat-card admin-box">
      <section className="admin-group">
        <h3 className="admin-card__title">등록한 공지</h3>
        {목록 === null ? (
          <p className="page-empty">불러오고 있습니다.</p>
        ) : 목록.length === 0 ? (
          <p className="page-empty">등록한 공지가 없습니다.</p>
        ) : (
          <ul className="admin-list">
            {목록.map((n, i) => (
              <li
                key={n.notice_id}
                className={`admin-list__row${n.is_active ? "" : " is-off"}${편집중 ? "" : " is-tappable"}`}
                onClick={() => {
                  if (편집중) return;
                  set연것({
                    id: n.notice_id,
                    값: {
                      title: n.title,
                      body: n.body ?? "",
                      start_on: n.start_on ?? "",
                      end_on: n.end_on ?? "",
                      sort_order: n.sort_order,
                      is_active: n.is_active,
                    },
                  });
                }}
              >
                {/* 연번. 적힌 차례가 아니라 보이는 차례다. 몇 번째 줄인지
                    세는 데 쓰므로 공지 번호(notice_id)를 적지 않는다. */}
                <span className="admin-list__no">{목록.length - i}</span>
                <span className="admin-list__name">
                  {n.title}
                  {!n.is_active && !편집중 && <span className="set-hide-mark">꺼짐</span>}
                </span>
                {/* 등록한 때와 고친 때. 고친 적이 없으면 등록한 때만 적는다. */}
                {n.created_on && <span className="admin-list__path">등록 {n.created_on.slice(2)}</span>}
                {n.updated_on && n.updated_on !== n.created_on && (
                  <span className="admin-list__path">수정 {n.updated_on.slice(2)}</span>
                )}
                {편집중 && (
                  <button
                    type="button"
                    className={`set-hide-btn ${n.is_active ? "" : "on"}`}
                    title={n.is_active ? "끈다. 홈에 안 뜬다." : "다시 켠다."}
                    onClick={() => 끄고켜기(n)}
                  >
                    {n.is_active ? "끄기" : "꺼짐"}
                  </button>
                )}
                {편집중 && (
                  <button type="button" className="ui-btn small" onClick={() => void 지우기(n)}>
                    제거
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>

      {/* 담기. 사용자 화면의 다섯 자리와 같은 단추, 같은 자리다. */}
      <AddButton 이름="새 공지" onClick={() => set연것({ id: null, 값: { ...빈것 } })} />

      {연것 && (
        <AdminNoticePopup
          새것={연것.id === null}
          값={연것.값}
          on바뀜={(값) => set연것({ ...연것, 값 })}
          on저장={() => void 담기()}
          onClose={() => set연것(null)}
        />
      )}
    </div>
  );
}
