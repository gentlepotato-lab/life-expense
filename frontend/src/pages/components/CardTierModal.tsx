import { useMemo, useState } from "react";
import CardEditModal from "./CardEditModal";

/**
 * 실적 구간 하나를 적는 팝업.
 *
 * 결제 수단 화면에서 카드 줄을 펼치고 [+] 를 누르거나, 이미 적어 둔 구간의
 * [상세] 를 누르면 열린다. 한 번에 한 구간만 다룬다 — 여러 구간을 한 판에
 * 늘어놓으면 판이 늘었다 줄었다 하고, 지금 무엇을 고치는지도 흐려진다.
 *
 * 두 단이 딸린다.
 *   혜택(디지털 구독 할인 · 월간 통합 할인한도 이내, 결제금액 100% 할인)
 *     └ 대상(OTT — 넷플릭스, 유튜브프리미엄 …)
 *
 * 담는 곳은 화면이 갖고 있다. 여기서는 고친 구간 하나만 돌려주고,
 * 카드 한 장치를 통째로 저장하는 일은 부르는 쪽이 맡는다.
 */

export type TierTarget = { area: string; stores: string };
/** limit 는 월간 통합 할인한도. 없는 혜택도 있어 빈 글일 수 있다 */
export type TierBenefit = { content: string; memo: string; limit: string; targets: TierTarget[] };
export type TierDraft = { threshold: string; benefits: TierBenefit[] };

/** 이미 적어 둔 혜택 한 벌 — 고르면 내용까지 그대로 옮겨 온다 */
export type BenefitHint = { label: string; benefit: TierBenefit };

/** 화면 안에서만 쓰는 줄 번호 — 저장하면 서버가 새로 매긴다 */
let seq = 0;
const nextKey = () => {
  seq += 1;
  return `k${seq}`;
};

type Target = TierTarget & { key: string };
type Benefit = { key: string; content: string; memo: string; limit: string; targets: Target[] };

const trim = (b: Benefit[]) =>
  JSON.stringify(
    b
      .filter((x) => x.content.trim())
      .map((x) => [
        x.content.trim(),
        x.memo.trim(),
        x.limit.trim(),
        x.targets.filter((t) => t.stores.trim()).map((t) => [t.area.trim(), t.stores.trim()]),
      ])
  );

export default function CardTierModal({
  cardName,
  tier,
  hints,
  onClose,
  onSave,
}: {
  cardName: string;
  /** 고칠 구간. 새로 만들 때는 null */
  tier: TierDraft | null;
  /** 이 카드에 이미 적어 둔 혜택들 — 고르면 내용까지 그대로 채운다 */
  hints: BenefitHint[];
  onClose: () => void;
  onSave: (next: TierDraft) => void;
}) {
  const [threshold, setThreshold] = useState(tier?.threshold ?? "");
  const [benefits, setBenefits] = useState<Benefit[]>(() => {
    if (!tier) {
      /* 새로 만들 때는 빈 칸을 한 벌 깔아 둔다 — 텅 빈 판만 뜨면
         무엇을 어디에 적는 자리인지 알 수가 없다. 내용이 없으므로
         이대로 두고 저장해도 담기지 않는다. */
      return [
        {
          key: nextKey(),
          content: "",
          memo: "",
          limit: "",
          targets: [{ key: nextKey(), area: "", stores: "" }],
        },
      ];
    }
    return tier.benefits.map((b) => ({
      key: nextKey(),
      content: b.content,
      memo: b.memo,
      limit: b.limit ?? "",
      targets: b.targets.map((t) => ({ key: nextKey(), area: t.area, stores: t.stores })),
    }));
  });

  const before = useMemo(
    () => `${tier?.threshold ?? ""}|${trim(
      (tier?.benefits ?? []).map((b) => ({
        key: "",
        content: b.content,
        memo: b.memo,
        limit: b.limit ?? "",
        targets: b.targets.map((t) => ({ key: "", area: t.area, stores: t.stores })),
      }))
    )}`,
    [tier]
  );
  const dirty = `${threshold}|${trim(benefits)}` !== before;

  const patch = (key: string, next: (b: Benefit) => Benefit) =>
    setBenefits((prev) => prev.map((b) => (b.key === key ? next(b) : b)));

  /* 혜택 이름을 누르면 이미 쓰던 이름을 골라 넣을 수 있게 한다.
     한 구간에 붙는 혜택은 다음 구간에도 그대로 붙는 일이 많아, 매번
     다시 치면 같은 것이 조금씩 다른 이름으로 쌓인다.

     칸 목록은 키가 못 박힌 채 굴러서, 안쪽에 붙이면 잘린다.
     화면에 붙이고(position: fixed) 자리만 칸에서 받아 온다 —
     결제 수단 고르기(SingleSelect)가 쓰는 방식 그대로다. */
  const [hintFor, setHintFor] = useState<string | null>(null);
  const [hintBox, setHintBox] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  const boxOf = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return { top: r.bottom + 4, left: r.left, width: r.width };
  };

  const openHints = (key: string, el: HTMLInputElement) => {
    setHintBox(boxOf(el));
    setHintFor(key);
  };

  /* 칸이 굴러가면 목록도 따라간다. 닫아 버리면, 칸을 누르는 순간 그 칸을
     보이게 하려고 저절로 구르는 바람에 목록이 뜨자마자 사라진다. */
  const followHints = () => {
    if (!hintFor) return;
    const el = document.activeElement;
    if (el instanceof HTMLInputElement && el.classList.contains("benefit__name")) {
      setHintBox(boxOf(el));
    } else {
      setHintFor(null);
    }
  };

  /** 이 구간에서 아직 안 쓴 것만. 치는 중이면 그 글자가 든 것만 */
  const hintsFor = (b: Benefit) => {
    const typed = b.content.trim();
    const used = new Set(benefits.filter((x) => x.key !== b.key).map((x) => x.content.trim()));
    return hints
      .filter((h) => h.benefit.content && !used.has(h.benefit.content))
      .filter((h) => !typed || h.benefit.content.includes(typed));
  };

  const save = () =>
    onSave({
      threshold: threshold.trim(),
      benefits: benefits
        .filter((b) => b.content.trim())
        .map((b) => ({
          content: b.content.trim(),
          memo: b.memo.trim(),
          limit: b.limit.trim(),
          targets: b.targets
            .filter((t) => t.stores.trim())
            .map((t) => ({ area: t.area.trim(), stores: t.stores.trim() })),
        })),
    });

  return (
    <CardEditModal
      title={cardName}
      onClose={onClose}
      onSave={save}
      saveDisabled={!dirty || threshold.trim() === ""}
    >
      {/* 키를 미리 잡아 둔다 — 혜택을 늘리고 줄일 때마다 판이 들썩이면
          지금 무엇을 고치고 있었는지 눈이 놓친다 */}
      <div className="tier-pop" onScroll={followHints}>
        <div className="tier-pop__amount">
          <input
            type="number"
            className="amount-input"
            value={threshold}
            placeholder="(금액)"
            onChange={(e) => setThreshold(e.target.value)}
            autoFocus
          />
          <span className="tier__unit">원 이상</span>
        </div>

        {benefits.map((b) => (
          <article key={b.key} className="benefit">
            <div className="benefit__head">
              <input
                type="text"
                className="benefit__name"
                value={b.content}
                placeholder="(혜택)"
                maxLength={200}
                autoComplete="off"
                onChange={(e) => {
                  patch(b.key, (x) => ({ ...x, content: e.target.value }));
                  openHints(b.key, e.target);
                }}
                onFocus={(e) => openHints(b.key, e.target)}
                onBlur={() => setHintFor(null)}
              />
              <button
                type="button"
                className="set-remove"
                title="이 혜택 제거"
                aria-label="혜택 제거"
                onClick={() => setBenefits((prev) => prev.filter((x) => x.key !== b.key))}
              >
                ×
              </button>
            </div>

            {hintFor === b.key && hintsFor(b).length > 0 && (
              <div
                className="ms-dropdown benefit__hints"
                style={{ top: hintBox.top, left: hintBox.left, width: hintBox.width }}
              >
                {hintsFor(b).map((h) => (
                  <div
                    key={h.label}
                    className="ms-option"
                    /* 누르는 순간 칸이 focus 를 잃어 목록이 먼저 닫힌다.
                       mousedown 은 blur 보다 먼저라 여기서 받는다. */
                    onMouseDown={(e) => {
                      e.preventDefault();
                      /* 이름만이 아니라 적어 둔 것을 통째로 물어 온다 —
                         같은 이름이라도 구간마다 내용과 대상이 다르다 */
                      patch(b.key, (x) => ({
                        ...x,
                        content: h.benefit.content,
                        memo: h.benefit.memo,
                        limit: h.benefit.limit ?? "",
                        targets: h.benefit.targets.map((t) => ({
                          key: nextKey(),
                          area: t.area,
                          stores: t.stores,
                        })),
                      }));
                      setHintFor(null);
                    }}
                  >
                    {h.label}
                  </div>
                ))}
              </div>
            )}

            <input
              type="text"
              className="benefit__memo"
              value={b.memo}
              placeholder="(상세)"
              maxLength={200}
              onChange={(e) => patch(b.key, (x) => ({ ...x, memo: e.target.value }))}
            />

            {/* 월간 통합 할인한도 — 상세 글에 섞어 적으면 셈에 쓸 수가 없다 */}
            <div className="benefit__limit">
              <span className="edit-field__label">한도</span>
              <input
                type="number"
                className="amount-input"
                value={b.limit}
                placeholder="(금액)"
                onChange={(e) => patch(b.key, (x) => ({ ...x, limit: e.target.value }))}
              />
              <span className="tier__unit">원</span>
            </div>

            <div className="benefit__targets">
              <span className="edit-field__label">대상</span>

              {b.targets.map((tg) => (
                <div key={tg.key} className="target">
                  <input
                    type="text"
                    className="target__area"
                    value={tg.area}
                    placeholder="(영역)"
                    maxLength={60}
                    onChange={(e) =>
                      patch(b.key, (x) => ({
                        ...x,
                        targets: x.targets.map((y) =>
                          y.key === tg.key ? { ...y, area: e.target.value } : y
                        ),
                      }))
                    }
                  />
                  <input
                    type="text"
                    className="target__stores"
                    value={tg.stores}
                    placeholder="(가맹점)"
                    maxLength={400}
                    onChange={(e) =>
                      patch(b.key, (x) => ({
                        ...x,
                        targets: x.targets.map((y) =>
                          y.key === tg.key ? { ...y, stores: e.target.value } : y
                        ),
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="set-remove"
                    title="이 대상 제거"
                    aria-label="대상 제거"
                    onClick={() =>
                      patch(b.key, (x) => ({
                        ...x,
                        targets: x.targets.filter((y) => y.key !== tg.key),
                      }))
                    }
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="ui-btn small tier__add"
                onClick={() =>
                  patch(b.key, (x) => ({
                    ...x,
                    targets: [...x.targets, { key: nextKey(), area: "", stores: "" }],
                  }))
                }
              >
                [+] 대상
              </button>
            </div>
          </article>
        ))}

        <button
          type="button"
          className="ui-btn small tier__add"
          onClick={() =>
            setBenefits((prev) => [
              ...prev,
              { key: nextKey(), content: "", memo: "", limit: "", targets: [] },
            ])
          }
        >
          [+] 혜택
        </button>
      </div>
    </CardEditModal>
  );
}
