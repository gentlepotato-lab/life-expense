import { useEffect } from "react";
import AddIcon from "./AddIcon";

/**
 * 지금 떠 있는 담기 단추의 수.
 *
 * html에 붙인 표를 보고 내보내기가 한 칸 비킨다. 세지 않으면, 한
 * 화면에 둘이 떠 있다가 하나가 걷힐 때 남은 하나까지 표를 잃는다.
 */
let 떠있는수 = 0;

/**
 * 항목을 담는 화면마다 오른쪽 아래에 떠 있는 추가 단추.
 *
 * 전에는 화면마다 도구 줄에 점선 알약을 두고, 누르면 목록 위에 입력 칸이
 * 펼쳐졌다. 네 화면이 저마다 다른 높이(67~123px)로 펼쳐지는 데다 목록이
 * 77~112px 내려가서, 적고 나면 보던 줄을 다시 찾아 내려가야 했다. 정기
 * 내역만 혼자 팝업이라 끝내는 자리도 둘로 갈렸다.
 *
 * 그래서 여는 자리를 하나로 모은다. 생김새·크기·자리는 내보내기
 * (ExportButton)와 같은 값이고, 누르면 다섯 화면 모두 팝업이 뜬다. 떠 있는
 * 것은 내용 위에 겹쳐 뜨므로 목록은 한 칸도 밀리지 않는다.
 *
 * 잠금은 부르는 쪽이 맡는다 — 편집 중에 눌렀을 때 띄울 말이 화면마다
 * 다르고(useEditLock), 알약이 하던 그대로여야 손놀림이 안 바뀐다.
 */
export default function AddButton({
  이름,
  잠김,
  onClick,
}: {
  /** 무엇을 담는지 — "새 항목", "새 도전"처럼 팝업 제목과 같은 말을 쓴다. */
  이름: string;
  /** 편집 중이라 지금은 못 담는 상태. 눌림은 그대로 받아 까닭을 알린다. */
  잠김?: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  /* 오른쪽 기둥은 맨 아래 칸을 맨 위로가 늘 예약하고, 그 위로 할 일 단추가
     바닥부터 채운다 — 차례는 담기, 그다음 내보내기다. 담기가 그 화면에서
     할 일이라 손에 가까운 칸을 가진다.

     어느 화면이 둘 다 갖는지를 손으로 적으면 화면이 늘 때마다 어긋난다.
     담기가 떠 있다고 표만 남기고, 비키는 셈은 CSS가 한곳에서 한다. */
  useEffect(() => {
    떠있는수 += 1;
    document.documentElement.classList.add("has-add-btn");
    return () => {
      떠있는수 -= 1;
      if (떠있는수 <= 0) {
        떠있는수 = 0;
        document.documentElement.classList.remove("has-add-btn");
      }
    };
  }, []);

  return (
    <button
      type="button"
      className="add-btn"
      aria-label={이름}
      title={이름}
      aria-disabled={잠김 || undefined}
      onClick={onClick}
    >
      <AddIcon />
    </button>
  );
}
