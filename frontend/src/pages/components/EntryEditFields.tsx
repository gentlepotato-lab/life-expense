import SingleSelect from "./SingleSelect";
import GrowArea from "./GrowArea";
import SplitEditor, { type SplitDraft } from "./SplitEditor";
import { EditField, EditDivider } from "./CardEditModal";
import { visible } from "../../utils/visible";

/**
 * 고치는 중인 한 건.
 *
 * 화면마다 담아 오는 칸이 조금씩 달라, 쓰는 칸만 이름으로 적고 나머지는
 * 열어 둔다. Record<string, unknown>으로만 두면 쓰는 칸마다 좁히는 일이
 * 생기고, any로 두면 적어 둔 규칙을 어긴다.
 */
export type EditDraft = {
  entry_id?: number;
  schedule_id?: number;
  tx_date?: string | null;
  cat1_id?: number | null;
  cat2_id?: number | null;
  cat3_id?: number | null;
  inout?: number | null;
  amount?: number | string | null;
  pay_method?: string | number | null;
  memo?: string | null;
  place_id?: number | null;
  place_name?: string | null;
  place_lat?: number | null;
  place_lng?: number | null;
  kakao_id?: string | null;
  address_name?: string | null;
  road_address_name?: string | null;
  phone?: string | null;
  category_name?: string | null;
  category_group_code?: string | null;
  category_group_name?: string | null;
  place_url?: string | null;
  split_count?: number;
  [key: string]: unknown;
};

/**
 * 지출 한 건을 고치는 칸들.
 *
 * 지출 내역의 편집 팝업에 들어 있던 것을 그대로 떼어 왔다. 묶음 내역과 기간
 * 내역에서도 같은 자리에서 고칠 수 있어야 하는데, 같은 칸을 세 벌 적어 두면
 * 한 곳만 고쳐 놓고 나머지를 잊는다. 담는 팝업(CardEditModal)과 저장하는
 * 길은 부르는 쪽이 들고, 여기는 칸만 그린다.
 */
export default function EntryEditFields({
  draft,
  setField,
  cat1List,
  cat2List,
  cat3List,
  payList,
  splits,
  setSplits,
  onPickPlace,
}: {
  draft: EditDraft;
  setField: (field: string, value: unknown) => void;
  cat1List: { id: number; name: string; is_active?: number }[];
  cat2List: { id: number; name: string; cat1_id: number; is_active?: number }[];
  cat3List: { id: number; name: string; cat2_id: number; is_active?: number }[];
  payList: { code: string; name: string; is_active?: number }[];
  splits: SplitDraft[];
  setSplits: (next: SplitDraft[]) => void;
  /** 장소 고르개를 연다. 고른 뒤 무엇을 할지는 부르는 쪽이 정한다. */
  onPickPlace: () => void;
}) {
  return (
    <>
      <div className="edit-grid">
        {/* 1행 — 분류 3단 */}
        <EditField label="중분류" span={4} required>
          <SingleSelect
            noun="중분류"
            options={visible(cat1List, (c) => c.id === draft.cat1_id)
              .map(c => ({ value: String(c.id), label: c.name }))}
            selected={draft.cat1_id ? String(draft.cat1_id) : ""}
            onChange={(value) => setField("cat1_id", value ? Number(value) : null)}
            placeholder="(중분류)"
          />
        </EditField>

        <EditField label="소분류" span={4} required>
          <SingleSelect
            noun="소분류"
            options={visible(cat2List, (c) => c.id === draft.cat2_id)
              .filter((c) => c.cat1_id === draft.cat1_id)
              .map(c => ({ value: String(c.id), label: c.name }))}
            selected={draft.cat2_id ? String(draft.cat2_id) : ""}
            onChange={(value) => setField("cat2_id", value ? Number(value) : null)}
            placeholder="(소분류)"
          />
        </EditField>

        <EditField label="세분류" span={4}>
          <SingleSelect
            noun="세분류"
            options={visible(cat3List, (c) => c.id === draft.cat3_id)
              .filter((c) => c.cat2_id === draft.cat2_id)
              .map(c => ({ value: String(c.id), label: c.name }))}
            selected={draft.cat3_id ? String(draft.cat3_id) : ""}
            onChange={(value) => setField("cat3_id", value ? Number(value) : null)}
            placeholder="(세분류)"
          />
        </EditField>

        {/* 2행 — 거래 속성. IN/OUT은 소분류가 결정하므로 분류 바로 아래에 둔다. */}
        <EditField label="IN/OUT" span={4} required>
          <span className={`inout-chip ${draft.inout === 1 ? "in" : draft.inout === -1 ? "out" : ""}`}>
            {draft.inout === 1 ? "IN(+)" : draft.inout === -1 ? "OUT(−)" : "—"}
          </span>
        </EditField>

        <EditField label="결제 수단" span={4}>
          <SingleSelect
            noun="결제 수단"
            options={visible(payList, (p) => p.code === draft.pay_method)
              .map(p => ({ value: p.code, label: p.name }))}
            selected={draft.pay_method || ""}
            onChange={(value) => setField("pay_method", value)}
            placeholder="(결제 수단)"
          />
        </EditField>

        <EditField label="금액" span={4} required>
          <input
            type="number"
            value={draft.amount ?? ""}
            onChange={(e) => setField("amount", e.target.value === "" ? "" : Number(e.target.value))}
            className="amount-input"
          />
        </EditField>

        {/* 3행 — 장소 */}
        <EditField label="장소/가게" span={12}>
          <div className="edit-place">
            <span className="edit-place__name">📍 {draft.place_name || "—"}</span>
            <button
              type="button"
              className="ui-btn small edit-location-btn"
              onClick={() => onPickPlace()}
            >
              변경
            </button>
          </div>
        </EditField>

        {/* 4행 — 메모 */}
        <EditField label="메모" span={12}>
          <GrowArea
            className="memo-input memo-area"
            value={draft.memo || ""}
            maxLength={200}
            onChange={(v) => setField("memo", v)}
          />
        </EditField>
      </div>

      {/* 금액 쪼개기 — 지출일 때만 의미가 있다. */}
      {draft.inout === -1 && (
        <>
          <EditDivider />
          <SplitEditor
            grossAmount={Number(draft.amount) || 0}
            value={splits}
            onChange={setSplits}
          />
        </>
      )}
    </>
  );
}
