import { useEffect, useRef } from "react";

/**
 * 담긴 글만큼 키가 자라는 글칸.
 *
 * 한 줄짜리 입력칸에 가두면 적는 동안 앞이 밀려 나가 무엇을 쓰고 있는지
 * 보이지 않는다. 메모와 카드 혜택의 설명·상세처럼 길어질 수 있는 자리가
 * 여럿이라 한 부품으로 모았다.
 *
 * 줄 수를 미리 못 박지 않는다 — 짧은 것에는 빈 자리가 남고 긴 것은 그래도
 * 잘린다. 값이 밖에서 바뀔 때도(고르개로 통째로 물어 올 때) 다시 재야
 * 하므로 값을 보고 맞춘다.
 *
 * 한 줄일 때의 키는 입력칸과 한 치도 달라서는 안 된다. 그 치수는 쓰는 자리의
 * CSS가 정하고(글줄 20px + 위아래 5px + 테두리 1px = 32px), 여기서는 잰 키만
 * 얹는다.
 */
export default function GrowArea({
  value,
  className,
  placeholder,
  maxLength,
  name,
  readOnly,
  onChange,
}: {
  value: string;
  className: string;
  placeholder?: string;
  maxLength?: number;
  /** 폼이 한 덩어리로 다룰 때 쓴다 — input 의 name 과 같은 쓰임 */
  name?: string;
  readOnly?: boolean;
  onChange: (next: string, e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    /* scrollHeight 는 안쪽(글 + 여백)까지다. 이 칸은 테두리까지 키에 넣는
       셈(border-box)이라 테두리 두 줄을 더해야 마지막 줄이 잘리지 않는다. */
    const edge = el.offsetHeight - el.clientHeight;
    el.style.height = `${el.scrollHeight + edge}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      className={className}
      name={name}
      rows={1}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value, e)}
    />
  );
}
