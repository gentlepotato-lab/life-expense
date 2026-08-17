import { useState, useRef, useEffect } from "react";

export interface SingleSelectOption<T> {
  value: T;
  label: string;
}

interface SingleSelectProps<T> {
  options: SingleSelectOption<T>[];
  selected: T;
  onChange: (value: T) => void;
  placeholder?: string;
}

export default function SingleSelect<T>({
  options,
  selected,
  onChange,
  /* 안내 문구는 앱 전체에서 "(무엇)" 꼴로 맞춘다 */
  placeholder = "(선택)"
}: SingleSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // 드롭다운 위치 계산 — 화면 밖으로 나가지 않도록 가둔다
  useEffect(() => {
    if (!open || !wrapRef.current) return;

    const place = () => {
      const el = wrapRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const GUTTER = 8;      // 화면 가장자리 최소 여백
      const MIN_W = 200;     // 읽을 수 있는 최소 너비
      const MAX_H = 260;

      // 칸이 좁아도 최소 너비는 확보하되, 화면을 넘지 않게 자른다
      const width = Math.min(
        Math.max(rect.width, MIN_W),
        window.innerWidth - GUTTER * 2
      );

      // 오른쪽으로 삐져나가면 왼쪽으로 당긴다
      let left = rect.left;
      if (left + width > window.innerWidth - GUTTER) {
        left = window.innerWidth - GUTTER - width;
      }
      if (left < GUTTER) left = GUTTER;

      // 아래 공간이 부족하면 위로 펼친다
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
  }, [open]);

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

  // 현재 선택된 항목의 라벨 찾기
  const selectedLabel = options.find(o => o.value === selected)?.label;

  return (
    <div className="ms-wrap" ref={wrapRef}>
      {/* 표시 영역 */}
      <div className="ms-display" onClick={() => setOpen(!open)}>
        {selectedLabel ? (
          <span className="ms-value">{selectedLabel}</span>
        ) : (
          <span className="ms-placeholder">{placeholder}</span>
        )}
      </div>

      {/* 드롭다운 */}
      {open && (
        <div className="ms-dropdown" style={dropdownStyle}>
          {options.map((opt) => (
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
