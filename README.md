# life-expense

- 개인 가계부 웹 애플리케이션 (지출/수입 기록 · 검수 대기열 · 반복 등록 · Superset 시각화)
- GP Lab 의 `life` 네임스페이스 서비스
- 배포 위치 — `Desktop\Lab\life\expense`

## 스택

| 계층 | 기술 |
|---|---|
| 프론트 | React 19 · Vite 7 · TypeScript 5.9 · axios · react-router-dom |
| 백엔드 | FastAPI · SQLAlchemy 2 · psycopg3 · APScheduler · pandas |
| DB | PostgreSQL 17 — DB `gp-lab` / 스키마 `life_expense` |
| 외부 | Kakao Maps SDK · 공공데이터포털 특일 정보(KASI) · Superset 임베드 |

## 구조

```
.
├── backend/
│   └── app/
│       ├── main.py          FastAPI 진입점 · 스케줄러 3종 기동
│       ├── deps.py          엔진 · 세션 · MetaData(schema="life_expense")
│       ├── models.py        테이블 7종
│       ├── schemas.py       Pydantic 모델
│       ├── routers/         meta · entries · pending_entries · places
│       │                    payment_methods · holidays · scheduled_entries · superset
│       └── scheduler/       holiday_job · scheduled_entry_job · cleanup_job
├── frontend/
│   ├── src/pages/           화면 8종 + components
│   ├── src/types/           전역 타입 선언
│   └── vite.config.ts       base '/app/' · 개발 프록시
└── lab.ps1                  실행 스크립트
```

## 포트

| 계층 | 포트 | 비고 |
|---|---|---|
| 엣지 | `8101` | 게이트웨이가 리스닝 |
| 내부 API | `18101` | uvicorn |
| 개발 서버 | `28101` | Vite dev |

- 규칙 — `[계층][네임스페이스][서비스]`, `1`=life / `01`=expense
- 정의 원본 — `Desktop\Gateway\nginx\conf\conf.d\00-default.conf`

## 실행

```powershell
.\lab.ps1 api-bg    # 백엔드 :18101 백그라운드
.\lab.ps1 api       # 백엔드 포그라운드 (로그 확인)
.\lab.ps1 build     # 프론트 빌드 → frontend\dist
.\lab.ps1 dev       # Vite 개발 서버 :28101 (백엔드 별도 기동 필요)
.\lab.ps1 stop      # 백엔드 정지
.\lab.ps1 status    # 포트 · dist 빌드 시각
```

- 실서비스는 **게이트웨이 필수** — nginx 가 `frontend\dist` 를 직접 서빙
- 배포 = `.\lab.ps1 build` 뿐. 복사 단계 없음, nginx 재시작 불필요

## 접속

| 경로 | 주소 |
|---|---|
| PC · 호스트명 | http://expense.life.localhost/app/ |
| PC · 엣지 포트 | http://localhost:8101/app/ |
| LAN · 폰 | http://192.168.45.8:8101/app/ |
| 개발 서버 | http://localhost:28101/app/ |

- SPA 는 `/app/` 아래에 위치 (`base: '/app/'`, `basename="/app"`)
- 백엔드 API 가 `/meta`, `/entries` 등 루트 경로를 점유하고 있어 유지 필요
- 루트로 옮기려면 FastAPI 를 `root_path="/api"` 로 선이전할 것

## 환경 변수

- `backend\.env` — `backend\.env.example` 참고
- `frontend\.env` — `frontend\.env.example` 참고
- 실제 `.env` 는 추적하지 않음 (외부 API 시크릿 포함)

## 외부 연동

### Kakao Maps (장소 검색)

- 카카오가 **페이지 origin(호스트+포트)** 을 검증 → 접속 경로마다 개별 등록 필요
- 등록 위치 — 앱 설정 → 앱 키 → **JavaScript 키 → [JavaScript SDK 도메인]**
  - "웹 도메인" 페이지가 아님. 그쪽은 카카오톡 링크 이동용
- 미등록 시 — HTTP 401 `AccessDeniedError: domain mismatched!`

### Superset (Viz 화면)

- Guest Token 임베드. `SUPERSET_URL` / `SUPERSET_PUBLIC_URL` 사용

## 브랜치 전략

```
feature/*  →  develop  →  main
```

- `feature/*` · `develop` — `lab.ps1 dev` (`:28101`) 로 작업
- `main` — `lab.ps1 build` 로 실서비스 반영
- ⚠️ 게이트웨이가 작업 트리의 `dist` 를 직접 읽음 → **`build` 는 `main` 에서만 실행할 것**
  - `dist/` 는 추적하지 않으므로 브랜치 전환만으로는 실서비스가 바뀌지 않음

## 참고

| 문서 | 내용 |
|---|---|
| `..\..\README.md` | GP Lab 전체 구성 · 실행 · 포트 규칙 |
| `..\..\..\Gateway\README.md` | 게이트웨이 상세 · DB 마이그레이션 기록 |
