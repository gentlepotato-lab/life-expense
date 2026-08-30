import { Fragment, useEffect, useMemo, useState } from "react";
import axios from "../api/client";
import QuickActions from "./components/QuickActions";
import PlaceMapPopup from "./components/PlaceMapPopup";
import PlacePeriodPopup from "./components/PlacePeriodPopup";
import CollapseToggle, { CollapseAllButtons } from "./components/CollapseToggle";
import {
  allKeys,
  board,
  narrow,
  periodLabel,
  recentMonths,
  FOLDS,
  SORTS,
  VIEWS,
  type BoardData,
  type BoardSort,
  type BoardNode,
  type BoardPlace,
  type BoardSpan,
  type BoardView,
  type Period,
} from "../utils/placeBoard";

/**
 * 어디 쓰나 — 적어 둔 장소와 가게.
 *
 * 쓰기에서 장소를 고를 때마다 카카오에서 받아 적어 둔 것들이 쌓여 있는데,
 * 그동안은 고를 때 말고는 볼 자리가 없었다. 어디를 자주 가는지 · 어디에
 * 많이 쓰는지 · 어느 동네에 · 어떤 업종에 다니는지를 한 화면에서 돌려 본다.
 *
 * 잣대 넷은 받아 온 한 벌을 돌려 쓴다(utils/placeBoard.ts) — 넷을 따로 받아
 * 오면 같은 것을 네 번 세게 되고, 500곳 남짓이라 한 벌이 무겁지 않다.
 * 기간만은 서버에서 걸러 온다. 그 기간에 간 곳만 남기고 셈도 그때 것만
 * 세야 하는데, 화면에는 셈한 값만 내려와 있어 다시 셀 재료가 없다.
 *
 * 찾기는 누를 때만 걸린다. 한 글자마다 500곳을 다시 훑을 이유가 없다.
 *
 * 넷 다 맨 위 한 줄(.wh-top)이 같은 자리에 선다 — 잣대를 옮길 때마다 아래가
 * 위아래로 흔들리지 않게 하려는 것이다.
 *
 * 한 줄을 누르면 그 자리가 지도에 찍힌다. 쓰기에서 장소를 고를 때 뜨는
 * 지도와 같은 모양이다.
 */
const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

/**
 * 묶음의 셈 — 청록 딱지로.
 *
 * 다녀온 횟수를 함께 적는다. 묶음 차례를 횟수로 세울 수 있는데 그 값이
 * 안 보이면 왜 그 차례로 섰는지 알 길이 없다.
 */
function Sum({ node }: { node: BoardNode }) {
  return (
    <span className="tag-row wh-sum">
      <span className="tag">{node.visits}번</span>
      <span className="tag">{node.count}곳</span>
      <span className="tag">{won(node.total)}</span>
    </span>
  );
}

/**
 * 묶음 차례를 무엇으로 세울지.
 *
 * 모두 펼치기|접기와 같은 짜임이다 — 이고 있는 말(`정렬`)을 앞에 두고,
 * 누르는 자리는 `횟수`와 `금액`뿐이다.
 */
function SortButtons({
  sort,
  onSort,
}: {
  sort: BoardSort;
  onSort: (next: BoardSort) => void;
}) {
  return (
    <div className="set-bulk wh-sort">
      <span className="set-bulk__all" aria-hidden="true">
        정렬
      </span>
      <span className="set-bulk__pair">
        {SORTS.map((s, i) => (
          /* 가름선은 단추와 형제로 둔다 — 한 겹 더 감싸면 묶음 간격이 한쪽에만
             붙어 가름선 양옆이 어긋난다. */
          <Fragment key={s.key}>
            {i > 0 && <span className="set-bulk__sep" aria-hidden="true" />}
            <button
              type="button"
              className={`set-bulk__btn${sort === s.key ? " on" : ""}`}
              aria-pressed={sort === s.key}
              aria-label={`${s.label}으로 정렬`}
              onClick={() => onSort(s.key)}
            >
              {s.label}
            </button>
          </Fragment>
        ))}
      </span>
    </div>
  );
}

/**
 * 한 줄 — 차례 · 이름 · 어디에 있는 무엇인지 · 값.
 *
 * 곁말은 잣대에 따라 덜어 낸다. 지역으로 묶어 놓고 줄마다 또 구를 적거나,
 * 업종으로 묶어 놓고 줄마다 또 업종을 적으면 묶음 이름을 두 번 읽는 셈이다.
 */
function PlaceRow({
  no,
  place,
  right,
  view,
  onPick,
}: {
  no: number;
  place: BoardPlace;
  right: string;
  view: BoardView;
  onPick: () => void;
}) {
  /* 동네 이름 뒤에 번지가 붙어 있는 것이 대부분이다(`월계동 320-11`).
     줄에 적을 때는 동 이름만 남긴다. */
  const dong = place.town ? place.town.split(" ")[0] : null;
  const where = view === "where" ? dong : place.district || place.city;
  const sub = [where, view === "kind" ? null : place.kind].filter(Boolean).join(" · ");

  return (
    <button type="button" className="wh-row" onClick={onPick}>
      <span className="wh-row__no">{no}</span>
      <span className="wh-row__text">
        <span className="wh-row__name">{place.place_name}</span>
        {sub && <span className="wh-row__sub">{sub}</span>}
      </span>
      <span className="wh-row__val">{right}</span>
    </button>
  );
}

export default function Places() {
  const [rows, setRows] = useState<BoardPlace[]>([]);
  const [span, setSpan] = useState<BoardSpan>({ from: null, to: null });
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<BoardView>("much");
  const [sort, setSort] = useState<BoardSort>("money");
  const [period, setPeriod] = useState<Period>(recentMonths);
  const [periodOpen, setPeriodOpen] = useState(false);
  /* 친 글자와 걸어 둔 글자를 따로 든다 — 누를 때만 걸린다. */
  const [typed, setTyped] = useState("");
  const [find, setFind] = useState("");
  const [picked, setPicked] = useState<BoardPlace | null>(null);
  /* 펼쳐 둔 묶음. 담기지 않은 것은 접힌 것이다. */
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    setReady(false);
    axios
      .get<BoardData>("/places/board", {
        params: {
          since: period.since || undefined,
          until: period.until || undefined,
        },
      })
      .then((r) => {
        setRows(r.data.places);
        /* 고를 수 있는 앞뒤 달은 기간을 걸어도 그대로다. */
        setSpan(r.data.span);
      })
      .catch(() => setRows([]))
      .finally(() => setReady(true));
  }, [period]);

  /* 처음에는 모두 펼쳐 둔다. 잣대를 옮기거나 새로 받아 오면 다시 펼친다 —
     찾는 글자만 바뀔 때는 건드리지 않는다. 접어 둔 것이 되살아나면 어디를
     보고 있었는지 놓친다. */
  useEffect(() => {
    setOpen(new Set(allKeys(board(rows, view))));
  }, [rows, view]);

  const nodes = useMemo(
    () => board(narrow(rows, find), view, sort),
    [rows, find, view, sort]
  );
  const all = useMemo(
    () => ({
      key: "all",
      label: "",
      count: nodes.reduce((n, g) => n + g.count, 0),
      visits: nodes.reduce((n, g) => n + g.visits, 0),
      total: nodes.reduce((n, g) => n + g.total, 0),
      places: [],
      children: [],
    }),
    [nodes]
  );
  const found = all.count;

  const isOpen = (key: string) => open.has(key);
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const folds = FOLDS.includes(view);
  const onPeriod = !!(period.since || period.until);
  const title = VIEWS.find((v) => v.key === view)?.label ?? "";

  /* 차례는 묶음마다 1부터 매긴다 — 자주 간 곳은 묶음이 하나라 통째로 1부터다. */
  /* 줄 오른쪽에 무엇을 적을지. 묶음이 있는 잣대에서는 정렬 고르개를 따르고,
     자주 간 곳 · 많이 쓴 곳은 잣대 이름이 곧 기준이라 그것을 따른다. */
  const byMoney = folds ? sort === "money" : view === "much";

  const rowsOf = (list: BoardPlace[]) =>
    list.map((p, i) => (
      <PlaceRow
        key={p.place_id}
        no={i + 1}
        place={p}
        right={byMoney ? won(p.total) : `${p.used_count}번`}
        view={view}
        onPick={() => setPicked(p)}
      />
    ));

  /** 묶음 머리말 — 겹에 따라 크기만 다르고 짜임은 같다 */
  const head = (node: BoardNode, deep: boolean) => (
    <div className={`wh-head${deep ? " wh-head--in" : ""}`}>
      <CollapseToggle
        open={isOpen(node.key)}
        onToggle={() => toggle(node.key)}
        label={node.label}
      />
      <span className="wh-head__name">{node.label}</span>
      <Sum node={node} />
    </div>
  );

  return (
    <div className="page-wrap">
      <div className="cal-sources wh-views" role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            className={`cal-source${view === v.key ? " on" : ""}`}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}

        <button
          type="button"
          className={`filter-pill wh-period${onPeriod ? " on" : ""}`}
          aria-pressed={onPeriod}
          title={onPeriod ? "기간이 걸려 있다. 눌러서 고친다." : "기간"}
          onClick={() => setPeriodOpen(true)}
        >
          {periodLabel(period)}
        </button>
      </div>

      <div className="wh-find">
        <input
          className="ui-input"
          value={typed}
          placeholder="(찾기 — 가게 이름, 동네, 업종)"
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setFind(typed);
            }
          }}
        />
        <button type="button" className="ui-btn wh-find__go" onClick={() => setFind(typed)}>
          찾기
        </button>
        {/* 곳 수는 늘 전체 기준이다 — 걸러 낸 수는 아래 딱지로 따로 적힌다. */}
        <span className="set-group__count">{rows.length}</span>
      </div>

      {/* 넷 다 같은 자리에 서는 한 줄. 접을 것이 없는 잣대에서는 가운데가
          비지만 줄은 그대로 있어 아래가 흔들리지 않는다. */}
      <div className="wh-top">
        <span className="wh-top__name">{title}</span>
        <span className="wh-top__bulk">
          {folds && (
            <>
              <CollapseAllButtons
                onExpandAll={() => setOpen(new Set(allKeys(nodes)))}
                onCollapseAll={() => setOpen(new Set())}
              />
              <SortButtons sort={sort} onSort={setSort} />
            </>
          )}
        </span>
        <Sum node={all} />
      </div>

      {!ready && <div className="page-empty">불러오는 중입니다.</div>}
      {ready && found === 0 && <div className="page-empty">찾는 곳이 없습니다.</div>}

      {/* 잣대나 정렬을 바꾸면 목록이 통째로 다시 선다. 열쇠를 바꿔 새로 그리게
          두고 스르르 들어오게 한다 — 줄이 소리 없이 뒤바뀌면 눌린 것이
          먹혔는지 알기 어렵다. */}
      <div className="wh-list" key={`${view}:${sort}`}>
        {ready && !folds && <div className="wh-body">{rowsOf(nodes[0]?.places ?? [])}</div>}

        {ready &&
          folds &&
          nodes.map((g) => (
            <div key={g.key} className="wh-group">
              {head(g, false)}

              {isOpen(g.key) && (
                <div className="wh-body">
                  {g.children.length > 0
                    ? g.children.map((kid) => (
                        <div key={kid.key} className="wh-group wh-group--in">
                          {head(kid, true)}
                          {isOpen(kid.key) && (
                            <div className="wh-body">{rowsOf(kid.places)}</div>
                          )}
                        </div>
                      ))
                    : rowsOf(g.places)}
                </div>
              )}
            </div>
          ))}
      </div>

      {periodOpen && (
        <PlacePeriodPopup
          span={span}
          period={period}
          onClose={() => setPeriodOpen(false)}
          onApply={(next) => {
            setPeriod(next);
            setPeriodOpen(false);
          }}
        />
      )}

      {picked && <PlaceMapPopup place={picked} onClose={() => setPicked(null)} />}

      <QuickActions />
    </div>
  );
}
