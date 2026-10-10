import { useEffect, useMemo, useRef, useState } from "react";
import useBackClose from "../../hooks/useBackClose";
import { EMOJI_ALL, EMOJI_GROUPS, searchEmoji } from "../../utils/emojiData";
import type { EmojiEntry } from "../../utils/emojiData";

/**
 * 묶음 머리말에 붙일 이모지를 고른다.
 *
 * 직접 입력할 수 있는 칸을 두지 않는다. 목록에서 고른 것만 들어가므로
 * 이모지가 아닌 글자가 섞일 여지가 없다.
 * 검색칸은 "무엇을 찾을지"를 적는 곳이지 값이 들어가는 곳이 아니다.
 */
export default function EmojiPicker({
  value,
  onChange,
  disabled = false,
  /* 잠겼을 때 누름을 받을 곳. 받을 데가 있으면 진짜 disabled 대신
     aria-disabled를 단다 — disabled는 누름 자체가 나지 않아 "왜 안 되는지"를
     알릴 길이 없다. 읽어 주는 기계에게는 여전히 잠긴 것으로 들린다. */
  onLocked,
  title = "이모지 선택",
}: {
  value: string | null;
  onChange: (emoji: string | null) => void;
  disabled?: boolean;
  onLocked?: (e: React.MouseEvent<HTMLElement>) => void;
  title?: string;
}) {
  const [open, setOpen] = useState(false);

  /* 뒤로 가기는 떠 있는 이 판만 닫는다 — 화면을 떠나면 안 된다.
     Backspace는 받지 않는다. 이 판 옆에는 글자를 지우는 칸이 흔하다. */
  useBackClose(open, () => setOpen(false), false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<string>("all");
  const [style, setStyle] = useState<React.CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const shown: EmojiEntry[] = useMemo(() => {
    if (query.trim()) return searchEmoji(query);
    // 분류를 펼쳐 합치면 같은 이모지가 두 번 나온다(병원은 장소이자 건강).
    // 중복을 없앤 전체 목록을 쓴다.
    if (tab === "all") return EMOJI_ALL;
    return EMOJI_GROUPS.find((g) => g.key === tab)?.items ?? [];
  }, [query, tab]);

  // 화면 밖으로 나가지 않도록 위치를 잡는다(SingleSelect와 같은 방식)
  useEffect(() => {
    if (!open || !wrapRef.current) return;

    const place = () => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const GUTTER = 8;
      const WIDTH = Math.min(320, window.innerWidth - GUTTER * 2);
      const HEIGHT = 330;

      let left = rect.left;
      if (left + WIDTH > window.innerWidth - GUTTER) left = window.innerWidth - GUTTER - WIDTH;
      if (left < GUTTER) left = GUTTER;

      const below = window.innerHeight - rect.bottom - GUTTER;
      const openUp = below < HEIGHT && rect.top - GUTTER > below;

      setStyle(
        openUp
          ? { bottom: window.innerHeight - rect.top + 4, left, width: WIDTH }
          : { top: rect.bottom + 4, left, width: WIDTH }
      );
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // 바깥을 누르면 닫는다.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  // 열 때마다 검색어는 비워 둔다.
  useEffect(() => {
    if (open) {
      setQuery("");
      setTab("all");
    }
  }, [open]);

  const pick = (emoji: string | null) => {
    onChange(emoji);
    setOpen(false);
  };

  return (
    <div
      className="emoji-pick"
      ref={wrapRef}
      /* 이름 칸 위에 얹혀 있어도 이모지 조작이 이름 편집으로 새지 않게 */
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={`emoji-pick__btn ${value ? "has" : ""} ${disabled ? "readonly" : ""}`}
        title={disabled ? undefined : title}
        aria-label={title}
        disabled={disabled && !onLocked}
        aria-disabled={disabled || undefined}
        onClick={(e) => {
          if (disabled) {
            onLocked?.(e);
            return;
          }
          setOpen((v) => !v);
        }}
      >
        {value || "＋"}
      </button>

      {open && (
        <div className="emoji-pick__pop" style={style}>
          <input
            className="emoji-pick__search"
            type="text"
            value={query}
            autoFocus
            placeholder="(검색 — 밥, 커피, 지하철, coffee)"
            onChange={(e) => setQuery(e.target.value)}
          />

          {!query.trim() && (
            <div className="emoji-pick__tabs">
              <button
                type="button"
                className={`emoji-pick__tab ${tab === "all" ? "on" : ""}`}
                onClick={() => setTab("all")}
              >
                전체
              </button>
              {EMOJI_GROUPS.map((g) => (
                <button
                  type="button"
                  key={g.key}
                  className={`emoji-pick__tab ${tab === g.key ? "on" : ""}`}
                  onClick={() => setTab(g.key)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}

          <div className="emoji-pick__grid">
            {shown.map((e) => (
              <button
                type="button"
                key={e.char}
                className={`emoji-pick__cell ${e.char === value ? "on" : ""}`}
                title={e.keywords}
                onClick={() => pick(e.char)}
              >
                {e.char}
              </button>
            ))}
            {shown.length === 0 && (
              <p className="emoji-pick__none">찾는 이모지가 없습니다.</p>
            )}
          </div>

          <button type="button" className="emoji-pick__clear" onClick={() => pick(null)}>
            이모지 없음
          </button>
        </div>
      )}
    </div>
  );
}
