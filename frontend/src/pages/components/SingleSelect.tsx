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
  placeholder = "선택하세요"
}: SingleSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // 드롭다운 위치 계산
  useEffect(() => {
    if (open && wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      setDropdownStyle({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
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

