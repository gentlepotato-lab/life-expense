import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// TO-BE: Docker 를 쓰지 않는다. 개발 서버도 Nginx 게이트웨이도 모두 호스트에서 직접 돈다.
//   - 개발      : vite dev(28101) → 프록시 → uvicorn(18101)
//   - 실서비스  : npm run build → dist/ → Nginx 게이트웨이가 그 폴더를 직접 서빙
//                (AS-IS 처럼 Nginx 폴더로 복사하지 않는다)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // 포트는 .env 로 덮어쓸 수 있다. 기본값은 AS-IS(8000/5173)와 겹치지 않는 값.
  const backendPort = env.VITE_BACKEND_PORT || '18101'
  const devPort = Number(env.VITE_DEV_PORT || '28101')
  const backendTarget = `http://127.0.0.1:${backendPort}`

  return {
    plugins: [react()],
    // SPA 는 /app/ 아래에 선다.
    // 백엔드 API 가 /meta, /entries 처럼 루트 경로를 쓰고 있어서, SPA 를 루트로 올리면
    // 라우트와 API 경로가 충돌한다. FastAPI 를 /api 하위로 옮기기 전까지는 이 값을 유지할 것.
    base: '/app/',
    define: {
      'import.meta.env.VITE_KAKAO_MAP_KEY': JSON.stringify(env.VITE_KAKAO_MAP_KEY),
      'import.meta.env.VITE_NAVER_CLIENT_ID': JSON.stringify(env.VITE_NAVER_CLIENT_ID),
    },
    server: {
      host: '0.0.0.0', // 외부 접근 허용
      port: devPort,
      strictPort: true, // 포트가 잡혀 있으면 조용히 다른 포트로 옮겨가지 말고 실패할 것
      // watch.usePolling 은 제거했다. Docker 바인드마운트 때문에 켰던 옵션이고,
      // 호스트에서 직접 돌 때는 OS 파일 이벤트가 정상 동작한다. 폴링은 CPU 만 먹는다.
      proxy: {
        '/meta': { target: backendTarget, changeOrigin: true },
        '/entries': { target: backendTarget, changeOrigin: true },
        '/pending-entries': { target: backendTarget, changeOrigin: true },
        '/api': { target: backendTarget, changeOrigin: true },
        '/scheduled-entries': { target: backendTarget, changeOrigin: true },
        '/holidays': { target: backendTarget, changeOrigin: true },
        '/superset': { target: backendTarget, changeOrigin: true },
      },
    },
    build: {
      outDir: 'dist',
    },
  }
})
