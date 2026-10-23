import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import axios from "../../api/client";
import { 머리 } from "../../utils/adminAuth";
import { 날짜글 } from "../../utils/adminFmt";

/**
 * 공지 상세.
 *
 * 공지 한 건만 펼쳐 본다. 공지 쪽에서 줄의 [상세]를 누르면 그 줄의 열쇠를
 * 들고 들어온다(AdminNotices.tsx).
 *
 * 여기에는 달 넘기개도 거르기도 두지 않는다. 한 건을 보는 자리라 「언제
 * 것을 보는가」가 없다. 되돌아가면 공지 쪽이 보던 달과 조건이 그대로 있다.
 *
 * 고치는 길도 두지 않는다. 고치는 자리는 공지 쪽의 편집 팝업 하나뿐이다
 * (AdminNoticePopup.tsx). 두 자리에서 같은 줄을 고칠 수 있으면 어느 쪽이
 * 마지막인지 가리기 어려워진다.
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

export default function AdminNoticeDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [찾기] = useSearchParams();
  const 열쇠 = Number(찾기.get("id") || 0);
  const 돌아갈곳 = (location.state as { back?: string } | null)?.back ?? "공지";

  const [목록, set목록] = useState<공지[] | null>(null);
  const [탈, set탈] = useState(false);

  useEffect(() => {
    let 살아있나 = true;
    axios
      .get("/admin/notices", { headers: 머리() })
      .then((r) => {
        if (살아있나) set목록(r.data as 공지[]);
      })
      .catch(() => {
        if (살아있나) set탈(true);
      });
    return () => {
      살아있나 = false;
    };
  }, []);

  const 공지 = 목록?.find((n) => n.notice_id === 열쇠) ?? null;

  /** 뜨는 기간. 비운 쪽은 끝이 없다는 뜻이라 그렇게 적는다. */
  const 뜨는기간 = (n: 공지) => {
    if (!n.start_on && !n.end_on) return "늘 뜹니다.";
    return `${n.start_on ? 날짜글(n.start_on) : "처음"} ~ ${
      n.end_on ? 날짜글(n.end_on) : "끝없이"
    }`;
  };

  return (
    <div className="admin-edit">
      <div className="cat-toolbar">
        <div className="pm-toolbar-row admin-toolbar-row">
          <button
            type="button"
            className="filter-pill admin-back"
            aria-label={`${돌아갈곳}(으)로 돌아가기`}
            onClick={() =>
              location.state ? navigate(-1) : navigate("/admin/notice", { replace: true })
            }
          >
            <span className="admin-back__arrow" aria-hidden="true">
              ‹
            </span>
            {돌아갈곳}
          </button>
          <span className="admin-toolbar-row__gap" />
          {공지 && (
            <span
              className={`admin-tbl__tag ${공지.is_active ? "tint-풀빛" : "tint-잿빛"}`}
            >
              {공지.is_active ? "켜짐" : "꺼짐"}
            </span>
          )}
        </div>
      </div>

      {탈 ? (
        <div className="card admin-soon">
          <p className="page-empty">불러오지 못했습니다.</p>
        </div>
      ) : 목록 === null ? (
        <div className="card admin-soon">
          <p className="page-empty">불러오는 중입니다.</p>
        </div>
      ) : !공지 ? (
        <div className="card admin-soon">
          <p className="page-empty">그런 공지가 없습니다.</p>
        </div>
      ) : (
        <>
          <section className="admin-sec">
            <h3 className="admin-sec__head">공지</h3>
            <table className="admin-tbl">
              <colgroup>
                <col style={{ width: "92px" }} />
                <col />
              </colgroup>
              <tbody>
                <tr>
                  <th>제목</th>
                  <td className="admin-tbl__wrap">{공지.title}</td>
                </tr>
                <tr>
                  <th>뜨는 기간</th>
                  <td className="admin-tbl__wrap">{뜨는기간(공지)}</td>
                </tr>
                <tr>
                  <th>차례</th>
                  <td className="admin-tbl__right">{공지.sort_order}</td>
                </tr>
                <tr>
                  <th>등록</th>
                  <td className="admin-tbl__wrap">{날짜글(공지.created_on)}</td>
                </tr>
                {/* 고친 적이 없으면 등록한 날과 같은 날이 적힌다. 그때는
                    적지 않는다. 같은 날이 두 줄로 서면 고친 적이 있는
                    것처럼 읽힌다. */}
                {공지.updated_on && 공지.updated_on !== 공지.created_on && (
                  <tr>
                    <th>수정</th>
                    <td className="admin-tbl__wrap">{날짜글(공지.updated_on)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="admin-sec">
            <h3 className="admin-sec__head">본문</h3>
            {공지.body ? (
              /* 적은 그대로 보인다. 줄을 바꾼 자리도 그대로 둔다. 홈에 뜨는
                 띠도 그렇게 읽는다(pages/components/NoticeBand.tsx). */
              <p className="admin-notice-body">{공지.body}</p>
            ) : (
              <p className="page-empty">본문이 없습니다.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
