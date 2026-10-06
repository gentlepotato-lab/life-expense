import { useEffect, useState } from "react";
import axios from "../../api/client";
import CardEditModal, { EditField } from "./CardEditModal";
import DayPicker from "./DayPicker";
import EntryEditFields, { type EditDraft } from "./EntryEditFields";
import PlacePicker from "./PlacePicker";
import { type SplitDraft } from "./SplitEditor";
import { ask, say } from "../../utils/notify";
import { apiErrorMessage } from "../../utils/apiError";
import type { GroupKind } from "../../utils/groups";

type Draft = EditDraft;

/**
 * 카드가 분류와 결제 수단 이름을 적는 데 쓰는 기준 자료.
 *
 * 화면마다 조금씩 다른 모양으로 들고 있다. 넘기는 쪽을 고치면 그 화면의
 * 기존 동작을 건드리게 되므로 여기서 넉넉히 받고 칸에 넘길 때 맞춘다.
 */
export type EditMeta = {
  cat1List: { id: number; name: string; is_active?: number }[];
  cat2List: { id: number; name: string; cat1_id?: number; inout?: number | null; is_active?: number }[];
  cat3List: { id: number; name: string; cat2_id?: number; is_active?: number }[];
  payList: { code: string; name: string; is_active?: number }[];
};

/** 갈래마다 자리와 열쇠 칸이 다르다. 분기를 여기 한 곳에만 둔다. */
const 자리: Record<GroupKind, { base: string; pk: string }> = {
  entry: { base: "/entries", pk: "entry_id" },
  pending: { base: "/pending-entries", pk: "entry_id" },
  scheduled: { base: "/scheduled-entries", pk: "schedule_id" },
};

/**
 * 한 건을 고치는 팝업 — 제 화면이 아닌 곳에서 부른다.
 *
 * 묶음 내역과 기간 내역은 세 갈래(지출, 대기, 정기)의 건을 한자리에 모아
 * 보여 준다. 고치는 자리가 거기에도 있어야 하는데, 세 화면의 편집 팝업을
 * 저마다 다시 적으면 한 곳만 고쳐 놓고 나머지를 잊는다. 칸은 떼어 둔
 * 부품(EntryEditFields)을 쓰고, 여기서는 담고 저장하는 일만 맡는다.
 *
 * 고친 뒤에는 부르는 쪽이 다시 받아 온다(onSaved). 이 자리에서 목록을
 * 손보지 않는다 — 어느 목록에 들어 있는지는 부르는 쪽만 안다.
 *
 * 정기는 받지 않는다. 한 건이 아니라 앞으로 계속 올 약속이라, 주기와 휴일
 * 처리와 끝 달과 감추기를 함께 봐야 고친 뜻이 온전해진다. 날짜와 금액만
 * 고치게 두면 다음에 언제 올지가 어긋난다. 그 자리는 정기 내역 한 곳이다.
 * 부르는 쪽에서도 막지만, 여기서 한 번 더 막아 둔다.
 */
export default function EntryEditHost({
  kind,
  row,
  meta,
  onSaved,
  onClose,
}: {
  kind: GroupKind;
  row: Draft;
  meta: EditMeta;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>({ ...row });
  const [splits, setSplits] = useState<SplitDraft[]>([]);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  /* 칸 부품이 바라는 모양으로 맞춘다. 빠진 칸은 이름을 찾을 때만 쓰므로
     채워 넣어도 보이는 것이 달라지지 않는다. */
  const cat2List = meta.cat2List.map((c) => ({ ...c, cat1_id: c.cat1_id ?? 0 }));
  const cat3List = meta.cat3List.map((c) => ({ ...c, cat2_id: c.cat2_id ?? 0 }));

  const { base, pk } = 자리[kind];
  const id = (row[pk] ?? row.entry_id) as number;

  /* 분할은 목록에 합계만 실려 오므로 고칠 때 상세를 따로 가져온다. */
  useEffect(() => {
    if (!((row.split_count ?? 0) > 0)) return;
    let 살아있나 = true;
    axios
      .get(`${base}/${id}/splits`)
      .then((r) => {
        if (!살아있나) return;
        setSplits(
          r.data.map((s: SplitDraft) => ({
            amount: s.amount,
            counterpart_id: s.counterpart_id,
            memo: s.memo,
          }))
        );
      })
      .catch(() => setSplits([]));
    return () => {
      살아있나 = false;
    };
  }, [base, id, row.split_count]);

  const setField = (field: string, value: unknown) => {
    setDraft((prev) => {
      const next = { ...prev, [field]: value };
      /* 소분류가 IN/OUT을 정한다. 지출 내역의 편집과 같은 셈이다. */
      if (field === "cat2_id") {
        const 소 = meta.cat2List.find((c) => c.id === value);
        if (소 && 소.inout !== null && 소.inout !== undefined) next.inout = 소.inout;
        if (prev.cat2_id !== value) next.cat3_id = null;
      }
      if (field === "cat1_id" && prev.cat1_id !== value) {
        next.cat2_id = null;
        next.cat3_id = null;
      }
      return next;
    });
  };

  const save = async () => {
    if (saving) return;
    if (!draft.tx_date || !draft.cat1_id || !draft.cat2_id ||
        draft.amount == null || draft.amount === "" || !draft.pay_method) {
      say.warn("날짜, IN/OUT, 분류, 금액, 결제 수단은 꼭 넣어 주세요.");
      return;
    }

    const 쓸몫 = splits.filter((s) => s.amount !== "" && Number(s.amount) > 0);
    if (쓸몫.length !== splits.length) {
      say.warn("쪼갠 금액은 0보다 커야 합니다.");
      return;
    }
    if (쓸몫.reduce((a, r) => a + Number(r.amount), 0) > Number(draft.amount)) {
      say.warn("쪼갠 합계가 결제 금액을 넘었습니다.");
      return;
    }

    /* 장소는 place_id가 있으면 서버가 그 장소를 그대로 쓴다. 나머지 칸은
       고르개로 새 장소를 골랐을 때만 채워진다. */
    const 담을것 = {
      [pk]: id,
      tx_date: String(draft.tx_date).substring(0, 10),
      cat1_id: draft.cat1_id ?? null,
      cat2_id: draft.cat2_id ?? null,
      cat3_id: draft.cat3_id ?? null,
      inout: draft.inout,
      amount: Number(draft.amount),
      pay_method: draft.pay_method ?? null,
      memo: draft.memo ?? null,
      place_id: draft.place_id ?? null,
      place_name: draft.place_name ?? null,
      place_lat: draft.place_lat ?? null,
      place_lng: draft.place_lng ?? null,
      kakao_id: draft.kakao_id ?? null,
      address_name: draft.address_name ?? null,
      road_address_name: draft.road_address_name ?? null,
      phone: draft.phone ?? null,
      category_name: draft.category_name ?? null,
      category_group_code: draft.category_group_code ?? null,
      category_group_name: draft.category_group_name ?? null,
      place_url: draft.place_url ?? null,
    };

    setSaving(true);
    try {
      if (kind === "entry") await axios.put("/entries/bulk", [담을것]);
      else await axios.put(`${base}/${id}`, 담을것);
      /* 분할은 따로 보낸다. 비어 있어도 보내야 예전 몫이 지워진다. */
      await axios.put(`${base}/${id}/splits`, 쓸몫);
      say.ok("저장 완료-!! ;-)");
      onClose();
      onSaved();
    } catch (err: unknown) {
      say.bad(apiErrorMessage(err, "저장하지 못했습니다. 다시 시도해 주세요."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (saving) return;
    const 예 = await ask({
      title: "내역 제거",
      warn: "되돌릴 수 없습니다.",
      go: "제거",
      danger: true,
    });
    if (!예) return;
    setSaving(true);
    try {
      await axios.delete(`${base}/${id}`);
      say.ok("제거 완료-!! ;-)");
      onClose();
      onSaved();
    } catch (err: unknown) {
      say.bad(apiErrorMessage(err, "제거하지 못했습니다. 다시 시도해 주세요."));
    } finally {
      setSaving(false);
    }
  };

  if (kind === "scheduled") return null;

  return (
    <>
      <CardEditModal
        title="내역 편집"
        onClose={onClose}
        onSave={save}
        onDelete={remove}
        headerFields={
          <EditField label="날짜" span={12} required>
            <DayPicker
              value={draft.tx_date ? String(draft.tx_date).substring(0, 10) : ""}
              onChange={(v) => setField("tx_date", v)}
            />
          </EditField>
        }
      >
        <EntryEditFields
          draft={draft}
          setField={setField}
          cat1List={meta.cat1List}
          cat2List={cat2List}
          cat3List={cat3List}
          payList={meta.payList}
          splits={splits}
          setSplits={setSplits}
          onPickPlace={() => setPlaceOpen(true)}
        />
      </CardEditModal>

      {placeOpen && (
        <PlacePicker
          onSelect={(place) => {
            setDraft((prev) => ({
              ...prev,
              place_id: place.place_id ?? null,
              place_name: place.place_name,
              place_lat: place.lat,
              place_lng: place.lng,
              kakao_id: place.kakao_id,
              address_name: place.address_name,
              road_address_name: place.road_address_name,
              phone: place.phone,
              category_name: place.category_name,
              category_group_code: place.category_group_code,
              category_group_name: place.category_group_name,
              place_url: place.place_url,
            }));
            setPlaceOpen(false);
          }}
          onClose={() => setPlaceOpen(false)}
        />
      )}
    </>
  );
}
