import { useEffect, useState } from "react";
import axios from "../../api/client";

/**
 * 카드를 펼쳤을 때 아래에 붙는 "함께한 사람과 몫".
 *
 * 목록을 받아 올 때 쪼갠 몫까지 함께 실어 오면 카드마다 쓰지도 않을 자료를
 * 나르게 된다. 펼친 그 카드만 그때 물어본다.
 *
 * 한 사람이 한 줄짜리 작은 회색 카드다. 카드 폭을 다 쓰므로 왼쪽에 빈 자리가
 * 남지 않고, 줄끼리 폭이 같으니 금액의 오른쪽 끝도 저절로 한 줄로 선다.
 */
type Split = {
  split_id: number;
  counterpart_id: number | null;
  counterpart_name?: string | null;
  amount: number;
  memo?: string | null;
};

export default function SplitRows({
  base,
  ownerId,
}: {
  /** "/entries" 처럼 자원 자리. 뒤에 /{id}/splits 가 붙는다 */
  base: string;
  ownerId: number;
}) {
  const [rows, setRows] = useState<Split[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    axios
      .get(`${base}/${ownerId}/splits`)
      .then((r) => alive && setRows(Array.isArray(r.data) ? r.data : []))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [base, ownerId]);

  if (failed) return <div className="split-rows__note">몫을 불러오지 못했습니다.</div>;
  if (rows === null) return <div className="split-rows__note">불러오는 중…</div>;
  if (rows.length === 0) return <div className="split-rows__note">나눈 몫이 없습니다.</div>;

  return (
    <div className="split-rows">
      {rows.map((s) => (
        <div key={s.split_id} className="split-rows__row">
          <span className="split-rows__who">{s.counterpart_name || "이름 없음"}</span>
          {s.memo && <span className="split-rows__memo">{s.memo}</span>}
          <span className="split-rows__amount">
            {Number(s.amount).toLocaleString("ko-KR")}
          </span>
        </div>
      ))}
    </div>
  );
}
