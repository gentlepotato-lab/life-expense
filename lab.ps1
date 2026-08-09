<#
  life / expense — 서비스 제어 스크립트 (네이티브 실행, Docker 미사용)

  사용법:
    .\lab.ps1 api        백엔드(uvicorn) 포그라운드 실행 :18101
    .\lab.ps1 api-bg     백엔드 백그라운드 실행
    .\lab.ps1 dev        프론트 개발 서버 :28101 (백엔드 프록시 포함)
    .\lab.ps1 build      프론트 프로덕션 빌드 → frontend\dist
                         ★ 게이트웨이가 이 폴더를 직접 서빙한다. 복사 단계 없음.
    .\lab.ps1 stop       백그라운드 백엔드 정지
    .\lab.ps1 status     포트/프로세스 확인

  접속:
    개발  http://localhost:28101/app/
    서비스 http://expense.life.localhost/app/        (게이트웨이 기동 필요)
           http://<이 PC IP>:8101/app/          (폰 등 외부 기기)
#>
param(
  [Parameter(Position = 0)]
  [ValidateSet('api', 'api-bg', 'dev', 'build', 'stop', 'status')]
  [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'
$Root       = $PSScriptRoot
$BackendDir = Join-Path $Root 'backend'
$FrontDir   = Join-Path $Root 'frontend'
$Py         = Join-Path $Root '.venv_expense\Scripts\python.exe'
$ApiPort    = 18101
$PidFile    = Join-Path $Root '.api.pid'

switch ($Action) {

  'api' {
    Set-Location $BackendDir
    # --reload 는 쓰지 않는다. main.py 가 임포트 시점에 스케줄러 3개를 띄우기 때문에
    # 리로드가 걸릴 때마다 잡이 중복 등록될 수 있다. (AS-IS 의 알려진 문제)
    & $Py -m uvicorn app.main:app --host 0.0.0.0 --port $ApiPort
  }

  'api-bg' {
    if (Test-Path $PidFile) {
      $old = Get-Content $PidFile
      if (Get-Process -Id $old -ErrorAction SilentlyContinue) {
        Write-Host "이미 실행 중입니다 (PID $old)" -ForegroundColor Yellow; break
      }
    }
    $p = Start-Process -FilePath $Py `
         -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "$ApiPort" `
         -WorkingDirectory $BackendDir -WindowStyle Hidden -PassThru
    $p.Id | Set-Content $PidFile
    Start-Sleep -Seconds 3
    if (Get-Process -Id $p.Id -ErrorAction SilentlyContinue) {
      Write-Host "백엔드 기동 (PID $($p.Id)) — http://127.0.0.1:$ApiPort" -ForegroundColor Green
    } else {
      Write-Host "기동 실패. .\lab.ps1 api 로 포그라운드 실행해 오류를 확인하세요." -ForegroundColor Red
    }
  }

  'dev' {
    Set-Location $FrontDir
    npm run dev
  }

  'build' {
    Set-Location $FrontDir
    npm run build
    if ($LASTEXITCODE -eq 0) {
      Write-Host "`n빌드 완료 → $FrontDir\dist" -ForegroundColor Green
      Write-Host "게이트웨이가 이 폴더를 직접 읽으므로 복사할 필요가 없습니다. 새로고침만 하세요." -ForegroundColor Green
    }
  }

  'stop' {
    if (-not (Test-Path $PidFile)) { Write-Host "PID 파일이 없습니다."; break }
    $id = Get-Content $PidFile
    $proc = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($proc) { $proc | Stop-Process -Force; Write-Host "정지 (PID $id)" -ForegroundColor Green }
    else { Write-Host "이미 종료되어 있습니다." }
    Remove-Item $PidFile -Force
  }

  'status' {
    Write-Host "-- :$ApiPort (backend) --"
    netstat -ano | Select-String ":$ApiPort\s.*LISTENING"
    Write-Host "-- :28101 (frontend dev) --"
    netstat -ano | Select-String ":28101\s.*LISTENING"
    Write-Host "-- dist --"
    $d = Join-Path $FrontDir 'dist\index.html'
    if (Test-Path $d) { "빌드됨: $((Get-Item $d).LastWriteTime)" } else { "dist 없음 — .\lab.ps1 build 필요" }
  }
}
