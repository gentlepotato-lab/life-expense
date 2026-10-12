import { useState, useRef, useEffect } from "react";
import useBackClose from "../../hooks/useBackClose";
import { narrowOptions, nothingFound, FIND_FROM } from "../../utils/narrowOptions";

export interface MultiSelectOption<T> {
  value: T;
  label: string;
  /** 이름 앞에 세울 이모지. 지정해 둔 것이 없으면 비운다. */
  icon?: string | null;
}

interface MultiSelectProps<T> {
  options: MultiSelectOption<T>[];
  selected: T[];
  onChange: (value: T[]) => void;
  placeholder?: string;
  onSpecialClick?: (value: T) => boolean;
  isOptionChecked?: (value: T) => boolean;
  /** 고르는 것이 무엇인지 — 찾은 게 없을 때 그 말로 알린다. */
  noun?: string;
}

export default function MultiSelect<T>({
  options,
  selected,
  onChange,
  placeholder = "",
  onSpecialClick,
  isOptionChecked,
  noun = "것"
}: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false);

  /* 뒤로 가기는 떠 있는 이 판만 닫는다 — 화면을 떠나면 안 된다.
     Backspace는 받지 않는다. 이 판 옆에는 글자를 지우는 칸이 흔하다. */
  useBackClose(open, () => setOpen(false), false);
  /* 친 글자 — 닫으면 비운다. 지난번 친 것이 남아 있으면
     다음에 열었을 때 목록이 비어 보인다. */
  const [query, setQuery] = useState("");
  /* 이모지 자리 — 한 줄이라도 이모지가 있으면 모든 줄에 같은 폭으로 낸다.
     없는 줄만 왼쪽으로 붙으면 이름의 선이 들쭉날쭉해진다. */
  const 이모지칸 = options.some(o => o.icon);

  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // 드롭다운 위치 계산 — 화면 밖으로 나가지 않도록 가둔다.
  useEffect(() => {
    if (!open || !wrapRef.current) return;

    const place = () => {
      const el = wrapRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const GUTTER = 8;
      /* 이모지 자리만큼 판을 넓힌다. 그러지 않으면 긴 이름이 그만큼 더 잘린다. */
      const MIN_W = 이모지칸 ? 226 : 200;
      const MAX_H = 260;

      const width = Math.min(
        Math.max(rect.width, MIN_W),
        window.innerWidth - GUTTER * 2
      );

      let left = rect.left;
      if (left + width > window.innerWidth - GUTTER) {
        left = window.innerWidth - GUTTER - width;
      }
      if (left < GUTTER) left = GUTTER;

      const below = window.innerHeight - rect.bottom - GUTTER;
      const above = rect.top - GUTTER;
      const openUp = below < 140 && above > below;
      const maxHeight = Math.max(120, Math.min(MAX_H, openUp ? above : below));

      setDropdownStyle(
        openUp
          ? { bottom: window.innerHeight - rect.top + 4, left, width, maxHeight }
          : { top: rect.bottom + 4, left, width, maxHeight }
      );
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, 이모지칸]);

  // 바깥 클릭 시 닫기
  const toggleValue = (value: T) => {
    if (onSpecialClick && onSpecialClick(value) === true) {
      return;
    }

    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  // 목록이 열렸을 때 외부 클릭을 감지
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: any) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  /* 목록을 닫으면 친 글자도 지운다. */
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const shown = narrowOptions(options, query);

  return (
    <div className="ms-wrap" ref={wrapRef}>
      {/* 표시 영역
          button이 아니라 div인 것은 전역 button 규칙(min-height 등)이 걸려
          모양이 달라지기 때문이다. 대신 역할과 키 조작을 손으로 붙인다. */}
      <div
        className="ms-display"
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          } else if (e.key === "Escape" && open) {
            setOpen(false);
          }
        }}
      >
        {selected.length === 0 && (
          <span className="ms-placeholder">{placeholder}</span>
        )}

        {selected.length === 1 && (
          <span className="ms-value">
            {options.find(o => o.value === selected[0])?.label ?? ""}
          </span>
        )}

        {selected.length > 1 && (
          <span className="ms-value">(다중 선택)</span>
        )}
      </div>

      {/* 드롭다운 */}
      {open && (
        <div className="ms-dropdown" style={dropdownStyle}>
          {options.length >= FIND_FROM && (
            <input
              type="text"
              className="ms-find"
              value={query}
              placeholder="(이름)"
              onChange={(e) => setQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {shown.length === 0 && <div className="ms-none">{nothingFound(noun)}</div>}
          {shown.map((opt) => (
            <label className="ms-option" key={String(opt.value)}>
              <input
                type="checkbox"
                checked={
                  isOptionChecked
                    ? isOptionChecked(opt.value)
                    : selected.includes(opt.value)
                }
                onChange={() => toggleValue(opt.value)}
              />
              {이모지칸 && <span className="ms-option__emoji">{opt.icon ?? ""}</span>}
              <span className="ms-option__name">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
