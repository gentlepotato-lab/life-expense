import { useState, useRef, useEffect } from "react";

export interface MultiSelectOption<T> {
  value: T;
  label: string;
}

interface MultiSelectProps<T> {
  options: MultiSelectOption<T>[];
  selected: T[];
  onChange: (value: T[]) => void;
  placeholder?: string;
  onSpecialClick?: (value: T) => boolean;
  isOptionChecked?: (value: T) => boolean;
}

export default function MultiSelect<T>({
  options,
  selected,
  onChange,
  placeholder = "",
  onSpecialClick,
  isOptionChecked
}: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // 드롭다운 위치 계산 — 화면 밖으로 나가지 않도록 가둔다
  useEffect(() => {
    if (!open || !wrapRef.current) return;

    const place = () => {
      const el = wrapRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const GUTTER = 8;
      const MIN_W = 200;
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
  }, [open]);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    const handleClick = (e: any) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

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

  return (
    <div className="ms-wrap" ref={wrapRef}>
      {/* 표시 영역 */}
      <div className="ms-display" onClick={() => setOpen(!open)}>
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
          {options.map((opt) => (
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
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
