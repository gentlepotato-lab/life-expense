import Menu from "./components/Menu";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import axios from "../api/client";
import { embedDashboard } from "@superset-ui/embedded-sdk";

import MultiSelect from "./components/MultiSelect";
import CalculatorPopup from "./components/CalculatorPopup";

// 초기 날짜 계산 (이번 달 1일 ~ 오늘)
const getDefaultDates = () => {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  return {
    dateFrom: formatDate(firstDayOfMonth),
    dateTo: formatDate(today)
  };
};

export default function Viz() {
  const [cat1List, setCat1List] = useState<{ id: number; name: string }[]>([]);
  const [cat2List, setCat2List] = useState<{ id: number; name: string; cat1_id: number; blur?: number; }[]>([]);
  const [cat3List, setCat3List] = useState<{ id: number; name: string; cat2_id: number }[]>([]);

  const [payList, setPayList] = useState<{ code: string; name: string }[]>([]);

  const [filterOpen, setFilterOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  
  // 기본 날짜 설정 (이번 달 1일 ~ 오늘)
  const defaultDates = getDefaultDates();
  const [filter, setFilter] = useState({
    dateFrom: defaultDates.dateFrom,
    dateTo: defaultDates.dateTo,
    cat1: [] as number[],
    cat2: [] as number[],
    cat3: [] as number[],
    pay: [] as string[],
    memo: "",
  });

  // Superset Embed 설정
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // 메타데이터 불러오기
  useEffect(() => {
    axios.get("/meta/categories/lvl1").then((r) => setCat1List(r.data));
    axios.get("/meta/categories/lvl2").then((r) => setCat2List(r.data));
    axios.get("/meta/categories/lvl3").then((r) => setCat3List(r.data));
    axios.get("/meta/payment-methods/list").then((r) =>
      setPayList(
        r.data.map((p: any) => ({
          code: p.method_id,
          name: p.method_name
        }))
      )
    );
  }, []);

  // 필터 열렸을 때 뒤 화면 스크롤/인터랙션 막기
  useEffect(() => {
    if (filterOpen || calculatorOpen) {
      document.documentElement.classList.add("modal-open");
    } else {
      document.documentElement.classList.remove("modal-open");
    }
  }, [filterOpen, calculatorOpen]);

  // iframe 높이 자동 조정을 위한 postMessage 이벤트 리스너
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Superset이나 iframe에서 높이 정보를 받아옴
      if (event.data && typeof event.data === 'object') {
        // 다양한 형태의 높이 정보 수신
        let height: number | null = null;
        
        if (event.data.type === 'resize' || event.data.type === 'embedded-dashboard-resize') {
          height = event.data.height || event.data.payload?.height;
        } else if (typeof event.data.height === 'number') {
          height = event.data.height;
        } else if (typeof event.data.frameHeight === 'number') {
          height = event.data.frameHeight;
        } else if (typeof event.data.contentHeight === 'number') {
          height = event.data.contentHeight;
        }
        
        if (height && height > 100) {
          const iframe = dashboardRef.current?.querySelector('iframe');
          if (iframe) {
            iframe.style.height = `${height}px`;
            if (dashboardRef.current) {
              dashboardRef.current.style.height = `${height}px`;
            }
            console.log("[Viz] ✓ iframe height adjusted via postMessage to:", height);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Superset 대시보드 임베드
  const embedSupersetDashboard = useCallback(async () => {
    if (!dashboardRef.current) return;

    setLoading(true);
    setError(null);

    try {
      // 기존 iframe 제거
      dashboardRef.current.innerHTML = "";

      console.log("[Viz] ========================================");
      console.log("[Viz] Step 1: Preparing URL parameters...");
      
      // URL 파라미터 준비
      const urlParams: Record<string, string | number | (string | number)[]> = {};
      
      if (filter.dateFrom) {
        urlParams.date_from = filter.dateFrom;
      }
      if (filter.dateTo) {
        urlParams.date_to = filter.dateTo;
      }
      if (filter.cat1.length > 0) {
        urlParams.cat1 = filter.cat1;
      }
      if (filter.cat2.length > 0) {
        urlParams.cat2 = filter.cat2;
      }
      if (filter.cat3.length > 0) {
        urlParams.cat3 = filter.cat3;
      }
      if (filter.pay.length > 0) {
        urlParams.pay = filter.pay;
      }
      if (filter.memo) {
        urlParams.memo = filter.memo;
      }
      
      console.log("[Viz] URL Params:", urlParams);

      console.log("[Viz] Step 2: Fetching dashboard info from backend...");

      // 백엔드에서 Embed UUID와 Superset URL 가져오기
      const tokenResponse = await axios.post("/superset/guest-token", {
        dashboard_title: "EMS-Viz"
      });

      const { embed_uuid, superset_url, token } = tokenResponse.data;
      
      console.log("[Viz] ✓ Dashboard info received");
      console.log("[Viz] - Embed UUID:", embed_uuid);
      console.log("[Viz] - Superset URL:", superset_url);
      console.log("[Viz] - Token (first 50 chars):", token.substring(0, 50) + "...");
      console.log("[Viz] Step 3: Embedding dashboard with URL parameters...");

      // Superset Dashboard 임베드 (URL 파라미터 사용)
      await embedDashboard({
        id: embed_uuid,
        supersetDomain: superset_url,
        mountPoint: dashboardRef.current,
        fetchGuestToken: async () => {
          console.log("[Viz] Refreshing guest token for embedded dashboard...");
          try {
            const response = await axios.post("/superset/guest-token", {
              dashboard_title: "EMS-Viz"
            });
            console.log("[Viz] ✓ Guest token refreshed");
            return response.data.token;
          } catch (error: any) {
            console.error("[Viz] ✗ Failed to refresh guest token:", error);
            console.error("[Viz] Error details:", error.response?.data);
            throw new Error("Guest Token 발급 실패: " + (error.response?.data?.detail || error.message));
          }
        },
        dashboardUiConfig: {
          hideTitle: true,
          hideTab: true,
          hideChartControls: false,
          filters: {
            expanded: false,
            visible: false,
          },
          urlParams: urlParams, // URL 파라미터는 dashboardUiConfig 안에 있어야 함
        },
      });

      // iframe 스타일 설정 및 높이 자동 조정
      setTimeout(() => {
        const iframe = dashboardRef.current?.querySelector('iframe') as HTMLIFrameElement;
        if (iframe) {
          iframe.style.width = '100%';
          iframe.style.border = 'none';
          iframe.style.display = 'block';
          iframe.style.overflow = 'hidden';
          iframe.setAttribute('scrolling', 'no'); // iframe 내부 스크롤 제거
          
          // 초기 최소 높이 설정
          iframe.style.height = '2100px';
          if (dashboardRef.current) {
            dashboardRef.current.style.height = '1200px';
          }
          
          // iframe 로드 후 주기적으로 높이 체크 및 조정
          const checkAndAdjustHeight = () => {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
              if (iframeDoc) {
                // 다양한 방법으로 높이 측정
                const body = iframeDoc.body;
                const html = iframeDoc.documentElement;
                
                if (body && html) {
                  const heights = [
                    body.scrollHeight,
                    body.offsetHeight,
                    html.scrollHeight,
                    html.offsetHeight,
                    html.clientHeight
                  ];
                  
                  const actualHeight = Math.max(...heights.filter(h => h > 0));
                  
                  if (actualHeight > 500 && actualHeight < 20000) {
                    const finalHeight = actualHeight + 50; // 여유 공간 50px
                    iframe.style.height = `${finalHeight}px`;
                    if (dashboardRef.current) {
                      dashboardRef.current.style.height = `${finalHeight}px`;
                    }
                    console.log("[Viz] ✓ iframe height adjusted to:", finalHeight, "px (content:", actualHeight, ")");
                    return true;
                  }
                }
              }
            } catch (e) {
              // CORS 에러 - postMessage로 높이 받아야 함
              console.log("[Viz] Cannot access iframe content due to CORS");
            }
            return false;
          };
          
          // iframe 로드 이벤트
          iframe.addEventListener('load', () => {
            console.log("[Viz] iframe loaded, measuring height...");
            
            // 로드 직후 체크
            setTimeout(() => checkAndAdjustHeight(), 100);
            
            // 주기적으로 체크 (차트 렌더링 등으로 높이가 변할 수 있음)
            let attempts = 0;
            const intervalId = setInterval(() => {
              attempts++;
              const success = checkAndAdjustHeight();
              if (success || attempts > 20) {
                clearInterval(intervalId);
                if (!success) {
                  console.log("[Viz] Height auto-adjustment failed, waiting for postMessage...");
                }
              }
            }, 300);
          });
          
          // MutationObserver로 iframe 내부 DOM 변화 감지
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc) {
              const observer = new MutationObserver(() => {
                checkAndAdjustHeight();
              });
              observer.observe(iframeDoc.body || iframeDoc.documentElement, {
                childList: true,
                subtree: true,
                attributes: true
              });
            }
          } catch (e) {
            // CORS 에러 시 무시
          }
          
          console.log("[Viz] ✓ iframe auto-resize configured");
        }
      }, 100);

      setLoading(false);
      console.log("[Viz] ✓ Dashboard embedded successfully");
      console.log("[Viz] ========================================");
    } catch (err: any) {
      console.error("[Viz] ✗ Failed to embed dashboard:", err);
      setError(err.response?.data?.detail || err.message || "대시보드 로딩 중 오류가 발생했습니다.");
      setLoading(false);
    }
  }, [filter]);

  // 조회 버튼 클릭 시 대시보드 로드
  const handleSearch = () => {
    console.log("[Viz] Search button clicked, loading dashboard with filters...");
    embedSupersetDashboard();
    setFilterOpen(false);
  };

  // 초기 로드 제거 (조회 버튼을 눌러야만 대시보드 로드)
  // useEffect(() => {
  //   embedSupersetDashboard();
  // }, []);

  // ------------------------------------
  // MultiSelect 안정화용 useMemo / useCallback 추가
  // ------------------------------------

  const cat1Options = useMemo(
    () => [
      { value: -1, label: "[전체]" },
      ...cat1List.map(c => ({ value: c.id, label: c.name }))
    ],
    [cat1List]
  );

  const cat1_onSpecialClick = useCallback(
    (v: number) => {
      if (v !== -1) return false;

      const all = cat1List.map(c => c.id);

      setFilter(prev => ({
        ...prev,
        cat1: prev.cat1.length === all.length ? [] : all,
        cat2: [],
        cat3: [],
      }));

      return true;
    },
    [cat1List]
  );

  const cat1_onChange = useCallback(
    (list: number[]) => {
      setFilter(prev => ({
        ...prev,
        cat1: list.filter(v => v > 0),
        cat2: [],
        cat3: [],
      }));
    },
    []
  );

  const cat1_isChecked = useCallback(
    (v: number) => {
      if (v === -1) return filter.cat1.length === cat1List.length;
      return filter.cat1.includes(v);
    },
    [filter.cat1, cat1List]
  );

  // ------------------------------------
  // CategoryS
  // ------------------------------------

  const cat2Options = useMemo(() => {
    const result: any[] = [];
    if (filter.cat1.length)
      result.push({ value: -1, label: "[전체]" });

    filter.cat1.forEach(cid => {
      const parent = cat1List.find(c => c.id === cid);
      if (!parent) return;

      result.push({ value: -(1000 + cid), label: `(${parent.name} 전체)` });

      cat2List
        .filter(c => c.cat1_id === cid)
        .forEach(c => {
          result.push({ value: c.id, label: c.name });
        });
    });

    return result;
  }, [filter.cat1, cat1List, cat2List]);

  const cat2_onSpecialClick = useCallback(
    (v: number) => {
      if (v === -1) {
        const all = cat2List
          .filter(c => filter.cat1.includes(c.cat1_id))
          .map(c => c.id);

        setFilter(prev => ({
          ...prev,
          cat2: prev.cat2.length === all.length ? [] : all,
        }));
        return true;
      }

      if (v <= -1000) {
        const cid = -(v + 1000);
        const ids = cat2List.filter(c => c.cat1_id === cid).map(c => c.id);
        const allSelected = ids.every(id => filter.cat2.includes(id));

        setFilter(prev => ({
          ...prev,
          cat2: allSelected
            ? prev.cat2.filter(id => !ids.includes(id))
            : Array.from(new Set([...prev.cat2, ...ids])),
        }));

        return true;
      }

      return false;
    },
    [filter.cat1, filter.cat2, cat2List]
  );

  const cat2_onChange = useCallback(
    (list: number[]) => {
      setFilter(prev => ({
        ...prev,
        cat2: list.filter(v => v > 0)
      }));
    },
    []
  );

  const cat2_isChecked = useCallback(
    (v: number) => {
      if (v === -1) {
        const all = cat2List
          .filter(c => filter.cat1.includes(c.cat1_id))
          .map(c => c.id);
        return filter.cat2.length === all.length;
      }

      if (v <= -1000) {
        const cid = -(v + 1000);
        const children = cat2List.filter(c => c.cat1_id === cid).map(c => c.id);
        return children.every(id => filter.cat2.includes(id));
      }

      return filter.cat2.includes(v);
    },
    [filter.cat1, filter.cat2, cat2List]
  );

  // ------------------------------------
  // CategoryD
  // ------------------------------------

  const cat3Options = useMemo(() => {
    const result: any[] = [];

    if (filter.cat2.length)
      result.push({ value: -1, label: "[전체]" });

    filter.cat2.forEach(cid => {
      const parent = cat2List.find(c => c.id === cid);
      if (!parent) return;

      result.push({ value: -(2000 + cid), label: `(${parent.name} 전체)` });

      cat3List
        .filter(c => c.cat2_id === cid)
        .forEach(c => {
          result.push({ value: c.id, label: c.name });
        });
    });

    return result;
  }, [filter.cat2, cat2List, cat3List]);

  const cat3_onSpecialClick = useCallback(
    (v: number) => {
      if (v === -1) {
        const all = cat3List
          .filter(c => filter.cat2.includes(c.cat2_id))
          .map(c => c.id);

        setFilter(prev => ({
          ...prev,
          cat3: prev.cat3.length === all.length ? [] : all,
        }));
        return true;
      }

      if (v <= -2000) {
        const cid = -(v + 2000);
        const ids = cat3List.filter(c => c.cat2_id === cid).map(c => c.id);
        const allSelected = ids.every(id => filter.cat3.includes(id));

        setFilter(prev => ({
          ...prev,
          cat3: allSelected
            ? prev.cat3.filter(id => !ids.includes(id))
            : Array.from(new Set([...prev.cat3, ...ids])),
        }));

        return true;
      }

      return false;
    },
    [filter.cat2, filter.cat3, cat3List]
  );

  const cat3_onChange = useCallback(
    (list: number[]) => {
      setFilter(prev => ({
        ...prev,
        cat3: list.filter(v => v > 0)
      }));
    },
    []
  );

  const cat3_isChecked = useCallback(
    (v: number) => {
      if (v === -1) {
        const all = cat3List
          .filter(c => filter.cat2.includes(c.cat2_id))
          .map(c => c.id);
        return filter.cat3.length === all.length;
      }

      if (v <= -2000) {
        const cid = -(v + 2000);
        const children = cat3List.filter(c => c.cat2_id === cid).map(c => c.id);
        return children.every(id => filter.cat3.includes(id));
      }

      return filter.cat3.includes(v);
    },
    [filter.cat2, filter.cat3, cat3List]
  );

  // ------------------------------------
  // PaymentMethod 안정화
  // ------------------------------------

  const payOptions = useMemo(
    () => [
      { value: "__ALL__", label: "(전체 결제 수단)" },
      ...payList.map(p => ({ value: p.code, label: p.name }))
    ],
    [payList]
  );

  const pay_onSpecialClick = useCallback(
    (v: string) => {
      if (v !== "__ALL__") return false;

      const all = payList.map(p => p.code);

      setFilter(prev => ({
        ...prev,
        pay: prev.pay.length === all.length ? [] : all,
      }));

      return true;
    },
    [payList]
  );

  const pay_onChange = useCallback(
    (list: string[]) => {
      setFilter(prev => ({
        ...prev,
        pay: list
      }));
    },
    []
  );

  const pay_isChecked = useCallback(
    (v: string) => {
      if (v === "__ALL__") return filter.pay.length === payList.length;
      return filter.pay.includes(v);
    },
    [filter.pay, payList]
  );

  const isFilterActive = useMemo(() => {
    return (
      filter.dateFrom ||
      filter.dateTo ||
      filter.cat1.length > 0 ||
      filter.cat2.length > 0 ||
      filter.cat3.length > 0 ||
      filter.pay.length > 0 ||
      filter.memo.trim() !== ""
    );
  }, [filter]);

  return (
    <div className="page-wrap">
      <Menu />
      <h1 className="page-title">Viz</h1>

      {/* 필터 영역 */}
      <div className="toolbar-wrap">
        <div className="toolbar">
          {/* 날짜 필터 (공백 없이 나란히 배치) */}
          <div style={{ display: 'flex', gap: '0' }}>
            <input
              type="date"
              value={filter.dateFrom}
              onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })}
              className="ui-input"
              style={{ width: 'auto', minWidth: '140px', marginRight: '0' }}
            />
            <input
              type="date"
              value={filter.dateTo}
              onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })}
              className="ui-input"
              style={{ width: 'auto', minWidth: '140px', marginLeft: '0' }}
            />
          </div>

          <div className="toolbar-btns">
            <button onClick={() => setFilterOpen(true)} className="filter-btn">
              {isFilterActive ? "☑ 필터" : "☐ 필터"}
            </button>
            <button onClick={handleSearch} className="ui-btn">
              조회
            </button>
          </div>
        </div>
      </div>

      {/* Superset Dashboard 임베드 영역 */}
      {error && (
        <div style={{
          padding: '20px',
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '10px',
          marginBottom: '20px',
          textAlign: 'center',
          maxWidth: '760px',
          margin: '0 auto 20px auto'
        }}>
          <p style={{ color: '#856404', margin: 0 }}>{error}</p>
        </div>
      )}

      {loading && (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: '#6C757D'
        }}>
          로딩 중...
        </div>
      )}

      <div
        ref={dashboardRef}
        style={{
          width: '100%',
          maxWidth: '760px',
          minHeight: '1000px',
          margin: '0 auto',
          border: 'none',
          background: '#FFFFFF'
        }}
      />

      {/* 필터 팝업 */}
      {filterOpen && (
        <div className="popup-overlay" onClick={() => setFilterOpen(false)}>
          <div className="popup-panel" onClick={(e) => e.stopPropagation()}>

            <h3>검색 필터</h3>

            {/* 1행: 날짜 */}
            <div className="filter-row">
              <div className="filter-col">
                <label>시작일</label>
                <input
                  type="date"
                  value={filter.dateFrom}
                  onChange={e => setFilter({ ...filter, dateFrom: e.target.value })}
                />
              </div>

              <div className="filter-col">
                <label>종료일</label>
                <input
                  type="date"
                  value={filter.dateTo}
                  onChange={e => setFilter({ ...filter, dateTo: e.target.value })}
                />
              </div>
            </div>

            {/* 2행: 중분류 / 소분류 */}
            <div className="filter-row">
              <div className="filter-col">
                <label>중분류</label>
                <MultiSelect
                  options={cat1Options}
                  selected={filter.cat1}
                  onSpecialClick={cat1_onSpecialClick}
                  onChange={cat1_onChange}
                  isOptionChecked={cat1_isChecked}
                />
              </div>

              <div className="filter-col">
                <label>소분류</label>
                <MultiSelect
                  options={cat2Options}
                  selected={filter.cat2}
                  onSpecialClick={cat2_onSpecialClick}
                  onChange={cat2_onChange}
                  isOptionChecked={cat2_isChecked}
                />
              </div>
            </div>

            {/* 3행: 세분류 / 결제 수단 */}
            <div className="filter-row">
              <div className="filter-col">
                <label>세분류</label>
                <MultiSelect
                  options={cat3Options}
                  selected={filter.cat3}
                  onSpecialClick={cat3_onSpecialClick}
                  onChange={cat3_onChange}
                  isOptionChecked={cat3_isChecked}
                />
              </div>

              <div className="filter-col">
                <label>결제 수단</label>
                <MultiSelect
                  options={payOptions}
                  selected={filter.pay}
                  onSpecialClick={pay_onSpecialClick}
                  onChange={pay_onChange}
                  isOptionChecked={pay_isChecked}
                />
              </div>
            </div>

            {/* 4행: 메모 (전체 너비) */}
            <div className="filter-row">
              <div className="filter-col" style={{ flex: '1 1 100%' }}>
                <label>메모</label>
                <input
                  type="text"
                  value={filter.memo}
                  onChange={e => setFilter({ ...filter, memo: e.target.value })}
                />
              </div>
            </div>

            <div className="btn-row">
              <button className="ui-btn" onClick={() => setFilterOpen(false)}>닫기</button>
              <button className="ui-btn" onClick={() => {
                const defaultDates = getDefaultDates();
                setFilter({
                  dateFrom: defaultDates.dateFrom,
                  dateTo: defaultDates.dateTo,
                  cat1: [] as number[],
                  cat2: [] as number[],
                  cat3: [] as number[],
                  pay: [] as string[],
                  memo: "",
                });
              }}>초기화</button>
              <button className="ui-btn primary" onClick={handleSearch}>적용</button>
            </div>

          </div>
        </div>
      )}
      <button
        className="calculator-trigger-button"
        onClick={() => setCalculatorOpen(!calculatorOpen)}
        aria-label="Calculator"
      >
        계산기
      </button>
      {calculatorOpen && (
        <CalculatorPopup onClose={() => setCalculatorOpen(false)} />
      )}
    </div>
  );
}