import useBackClose from "../../hooks/useBackClose";
import { manwon } from "../../utils/amount";

/** 혜택 하나에 걸린 대상 — 어느 영역의 무엇인지 */
export type PerkTarget = { area: string | null; detail: string | null };
/** limit는 월간 통합 할인한도. 없는 혜택도 있어 비어 있을 수 있다. */
export type PerkBenefit = {
  content: string;
  description: string | null;
  limit: number | null;
  targets: PerkTarget[];
};
export type PerkTier = { threshold: number; benefits: PerkBenefit[] };

/**
 * 카드 실적 구간별 혜택 보기.
 *
 * 씀씀이의 실적 띠는 어디까지 왔는지만 말한다. 그 눈금을 넘기면 무엇이
 * 돌아오는지는 결제 수단 화면까지 가야 알 수 있었다 — 정작 견주어 보고
 * 싶은 순간은 실적을 보고 있는 지금이다. 그래서 여기서 바로 펼친다.
 *
 * 고치지는 않는다. 적어 두는 자리는 결제 수단 화면 하나로 남긴다.
 *
 * 결제 수단 화면에서도 같은 부품을 쓴다. 다만 그 화면은 이 달에 얼마를
 * 그었는지를 모르므로(카드를 적어 두는 자리이지 셈하는 자리가 아니다)
 * charged 를 싣지 않는다. 그때는 어느 구간을 넘겼는지 표시하지 않는다 —
 * 모르는 것을 "못 넘겼다"고 적으면 거짓이 된다.
 */
export default function CardPerkPopup({
  cardName,
  tiers,
  charged,
  onClose,
}: {
  cardName: string;
  /** 구간들. 문턱이 낮은 것부터 */
  tiers: PerkTier[];
  /** 이 달에 그 카드로 그은 돈 — 어느 구간까지 왔는지 표시하는 데 쓴다.
      모르는 자리에서는 싣지 않는다. */
  charged?: number;
  onClose: () => void;
}) {
  useBackClose(true, onClose);

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-panel popup-panel--framed"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${cardName} 실적 구간별 혜택`}
      >
        <header className="popup-head">
          <h3 className="popup-head__title">{cardName} 혜택</h3>
        </header>

        <div className="popup-body perk-body">
          {tiers.map((t, i) => {
            const reached = charged !== undefined && charged >= t.threshold;
            return (
              <section key={i} className={`perk-tier${reached ? " is-reached" : ""}`}>
                <header className="perk-tier__head">
                  <span className="perk-tier__amount">{manwon(t.threshold)} 이상</span>
                  {reached && <span className="perk-tier__flag">달성</span>}
                </header>

                {t.benefits.length === 0 ? (
                  <p className="perk-empty">적어 둔 혜택이 없다.</p>
                ) : (
                  <ul className="perk-list">
                    {t.benefits.map((b, j) => (
                      <li key={j} className="perk">
                        <span className="perk__top">
                          <span className="perk__content">{b.content}</span>
                          {/* 한도는 줄여 적지 않는다 — 얼마까지 돌려받는지는
                              자리 수까지 그대로 보여야 셈이 된다. */}
                          {b.limit !== null && (
                            <span className="perk__limit">
                              한도 {Math.round(b.limit).toLocaleString("ko-KR")}원
                            </span>
                          )}
                        </span>
                        {b.description && (
                          <span className="perk__desc">{b.description}</span>
                        )}
                        {/* 대상은 줄로 세운다 — 가게 이름을 여럿 적어 둔 것이 많아
                            알약에 담으면 알약 하나가 서너 줄로 부푼다. */}
                        {b.targets.map((g, k) => (
                          <span key={k} className="perk__target">
                            {g.area && <span className="perk__area">{g.area}</span>}
                            <span className="perk__detail">{g.detail}</span>
                          </span>
                        ))}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        <div className="btn-row popup-foot popup-foot--tight">
          <button className="ui-btn" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
