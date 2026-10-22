/**
 * 아직 속을 채우지 않은 자리.
 *
 * 길과 이름과 알약은 먼저 세우고 속만 뒤에 채운다. 길부터 세우는 까닭은
 * 자리를 늘릴 때마다 탭과 알약이 흔들리면, 그때마다 바닥 막대와 머리말을
 * 다시 재야 하기 때문이다.
 *
 * 글은 돈쓴이의 빈 자리가 쓰는 것과 같다(pages/Me.tsx). 「준비 중입니다.」
 * 판은 대시보드가 집계를 기다릴 때 쓰는 그 판이다(.card.admin-soon).
 */
export default function AdminSoon() {
  return (
    <div className="card admin-soon">
      <p className="page-empty">준비 중입니다.</p>
    </div>
  );
}
