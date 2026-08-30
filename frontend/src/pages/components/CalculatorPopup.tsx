import { useState, type ReactNode, useEffect } from "react";
import useBackClose from "../../hooks/useBackClose";

type HistoryItem = {
  expression: string;
  result: number;
  timestamp: number;
};

/**
 * 계산 기록.
 *
 * 팝업 안의 상태로 두면 닫는 순간 사라진다. 모듈 바깥에 두면 팝업을 여닫아도
 * 남아 있고, 페이지를 새로 고치면 함께 비워진다 — 딱 그만큼만 기억한다.
 */
const HISTORY_MAX = 10;
let sharedHistory: HistoryItem[] = [];

/**
 * 클립보드가 없는 자리에서 쓰는 옛 방법.
 *
 * navigator.clipboard는 안전한 자리(https · localhost)에서만 있다. 집 밖에서
 * 휴대폰으로 IP를 찍어 들어오면 http라 아예 없다. 그때는 눈에 안 보이는
 * 칸을 만들어 골라 놓고 execCommand로 베낀다.
 *
 * iOS는 그냥 select()로는 안 골라진다. contentEditable로 열어 두고
 * Range로 고른 뒤 setSelectionRange까지 해 줘야 한다. readOnly는 자판이
 * 올라오지 않게 막는 것이다.
 */
function legacyCopy(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.readOnly = true;
  ta.style.cssText =
    "position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:none;opacity:0;";
  document.body.appendChild(ta);

  const sel = window.getSelection();
  const prev = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;

  if (/iP(hone|ad|od)/.test(navigator.userAgent)) {
    /* iOS는 select()로 안 골라진다. 편집 가능으로 열어 두고 Range로 고른다. */
    ta.contentEditable = "true";
    const range = document.createRange();
    range.selectNodeContents(ta);
    sel?.removeAllRanges();
    sel?.addRange(range);
  } else {
    ta.focus();
    ta.select();
  }
  ta.setSelectionRange(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }

  document.body.removeChild(ta);
  if (sel) {
    sel.removeAllRanges();
    if (prev) sel.addRange(prev);
  }
  return ok;
}

interface CalculatorPopupProps {
  onClose: () => void;
}

export default function CalculatorPopup({ onClose }: CalculatorPopupProps) {
  const [expression, setExpression] = useState("");
  const [display, setDisplay] = useState("0");
  const [history, setHistory] = useState<HistoryItem[]>(() => sharedHistory);
  const [pressedButton, setPressedButton] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isCalculated, setIsCalculated] = useState(false);

  /* 뒤로 가기 · Esc로 닫는다. Backspace는 숫자를 지우는 키로 남겨 둔다. */
  useBackClose(true, onClose, false);

  // 팝업 열렸을 때 뒤 화면 스크롤/인터랙션 막기
  useEffect(() => {
    document.documentElement.classList.add("modal-open");
    return () => {
      document.documentElement.classList.remove("modal-open");
    };
  }, []);

  const addToHistory = (expr: string, result: number) => {
    const newHistory: HistoryItem = {
      expression: expr,
      result,
      timestamp: Date.now(),
    };
    sharedHistory = [newHistory, ...sharedHistory].slice(0, HISTORY_MAX);
    setHistory(sharedHistory);
  };

  const formatNumber = (value: number | string): string => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "0";
    
    // 과학적 표기법이 필요한 경우
    const absNum = Math.abs(num);
    if (absNum >= 1e10 || (absNum < 1e-3 && absNum !== 0)) {
      return num.toExponential(6);
    }
    
    // 일반 숫자 표시
    const str = num.toString();
    // 너무 긴 소수점은 자르기
    if (str.length > 15) {
      const parts = str.split(".");
      if (parts.length === 2 && parts[0].length <= 10) {
        const available = 15 - parts[0].length - 1;
        return parts[0] + "." + parts[1].slice(0, available);
      }
      return num.toExponential(6);
    }
    return str;
  };

  const evaluateExpression = (expr: string): number => {
    try {
      let processed = expr;
      
      // √(를 Math.sqrt(로 변환
      processed = processed.replace(/√\(/g, "Math.sqrt(");
      
      // ^(2)를 **2로 변환
      processed = processed.replace(/\^\(2\)/g, "**2");
      
      // ^(를 **로 변환(x^y 형태)
      processed = processed.replace(/\^\(/g, "**");
      
      // ×를 *, ÷를 /로 변환
      processed = processed
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/\s+/g, "");
      
      // 괄호 처리 및 계산
      const result = Function(`"use strict"; return (${processed})`)();
      return typeof result === "number" && !isNaN(result) ? result : 0;
    } catch {
      return 0;
    }
  };

  const inputNumber = (num: string) => {
    if (isCalculated) {
      // 계산 후 새로 시작
      setDisplay(num);
      setExpression(num);
      setIsCalculated(false);
      return;
    }

    if (display === "0" || display === "Error") {
      setDisplay(num);
      if (expression === "" || expression === "0" || expression === "Error") {
        setExpression(num);
      } else {
        setExpression(expression + num);
      }
    } else {
      const newDisplay = display + num;
      setDisplay(newDisplay);
      // 표현식이 현재 표시값으로 끝나면 업데이트, 아니면 추가
      if (expression.endsWith(display)) {
        setExpression(expression.slice(0, -display.length) + newDisplay);
      } else if (/[+\-×÷(]$/.test(expression.trim())) {
        setExpression(expression + num);
      } else {
        setExpression(expression + num);
      }
    }
  };

  const inputDecimal = () => {
    if (isCalculated) {
      setDisplay("0.");
      setExpression("0.");
      setIsCalculated(false);
      return;
    }

    if (display === "Error") {
      setDisplay("0.");
      setExpression("0.");
    } else if (!display.includes(".")) {
      const newDisplay = display + ".";
      setDisplay(newDisplay);
      if (expression.endsWith(display)) {
        setExpression(expression.slice(0, -display.length) + newDisplay);
      } else if (/[+\-×÷(]$/.test(expression.trim())) {
        setExpression(expression + "0.");
      } else {
        setExpression(expression + ".");
      }
    }
  };

  const inputOperator = (op: string) => {
    if (display === "Error") {
      setDisplay("0");
      setExpression("");
      setIsCalculated(false);
      return;
    }

    setIsCalculated(false);

    // 마지막이 연산자면 마지막 연산자를 새 연산자로 교체
    if (/[+\-×÷]\s*$/.test(expression.trim())) {
      // 마지막 연산자 제거하고 새 연산자 추가
      setExpression(expression.replace(/[+\-×÷]\s*$/, "") + " " + op + " ");
      setDisplay("0");
      return;
    }

    // 표현식이 비어있으면 현재 표시값 추가
    if (expression === "") {
      if (display !== "0") {
        setExpression(display + " " + op + " ");
      } else {
        setExpression(op + " ");
      }
    } else {
      // 표현식에 현재 값이 포함되어 있지 않으면 추가
      if (!expression.includes(display) || expression.endsWith(display)) {
        setExpression(expression + " " + op + " ");
      } else {
        // 이미 포함되어 있으면 연산자만 추가
        setExpression(expression.trim() + " " + op + " ");
      }
    }
    setDisplay("0");
  };

  const inputParenthesis = (paren: "(" | ")") => {
    if (display === "Error") {
      setDisplay("0");
      setExpression("");
      setIsCalculated(false);
      return;
    }

    setIsCalculated(false);

    if (paren === "(") {
      // 열린 괄호: 표현식에 추가하고 현재 표시는 유지하되 새 숫자 입력 준비
      if (display !== "0" && !/[+\-×÷(]$/.test(expression.trim())) {
        // 현재 값이 있고 표현식이 연산자로 끝나지 않으면 곱셈 추가
        setExpression(expression + " × (");
      } else {
        // 표현식이 비어있거나 연산자로 끝나면 그냥 괄호 추가
        if (expression === "" || expression === "0") {
          setExpression("(");
        } else {
          setExpression(expression + "(");
        }
      }
      setDisplay("0");
    } else {
      // 닫힌 괄호: 현재 표시값을 포함하여 닫기
      let newExpr = expression;
      if (display !== "0" && !expression.endsWith(display)) {
        newExpr = expression + display + ")";
      } else if (expression.endsWith(display)) {
        newExpr = expression + ")";
      } else {
        newExpr = expression + ")";
      }
      setExpression(newExpr);
      // 괄호가 닫히면 계산하지 않고 표현식만 업데이트
      setDisplay("0");
    }
  };

  const inputFunction = (func: "√" | "x²" | "1/x" | "x^y") => {
    if (display === "Error") {
      setDisplay("0");
      setExpression("");
      setIsCalculated(false);
      return;
    }

    setIsCalculated(false);

    let newExpr = expression.trim();
    const endsWithOperator = /[+\-×÷(]$/.test(newExpr);

    switch (func) {
      case "√":
        // 루트: ×√( 입력
        if (display !== "0" && !endsWithOperator) {
          // 현재 표시값이 표현식에 포함되어 있지 않으면 추가
          if (!expression.endsWith(display)) {
            setExpression(expression + display + " × √(");
          } else {
            setExpression(expression + " × √(");
          }
        } else {
          setExpression(expression + "√(");
        }
        setDisplay("0");
        break;
      case "x²":
        // 제곱: ^(2) 입력
        if (display !== "0" && !endsWithOperator) {
          // 현재 표시값이 표현식에 포함되어 있지 않으면 추가
          if (!expression.endsWith(display)) {
            setExpression(expression + display + "^(2)");
          } else {
            setExpression(expression + "^(2)");
          }
        } else {
          setExpression(expression + "^(2)");
        }
        setDisplay("0");
        break;
      case "1/x":
        // 1/x: 바로 앞에 연산자가 있으면 1÷, 없으면 ×1÷
        if (endsWithOperator) {
          setExpression(expression + "1÷");
        } else {
          if (display !== "0" && !endsWithOperator) {
            // 현재 표시값이 표현식에 포함되어 있지 않으면 추가
            if (!expression.endsWith(display)) {
              setExpression(expression + display + " × 1÷");
            } else {
              setExpression(expression + " × 1÷");
            }
          } else {
            setExpression(expression + "1÷");
          }
        }
        setDisplay("0");
        break;
      case "x^y":
        // x의 y 제곱: ^( 입력
        if (display !== "0" && !endsWithOperator) {
          // 현재 표시값이 표현식에 포함되어 있지 않으면 추가
          if (!expression.endsWith(display)) {
            setExpression(expression + display + "^(");
          } else {
            setExpression(expression + "^(");
          }
        } else {
          setExpression(expression + "^(");
        }
        setDisplay("0");
        break;
    }
  };

  const backspace = () => {
    if (display === "Error") {
      setDisplay("0");
      setExpression("");
      setIsCalculated(false);
      return;
    }

    if (isCalculated) {
      // 계산 후에는 전체 초기화
      setDisplay("0");
      setExpression("");
      setIsCalculated(false);
      return;
    }

    // 표현식에서 마지막 요소 제거
    if (expression.length > 0) {
      // 공백과 연산자 패턴 제거
      let newExpr = expression.trim();
      
      // 마지막이 공백+연산자+공백 패턴이면 제거
      if (/[+\-×÷]\s*$/.test(newExpr)) {
        newExpr = newExpr.replace(/[+\-×÷]\s*$/, "").trim();
        setExpression(newExpr);
        // 연산자 제거 후 이전 숫자로 표시 업데이트
        const lastNumber = newExpr.match(/\d+\.?\d*$/);
        if (lastNumber) {
          setDisplay(lastNumber[0]);
        } else {
          setDisplay("0");
        }
        return;
      }
      
      // 마지막이 숫자면 한 자리씩 제거
      if (display.length > 1) {
        const newDisplay = display.slice(0, -1);
        setDisplay(newDisplay);
        // 표현식이 현재 표시값으로 끝나면 업데이트
        if (expression.endsWith(display)) {
          setExpression(expression.slice(0, -display.length) + newDisplay);
        } else {
          // 표현식의 마지막 문자 제거
          setExpression(expression.slice(0, -1));
        }
      } else {
        setDisplay("0");
        // 표현식에서 마지막 숫자나 연산자 제거
        newExpr = newExpr.replace(/[+\-×÷()]\s*$/, "").replace(/\d+\.?\d*\s*$/, "");
        if (newExpr === "") {
          setExpression("");
        } else {
          setExpression(newExpr);
          // 남은 마지막 숫자로 표시 업데이트
          const lastNumber = newExpr.match(/\d+\.?\d*$/);
          if (lastNumber) {
            setDisplay(lastNumber[0]);
          } else {
            setDisplay("0");
          }
        }
      }
    } else {
      // 표현식이 비어있으면 표시만 초기화
      setDisplay("0");
    }
  };

  /** 백분율 — 지금 보이는 값을 100으로 나눈다. 10000 × 10 %처럼 쓴다. */
  const inputPercent = () => {
    const n = parseFloat(display.replace(/,/g, ""));
    if (isNaN(n)) return;
    const v = n / 100;
    setDisplay(formatNumber(v));
    setExpression(String(v));
    setIsCalculated(true);
  };

  /** 부호 바꾸기 */
  const toggleSign = () => {
    const n = parseFloat(display.replace(/,/g, ""));
    if (isNaN(n)) return;
    const v = -n;
    setDisplay(formatNumber(v));
    setExpression(String(v));
    setIsCalculated(true);
  };

  /** 결과를 복사한다 — 금액 칸에 붙여 넣으려고 쓴다.
      async로 두지 않는다. 클립보드가 없는 자리에서 await를 한 번이라도
      거치면 "사용자가 방금 눌렀다"는 표식이 풀려 옛 방법마저 막힌다. */
  const [copyState, setCopyState] = useState<"idle" | "done" | "fail">("idle");
  const flashCopy = (ok: boolean) => {
    setCopyState(ok ? "done" : "fail");
    window.setTimeout(() => setCopyState("idle"), 1200);
  };

  const copyResult = () => {
    const text = display.replace(/,/g, "");
    if (window.isSecureContext && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => flashCopy(true),
        () => flashCopy(legacyCopy(text))
      );
      return;
    }
    flashCopy(legacyCopy(text));
  };

  const clear = () => {
    setDisplay("0");
    setExpression("");
    setIsCalculated(false);
  };

  const handleEquals = () => {
    if (expression === "" || display === "Error") {
      return;
    }

    try {
      // 현재 표시된 값이 표현식에 포함되어 있지 않으면 추가
      let finalExpr = expression.trim();
      if (display !== "0" && !finalExpr.endsWith(display) && !/[+\-×÷]$/.test(finalExpr)) {
        finalExpr = finalExpr + display;
      }

      // 표현식이 연산자로 끝나면 제거
      finalExpr = finalExpr.replace(/[+\-×÷\s]+$/, "");

      if (finalExpr === "") {
        return;
      }

      const result = evaluateExpression(finalExpr);
      const formattedResult = formatNumber(result);
      
      setDisplay(formattedResult);
      setExpression(finalExpr); // 계산 후에도 표현식 유지
      setIsCalculated(true);
      addToHistory(finalExpr, result);
    } catch {
      setDisplay("Error");
      setExpression("");
      setIsCalculated(false);
    }
  };

  const handleButtonClick = (callback: () => void, buttonId: string) => {
    setPressedButton(buttonId);
    callback();
    setTimeout(() => {
      setPressedButton(null);
    }, 150);
  };

  const Button = ({
    label,
    onClick,
    className = "",
    span = false,
    rowSpan = false,
    buttonId,
    isActive = false,
  }: {
    label: string | ReactNode;
    onClick: () => void;
    className?: string;
    span?: boolean;
    rowSpan?: boolean;
    buttonId: string;
    isActive?: boolean;
  }) => {
    const isPressed = pressedButton === buttonId;
    return (
      <button
        className={`calculator-button ${className} ${isPressed ? "calculator-button--pressed" : ""} ${isActive ? "calculator-button--active" : ""}`}
        onClick={() => handleButtonClick(onClick, buttonId)}
        style={
          rowSpan
            ? { gridRow: "span 2" }
            : span
            ? { gridColumn: "span 2" }
            : undefined
        }
      >
        {label}
      </button>
    );
  };

  return (
    <div className="calculator-popup-overlay" onClick={onClose}>
      <div className="calculator-popup-content" onClick={(e) => e.stopPropagation()}>
        <div className="calculator-container">
          <div className="calculator-display-wrapper">
            <div className="calculator-expression">
              {expression && !isCalculated ? expression : ""}
            </div>
            <div className="calculator-display">{display}</div>
          </div>
          {/* 작은 줄 — 뒤에 더한 것들. 아래 숫자판은 그대로 둔다. */}
          <div className="calculator-utils">
            <button type="button" className="calculator-util" onClick={inputPercent} title="백분율">
              %
            </button>
            <button type="button" className="calculator-util" onClick={toggleSign} title="부호 바꾸기">
              ±
            </button>
            <button
              type="button"
              className={`calculator-util${
                copyState === "done" ? " is-copied" : copyState === "fail" ? " is-failed" : ""
              }`}
              onClick={copyResult}
              title="결과 복사"
            >
              {copyState === "done" ? "Copied" : copyState === "fail" ? "Failed" : "Copy"}
            </button>
          </div>

          {/* 첫 번째 행: C, 지우기, 괄호 */}
          <div className="calculator-row calculator-row--top">
            <Button
              label="("
              onClick={() => inputParenthesis("(")}
              className="calculator-button--function"
              buttonId="paren-open"
            />
            <Button
              label=")"
              onClick={() => inputParenthesis(")")}
              className="calculator-button--function"
              buttonId="paren-close"
            />
            <Button
              label="C"
              onClick={clear}
              className="calculator-button--clear"
              buttonId="clear"
            />
            <Button
              label="⌫"
              onClick={backspace}
              className="calculator-button--backspace"
              buttonId="backspace"
            />
          </div>

          {/* 두 번째 행: 루트, 제곱, x의 y 제곱, 1/x */}
          <div className="calculator-row">
            <Button
              label="√"
              onClick={() => inputFunction("√")}
              className="calculator-button--function"
              buttonId="sqrt"
            />
            <Button
              label="x²"
              onClick={() => inputFunction("x²")}
              className="calculator-button--function"
              buttonId="square"
            />
            <Button
              label={<span>x<sup>y</sup></span>}
              onClick={() => inputFunction("x^y")}
              className="calculator-button--function"
              buttonId="power"
            />
            <Button
              label="1/x"
              onClick={() => inputFunction("1/x")}
              className="calculator-button--function"
              buttonId="reciprocal"
            />
          </div>

          {/* 세 번째 행: 7, 8, 9, ÷ */}
          <div className="calculator-row">
            <Button label="7" onClick={() => inputNumber("7")} className="calculator-button--number" buttonId="7" />
            <Button label="8" onClick={() => inputNumber("8")} className="calculator-button--number" buttonId="8" />
            <Button label="9" onClick={() => inputNumber("9")} className="calculator-button--number" buttonId="9" />
            <Button
              label="÷"
              onClick={() => inputOperator("÷")}
              className="calculator-button--operator"
              buttonId="divide"
            />
          </div>

          {/* 네 번째 행: 4, 5, 6, × */}
          <div className="calculator-row">
            <Button label="4" onClick={() => inputNumber("4")} className="calculator-button--number" buttonId="4" />
            <Button label="5" onClick={() => inputNumber("5")} className="calculator-button--number" buttonId="5" />
            <Button label="6" onClick={() => inputNumber("6")} className="calculator-button--number" buttonId="6" />
            <Button
              label="×"
              onClick={() => inputOperator("×")}
              className="calculator-button--operator"
              buttonId="multiply"
            />
          </div>

          {/* 다섯 번째 행: 1, 2, 3, - */}
          <div className="calculator-row">
            <Button label="1" onClick={() => inputNumber("1")} className="calculator-button--number" buttonId="1" />
            <Button label="2" onClick={() => inputNumber("2")} className="calculator-button--number" buttonId="2" />
            <Button label="3" onClick={() => inputNumber("3")} className="calculator-button--number" buttonId="3" />
            <Button
              label="-"
              onClick={() => inputOperator("-")}
              className="calculator-button--operator"
              buttonId="subtract"
            />
          </div>

          {/* 여섯 번째 행: 0, 소수점, 등호, + */}
          <div className="calculator-row calculator-row--bottom">
            <Button label="0" onClick={() => inputNumber("0")} className="calculator-button--number" buttonId="0" />
            <Button label="." onClick={inputDecimal} className="calculator-button--number" buttonId="decimal" />
            <Button
              label="="
              onClick={handleEquals}
              className="calculator-button--equals"
              buttonId="equals"
            />
            <Button
              label="+"
              onClick={() => inputOperator("+")}
              className="calculator-button--operator"
              buttonId="add"
            />
          </div>
          <div className="calculator-history">
            <div
              className="calculator-history-header"
              onClick={() => setHistoryOpen(!historyOpen)}
            >
              <div className="calculator-history-title">기록({history.length})</div>
              {history.length > 0 && (
                <button
                  type="button"
                  className="calculator-history-clear"
                  title="기록 비우기"
                  onClick={(e) => {
                    e.stopPropagation();
                    sharedHistory = [];
                    setHistory([]);
                  }}
                >
                  비우기
                </button>
              )}
              <div className={`calculator-history-toggle ${historyOpen ? "calculator-history-toggle--open" : ""}`}>
                ▼
              </div>
            </div>
            {historyOpen && history.length > 0 && (
              <div className="calculator-history-list-wrapper">
                <div className="calculator-history-list">
                  {history.map((item, index) => (
                    <div
                      key={index}
                      className="calculator-history-item"
                      onClick={() => {
                        setDisplay(formatNumber(item.result));
                        setExpression(formatNumber(item.result));
                        setIsCalculated(true);
                      }}
                    >
                      <div className="calculator-history-expression">{item.expression}</div>
                      <div className="calculator-history-result">= {formatNumber(item.result)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {historyOpen && history.length === 0 && (
              <div className="calculator-history-list-wrapper">
                <div className="calculator-history-empty">아직 계산 결과가 없습니다만...!</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
