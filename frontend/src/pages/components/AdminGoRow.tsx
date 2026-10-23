import useLongPress from "../../hooks/useLongPress";

/**
 * 꾹 눌러 상세로 들어가는 표의 줄.
 *
 * 톡 눌러 열게 두면 표를 훑어 내리다가 화면이 바뀐다. 사용자 사이트가 카드를
 * 꾹 눌러 여는 것과 같은 잣대다(hooks/useLongPress.ts).
 *
 * 줄마다 훅을 하나씩 걸어야 하므로 부품으로 뗀다. map() 안에서는 훅을 부를
 * 수 없다. 이름을 영어로 적는 것은 한글 이름이면 react-hooks 규칙이 부품으로
 * 알아보지 못하기 때문이다.
 */
export default function AdminGoRow({
  on상세,
  className = "",
  children,
}: {
  on상세: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const { pressing, handlers } = useLongPress(on상세);

  return (
    <tr
      className={`admin-tbl__go${pressing ? " pressing" : ""}${
        className ? ` ${className}` : ""
      }`}
      title="꾹 눌러서 상세"
      {...handlers}
    >
      {children}
    </tr>
  );
}
