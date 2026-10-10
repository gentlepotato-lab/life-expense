import { useState, useRef, useEffect } from "react";
import useBackClose from "../../hooks/useBackClose";
import { narrowOptions, nothingFound, FIND_FROM } from "../../utils/narrowOptions";
import useAnchoredPanel from "../../hooks/useAnchoredPanel";

export interface SingleSelectOption<T> {
  value: T;
  label: string;
}

interface SingleSelectProps<T> {
  options: SingleSelectOption<T>[];
  selected: T;
  onChange: (value: T) => void;
  placeholder?: string;
  /** 고르는 것이 무엇인지 — 찾은 게 없을 때 그 말로 알린다. */
  noun?: string;
}

export default function SingleSelect<T>({
  options,
  selected,
  onChange,
  /* 안내 문구는 앱 전체에서 "(무엇)" 꼴로 맞춘다. */
  placeholder = "(선택)",
  noun = "것"
}: SingleSelectProps<T>) {
  const [open, setOpen] = useState(false);

  /* 뒤로 가기는 떠 있는 이 판만 닫는다 — 화면을 떠나면 안 된다.
     Backspace는 받지 않는다. 이 판 옆에는 글자를 지우는 칸이 흔하다. */
  useBackClose(open, () => setOpen(false), false);
  /* 친 글자 — 닫으면 비운다. 지난번 친 것이 남아 있으면
     다음에 열었을 때 목록이 비어 보인다. */
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  /* 드롭다운 자리 셈 — 화면 밖으로 나가지 않도록 가둔다. 연월 고르개도 같은
     셈을 쓰므로 훅으로 뽑아 두었다(hooks/useAnchoredPanel). */
  const dropdownStyle = useAnchoredPanel(open, wrapRef, {
    minWidth: 200,
    maxHeight: 260,
  });

  // 바깥 클릭 시 닫기
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

  const handleSelect = (value: T) => {
    onChange(value);
    setOpen(false);
  };

  /* 목록을 닫으면 친 글자도 지운다. */
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const shown = narrowOptions(options, query);

  // 현재 선택된 항목의 라벨 찾기
  const selectedLabel = options.find(o => o.value === selected)?.label;

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
        {selectedLabel ? (
          <span className="ms-value">{selectedLabel}</span>
        ) : (
          <span className="ms-placeholder">{placeholder}</span>
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
              placeholder="(찾기)"
              onChange={(e) => setQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {shown.length === 0 && <div className="ms-none">{nothingFound(noun)}</div>}
          {shown.map((opt) => (
            <label 
              className={`ms-option ${opt.value === selected ? 'ms-option-selected' : ''}`}
              key={String(opt.value)}
              onClick={() => handleSelect(opt.value)}
            >
              <input
                type="radio"
                checked={opt.value === selected}
                onChange={() => handleSelect(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
