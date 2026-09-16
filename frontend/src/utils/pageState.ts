/**
 * 상세로 갔다 되돌아올 때 보던 자리를 되살린다.
 *
 * 달력에서 날을 고르고, 씀씀이에서 카드 실적을 펼쳐 둔 채 상세로 건너뛰면
 * 되돌아왔을 때 그 화면은 새로 그려진다 — 고른 날도 펼친 것도 사라진다.
 * 그래서 건너뛰기 전에 그 화면이 제 상태를 여기에 맡겨 둔다.
 *
 * 되돌아온 것인지는 브라우저가 들고 있는 **자리 번호**로 가린다. 라우터가
 * 오갈 때마다 history.state.idx에 한 칸씩 번호를 매겨 두는데, 뒤로 가면 맡길
 * 때의 그 번호로 되돌아오고 탭으로 새로 들어가면 다음 번호가 붙는다.
 * 번호가 같을 때만 내주므로 되돌아가기 단추든 기기의 뒤로 가기든 똑같이 살고,
 * 탭으로 새로 들어오면 늘 하던 대로 빈 화면에서 시작한다.
 *
 * 한 판 안에서만 사는 값이라 어디에도 적어 두지 않는다.
 */

type Kept = { idx: number; snap: unknown };

const bag = new Map<string, Kept>();

/** 지금 보고 있는 history 자리의 번호. 라우터가 매기지 않았으면 없다. */
function entryIndex(): number | null {
  const st = window.history.state as { idx?: number } | null;
  return st && typeof st.idx === "number" ? st.idx : null;
}

/** 떠나기 전에 보던 자리를 맡긴다. */
export function stash(key: string, snap: unknown): void {
  const idx = entryIndex();
  if (idx === null) return;
  bag.set(key, { idx, snap });
}

/** 맡겨 둔 것을 꺼낸다. 맡길 때의 그 자리로 되돌아온 것이 아니면 주지 않는다. */
export function takeStash<T>(key: string): T | null {
  const kept = bag.get(key);
  if (!kept) return null;
  if (kept.idx !== entryIndex()) return null;
  bag.delete(key);
  return kept.snap as T;
}
