# CLAUDE.md

`life-expense` 작업 시 지켜야 할 규칙. 기존 `.cursor/rules/*.mdc` 3개를 통합하고
TO-BE 구조(네임스페이스 분리 · 네이티브 실행 · `gp-lab`/`life_expense`)에 맞게 갱신한 것.

---

## 응답 규칙

- 응답 첫 줄에 `★Model: <모델명>` 을 표기한다.(예: `★Model: Claude Opus 5`)
- 설명은 한국어로. 코드와 코드 주석은 영어여도 무방하다.
- **요청하지 않은 기능·레이아웃·자산을 바꾸지 않는다.** 손대지 않은 UI 배치, 문구, 동작은
  불변으로 취급한다.
- 요구사항·데이터 계약·UX 에 추측이 필요하면 먼저 질문한다.
- 코드 수정 시 **AS-IS / TO-BE 스니펫(또는 Diff)** 을 제시해 어느 줄이 바뀌는지 보이게 한다.

---

## Git 규칙

**저장소를 변경하는 Git 명령은 사용자가 직접 실행한다. Claude 는 실행하지 않는다.**

| 구분 | 명령 | Claude |
|---|---|---|
| **절대 금지** | `git add` · `git commit` · `git push` | 어떤 경우에도 실행하지 않는다 |
| 사전 확인 필요 | `merge` · `rebase` · `reset` · `switch` · `checkout` · `worktree` · `remote` · `branch -d` | 실행 전 반드시 승인을 받는다 |
| 자유 | `status` · `diff` · `log` · `show` · `ls-files` · `branch`(목록) | 확인 목적으로 사용 가능 |

- 작업을 마치면 **변경 파일 목록**과 **제안 커밋 메시지**를 제시하고 거기서 멈춘다.
- 사용자가 실행할 명령은 복사해서 바로 쓸 수 있는 형태로 제시한다.
- 커밋 전 확인이 필요한 사항(비밀값 혼입, 대용량 파일, 의도치 않은 변경)은 미리 점검해 보고한다.

## 문서 작성 규칙

문서(`.md`)와 응답 본문 모두에 적용한다.

| 규칙 | ✗ | ✓ |
|---|---|---|
| 여는 괄호는 앞말에 붙인다 | `구성 (2026-08-09)` | `구성(2026-08-09)` |
| 영어 단어는 첫 글자를 대문자로 쓴다 | `nginx 재기동` | `Nginx 재기동` |
| 하이픈으로 연결된 영어 단어는 각 단어의 첫 글자를 대문자로 쓴다 | `bind-mount 방식` | `Bind-Mount 방식` |

**예외** — 아래는 원문 표기를 그대로 둔다.

- 테이블명·컬럼명·스키마명 — `life_expense`, `pending_entries`, `cat1_id`
- 코드·명령어·파일명 — `lab.ps1`, `npm run build`, `vite.config.ts`
- 환경변수·설정 키 — `DB_ECHO`, `basename`, `proxy_pass`
- URL·호스트명·경로 — `http://localhost:8101/app/`, `expense.life.localhost`
- 고유 표기가 정해진 이름 — `npm`, `pip`, `iOS`

---

## 아키텍처(사실)

| 항목 | 값 |
|---|---|
| 백엔드 | FastAPI · SQLAlchemy 2 · psycopg3 · APScheduler · Uvicorn `:18101` |
| 프론트 | React 19 · Vite 7 · TS 5.9 · Axios · `react-router-dom` v7 |
| DB | PostgreSQL 17 · DB `gp-lab` · 스키마 **`life_expense`** |
| 개발 서버 | Vite `:28101` → 백엔드 `127.0.0.1:18101` 프록시 |
| 실서비스 | 게이트웨이 Nginx 가 `frontend/dist` 를 **직접** 서빙(`:8101`, `expense.life.localhost`) |

### 절대 바꾸지 말 것

- `BrowserRouter` 의 `basename="/app"`
- `vite.config.ts` 의 `base: '/app/'`
- 이유 — 백엔드 API 가 `/meta`, `/entries`, `/holidays` 등 **루트 경로를 점유**하고 있어
  SPA 를 루트로 올리면 라우트와 API 가 충돌한다.
  옮기려면 FastAPI 를 `root_path="/api"` 로 선이전하는 별도 작업이 필요하다.
- 스키마 이름 `life_expense` — `app/deps.py` 의 `MetaData(schema=...)` 와 각 라우터의
  raw SQL 접두사가 함께 맞아야 한다. 한쪽만 바꾸지 말 것.

---

## 백엔드(FastAPI + SQLAlchemy)

### 세션

- DB 세션은 `Depends(get_db)` / `SessionDep` 로만 주입한다.
- 논리적 트랜잭션 1건당 `commit()` 1회. 한 핸들러에서 여러 번 커밋하지 않는다.
- 커밋 전에 생성된 ID 가 필요하면 `flush()` 를 쓴다.
- 오류 시 `try/except` 로 `rollback()`. 세션을 수동으로 `close()` 하지 않는다(의존성이 처리).

### 쿼리

- CRUD 는 **ORM 우선** — `db.query(Model).filter(...)`
- raw SQL(`text(...)`)은 복잡한 조인·집계·성능 최적화가 필요할 때만. 이유를 주석으로 남긴다.
- raw SQL 은 반드시 `:param` 바인딩. 문자열 결합 금지.

### 모델 · 스키마 동기화

- `models.py` 를 고치면 `schemas.py` 와 해당 `routers/*` 를 **같은 변경에서 함께** 갱신한다.
- 필드명은 모델과 스키마가 정확히 일치해야 한다(`cat1_id` 등).
- 선택 필드는 `| None = None` 표기.

### 금액

- 통화 필드는 모델에서 `Numeric(14,2)`.
- JSON 직렬화 시 `float(...)` 로 캐스팅. 문자열로 저장하지 않는다.

### 장소(Place) 처리 우선순위

1. `place_id` 가 오면 그대로 사용(기존 장소를 수정하지 않는다)
2. `kakao_id` 로 조회 → 있으면 갱신, 없으면 생성
3. 좌표(lat/lng)로 조회 → 있으면 갱신, 없으면 생성
4. 그래도 없으면 신규 생성

- 주소 문자열에서 `city` / `district` / `town` 을 분해한다.
- 카카오 `category_name`("대 > 중 > 소")을 `category_l1~l3` 로 분리한다.
- `places` 에 `UNIQUE(lat, lng)` 제약이 있다. 같은 좌표 충돌 처리 로직이 여러 곳에 있으니
  수정 시 전부 함께 본다.

### 스케줄러

- `main.py` 임포트 시점에 잡 3종이 기동된다. 그래서 **`--reload` 로 띄우지 않는다**(중복 등록).
- 백그라운드 잡은 라우터의 공유 함수를 호출한다(예: `process_scheduled_entries`).
  로직을 복제하지 않는다.
- 스케줄러는 자체 세션을 만든다. API 의존성 세션을 재사용하지 않는다.

### 응답 · 오류

- 단순 성공: `{"status": "ok"}` 또는 `{"status": "ok", "id": ...}`
- 오류는 `HTTPException` — 검증 400 / 없음 404 / 서버 500. 메시지는 필요 시 한국어.
- 날짜·시간은 문자열로 변환해 응답한다.

### 의존성

- `pyproject.toml` 에 새 의존성을 **승인 없이 추가하지 않는다.**

---

## 프론트엔드(React 19 + TS + Vite)

### 타입

- `any` 금지. 예외는 외부 SDK 인터페이스(Kakao Maps 등)뿐.
- props · hook 반환값 · API 페이로드에 명시적 타입을 준다.
- 제어값은 유니온 타입으로 — `type HolidayHandling = 'before' | 'on' | 'after'`
- `useState<Type>(...)` 로 상태 타입을 명시한다.

> 현재 `no-explicit-any` 위반이 75건 남아 있다(기존 부채). 새 코드에서 늘리지 않는다.

### 상태

- **React hooks 만** 사용한다. Redux · Zustand 등 상태 라이브러리를 도입하지 않는다.
- 상태는 쓰이는 곳에 가장 가깝게 둔다.

### API 호출

- 반드시 공유 Axios 인스턴스(`src/api/client.ts`)를 쓴다. `fetch` 나 새 Axios 인스턴스 금지.
- 예외 — 서드파티 SDK 스크립트 로딩(Kakao Maps 등).
- `try/catch` 로 감싸고 `err.response?.data?.detail || err.message` 로 메시지를 뽑는다.

### 스타일

- `src/index.css` 의 기존 유틸리티 클래스를 **재사용**한다. 새 전역 셀렉터를 만들기 전에
  스코프 블록(`.entries-grid`, `.scheduled-card` 등)을 확장하는 쪽을 택한다.
- 클래스명은 기존 BEM 유사 패턴을 따른다(`schedule-card__row`).
- **Tailwind 는 쓰지 않는다.** 유틸리티처럼 보이는 클래스명은 프로젝트 자체 CSS 다.
- 레이아웃 · 버튼 순서 · 여백은 명시적 요청 없이 바꾸지 않는다.

### 의존성

- 아래는 미사용으로 **제거된 패키지**다. 되살리지 않는다.
  `ag-grid-community` · `ag-grid-react` · `@mui/x-data-grid` · `@heroicons/react` ·
  `@dnd-kit/modifiers` · `@types/axios`
- 새 패키지 추가는 승인 후에.

### 파일 배치

```
src/pages/              화면 컴포넌트
src/pages/components/   재사용 컴포넌트
src/api/client.ts       axios 인스턴스
src/types/              전역 타입 선언
src/index.css           전역 스타일
```

---

## 품질

- 프론트 수정 후 `npm run lint` 를 돌리고 결과를 보고한다.
- 빌드는 `npm run build`(내부적으로 `tsc -b` 선행). 타입 에러가 있으면 빌드가 실패하고
  기존 `dist` 가 유지되므로 깨진 화면이 배포되지 않는다.
- 실행·배포는 `lab.ps1` 로만 한다. 상세는 `README.md`.

## 주석

- 새 로직에는 필요한 최소한만. 코드만으로 파악이 어려운 경우에 짧게 남긴다.
- 기존 주석은 **사실과 달라지지 않는 한 건드리지 않는다.** 간결함을 이유로 지우지 않는다.
- "무엇을" 이 아니라 "왜" 를 적는다.
