import DayPicker from "./DayPicker";
import { EditField } from "./CardEditModal";

/**
 * 거르기 팝업의 날짜 두 칸.
 *
 * 쪽마다 묻는 것은 다르지만 기간을 묻는 칸은 같다. 다섯 쪽이 저마다 같은
 * 두 칸을 또 적지 않도록 여기 한 곳에 둔다.
 *
 * 둘 다 비우고 적용하면 달 단위로 돌아간다(hooks/useAdminPeriod.ts의
 * 기간걸기). 그 말은 팝업 아래 거드는 줄이 적는다.
 */
export default function AdminPeriodFields({
  frm,
  to,
  on바뀜,
}: {
  frm: string;
  to: string;
  on바뀜: (값: { frm: string; to: string }) => void;
}) {
  return (
    <>
      <EditField label="시작일" span={6}>
        <DayPicker
          monthJump
          clearable
          value={frm}
          onChange={(v) => on바뀜({ frm: v, to })}
        />
      </EditField>

      <EditField label="종료일" span={6}>
        <DayPicker
          monthJump
          clearable
          value={to}
          onChange={(v) => on바뀜({ frm, to: v })}
        />
      </EditField>
    </>
  );
}
