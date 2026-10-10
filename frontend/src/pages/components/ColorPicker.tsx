import { useEffect, useRef, useState } from "react";
import useBackClose from "../../hooks/useBackClose";
import { colorTokens, colorOf } from "../../utils/colorPalette";

/**
 * 구분의 색을 고른다.
 *
 * 자유 색상 선택은 두지 않는다. 흰 배경에서 안 보이는 색이나 서로 구분되지
 * 않는 색이 섞이면 목록이 오히려 어지러워지기 때문이다.
 * 새 구분을 만들 때 서버가 안 쓰인 색을 자동으로 배정하므로,
 * 이 선택기는 "굳이 바꾸고 싶을 때"만 열게 된다.
 */
export default function ColorPicker({
  value,
  onChange,
  disabled = false,
  /* 잠겼을 때 누름을 받을 곳. 받을 데가 있으면 진짜 disabled 대신
     aria-disabled를 단다 — disabled는 누름 자체가 나지 않아 "왜 안 되는지"를
     알릴 길이 없다. 읽어 주는 기계에게는 여전히 잠긴 것으로 들린다. */
  onLocked,
  title = "색 선택",
}: {
  value: string | null;
  onChange: (color: string) => void;
  disabled?: boolean;
  onLocked?: (e: React.MouseEvent<HTMLElement>) => void;
  title?: string;
}) {
  const [open, setOpen] = useState(false);

  /* 뒤로 가기는 떠 있는 이 판만 닫는다 — 화면을 떠나면 안 된다.
     Backspace는 받지 않는다. 이 판 옆에는 글자를 지우는 칸이 흔하다. */
  useBackClose(open, () => setOpen(false), false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !wrapRef.current) return;

    const place = () => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const GUTTER = 8;
      const WIDTH = 176;

      let left = rect.left;
      if (left + WIDTH > window.innerWidth - GUTTER) left = window.innerWidth - GUTTER - WIDTH;
      if (left < GUTTER) left = GUTTER;

      const below = window.innerHeight - rect.bottom - GUTTER;
      const openUp = below < 120 && rect.top - GUTTER > below;

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

  return (
    <div className="color-pick" ref={wrapRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`color-pick__btn ${disabled ? "readonly" : ""}`}
        style={{ background: colorOf(value) }}
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
      />

      {open && (
        <div className="color-pick__pop" style={style}>
          {colorTokens().map((t) => (
            <button
              type="button"
              key={t.key}
              className={`color-pick__cell ${t.key === value ? "on" : ""}`}
              style={{ background: t.solid }}
              title={t.label}
              aria-label={t.label}
              onClick={() => {
                onChange(t.key);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
