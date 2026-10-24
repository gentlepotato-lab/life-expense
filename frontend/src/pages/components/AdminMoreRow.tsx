/**
 * 접힌 나머지를 펼치고 다시 접는 줄.
 *
 * 긴 표는 앞의 몇 줄만 먼저 펼친다. 삼백 줄이 한꺼번에 깔리면 굴려 내려가는
 * 동안 어디쯤인지 놓치고, 쪽이 뜨는 데도 그만큼 걸린다.
 *
 * 표 맨 아래에 칸을 가로질러 선다. 펼치기 전에는 (...)이고, 펼친 뒤에는
 * 접기다. 펼치고 나면 되돌릴 길이 없던 때는 날짜 단을 통째로 접었다가 다시
 * 펴야 앞 몇 줄로 돌아갔다.
 */
export default function AdminMoreRow({
  칸수,
  남은수,
  폈나,
  on바꾸기,
}: {
  /** 가로지를 칸 수. 표마다 다르다. */
  칸수: number;
  남은수: number;
  폈나: boolean;
  on바꾸기: () => void;
}) {
  return (
    /* 펼쳤는지를 줄에 적는다. 접힌 동안에만 아래에 겹쳐 깔린 장이 비친다
       (index.css의 .admin-tbl__more). */
    <tr className={`admin-tbl__more${폈나 ? " is-open" : ""}`}>
      <td colSpan={칸수}>
        <button
          type="button"
          aria-expanded={폈나}
          aria-label={
            폈나 ? "펼친 줄 접기" : `남은 ${남은수.toLocaleString("ko-KR")}줄 펼치기`
          }
          onClick={on바꾸기}
        >
          {폈나 ? "접기" : "(...)"}
        </button>
      </td>
    </tr>
  );
}
