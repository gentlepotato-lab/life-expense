import GroupTap from "./GroupTap";
import type { EntryGroup } from "../../utils/groups";

/**
 * 묶음 한 덩이의 머리말.
 *
 * 누르는 법이 내역 카드와 같다 — 그냥 누르면 펼쳐지고 접히고, 꾹 누르면
 * 묶음 팝업이 열린다. 날짜 단 머리말이 눌러서 접히는 자리였으므로 그 손버릇을
 * 그대로 두고, 더 들어가는 일만 꾹 누르기로 받는다.
 *
 * 접기 손잡이와 선택 상자는 제 일을 한다. 둘 다 button이라 꾹 누르기가
 * 처음부터 비켜 간다(useLongPress).
 */
export default function GroupHead({
  group,
  open,
  onToggle,
  onOpen,
  picked,
  onTogglePick,
}: {
  group: EntryGroup;
  open: boolean;
  onToggle: () => void;
  /** 꾹 눌러서 묶음 팝업을 연다. */
  onOpen: () => void;
  picked: boolean;
  onTogglePick: () => void;
}) {
  const 합 = Math.abs(group.net).toLocaleString("ko-KR");
  const 부호 = group.net > 0 ? "plus" : group.net < 0 ? "minus" : "zero";

  return (
    <GroupTap
      className="date-group__head is-collapsible mk-head"
      label={open ? `묶음 ${group.name} 접기` : `묶음 ${group.name} 펼치기`}
      onToggle={onToggle}
      onOpen={onOpen}
    >
      <button
        type="button"
        className={`set-toggle ${open ? "open" : ""}`}
        aria-label={open ? `${group.name} 접기` : `${group.name} 펼치기`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M9 5.5 L16 12 L9 18.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <button
        type="button"
        className={`pe-pick${picked ? " pe-pick--on" : ""}`}
        aria-pressed={picked}
        title={picked ? "선택 해제" : "선택"}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePick();
        }}
      >
        ✓
      </button>

      {/* 이름은 네모난 딱지에 담는다. 앞에 클립을 세워 두었는데 걷었다 —
          카드마다 클립이 이미 서 있어 머리말까지 같은 그림을 두면 한 화면에
          클립이 여럿 선다. */}
      <span className="date-group__label">{group.name}</span>
      <span className="date-group__count" title={`${group.count}건`}>
        {group.count}
      </span>
      {/* 합계는 접든 펼치든 적는다. 펼치면 날짜 단마다 그날 합계가 서지만
          그것들은 하루치일 뿐이라, 묶음 전체의 셈은 여기 말고는 적힐 데가
          없다. 날이 여럿인 묶음일수록 더 그렇다. */}
      <span className="date-group__meta">
        <span className={`date-group__sum ${부호}`}>
          {group.net > 0 ? "+" : group.net < 0 ? "−" : ""}
          {합}
        </span>
      </span>
    </GroupTap>
  );
}
