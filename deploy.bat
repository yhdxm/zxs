@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
cd /d "%~dp0"
set "GIT_TERMINAL_PROMPT=0"

set "REPO_OWNER=yhdxm"
set "REPO_NAME=zxs"
set "REPO_FULL=%REPO_OWNER%/%REPO_NAME%"
set "REPO_URL=https://github.com/%REPO_FULL%.git"
set "PAGES_URL=https://%REPO_OWNER%.github.io/%REPO_NAME%/"
set "ACTIONS_URL=https://github.com/%REPO_FULL%/actions"

echo.
echo === Smart Dashboard Deploy ===
echo   Repository: %REPO_FULL%
echo.

set "GIT_BIN_DIR="
if exist "%USERPROFILE%\.workbuddy\vendor\PortableGit\mingw64\bin\git.exe" (
  set "GIT_BIN_DIR=%USERPROFILE%\.workbuddy\vendor\PortableGit\mingw64\bin"
) else if exist "%USERPROFILE%\.workbuddy\vendor\PortableGit\cmd\git.exe" (
  set "GIT_BIN_DIR=%USERPROFILE%\.workbuddy\vendor\PortableGit\cmd"
) else if exist "C:\Program Files\Git\cmd\git.exe" (
  set "GIT_BIN_DIR=C:\Program Files\Git\cmd"
) else if exist "C:\Program Files (x86)\Git\cmd\git.exe" (
  set "GIT_BIN_DIR=C:\Program Files (x86)\Git\cmd"
) else if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" (
  set "GIT_BIN_DIR=%LOCALAPPDATA%\Programs\Git\cmd"
)

if not defined GIT_BIN_DIR (
  git --version >nul 2>&1
  if !ERRORLEVEL! == 0 goto GIT_READY
  echo git.exe not found. Install Git for Windows: https://git-scm.com/download/win
  pause
  exit /b 1
)
set "PATH=%GIT_BIN_DIR%;%PATH%"

:GIT_READY
if not exist ".git" (
  echo Initializing git repository...
  git init
  git remote add origin %REPO_URL%
)
git remote get-url origin >nul 2>&1
if !ERRORLEVEL! neq 0 (
  git remote add origin %REPO_URL%
)
git remote set-url origin %REPO_URL%

git config user.email "deploy@zxs.local"
git config user.name "ZXS Deploy"
git config http.version HTTP/1.1
git config http.postBuffer 524288000
git config https.postBuffer 524288000
git config --local credential.helper ""

REM ================= commit local changes =================
git add -A
git diff --cached --quiet
if !ERRORLEVEL! neq 0 (
  git commit -m "deploy: update (%date% %time%)"
) else (
  echo No local changes to commit.
)
git branch -M main

REM ================= find a reachable GitHub IP =================
set "CURL_BIN=curl"
if exist "%SystemRoot%\System32\curl.exe" set "CURL_BIN=%SystemRoot%\System32\curl.exe"

set "IPFILE=.git\gh_last_ip.txt"
set "GOOD_IP="

echo Looking for a reachable GitHub route...

if exist "%IPFILE%" (
  set /p LAST_IP=<"%IPFILE%"
  if defined LAST_IP (
    call :PROBE "!LAST_IP!"
    if !ERRORLEVEL! == 0 (
      set "GOOD_IP=!LAST_IP!"
      echo   [OK] cached route !LAST_IP!
    )
  )
)

if not defined GOOD_IP (
  for %%i in (
    4.208.26.197
    20.27.177.113
    20.26.156.215
    20.207.73.82
    20.200.245.247
    20.233.83.145
    20.201.28.151
    20.248.137.48
    20.87.245.0
    20.42.73.25
    4.237.22.38
    4.208.25.11
    140.82.112.3
    140.82.113.3
    140.82.114.3
    140.82.114.4
    140.82.116.3
    140.82.121.3
    140.82.121.4
    140.82.113.4
    20.205.243.166
    192.30.255.112
    192.30.255.113
    13.250.177.223
    52.74.223.119
  ) do (
    if not defined GOOD_IP (
      call :PROBE "%%i"
      if !ERRORLEVEL! == 0 (
        set "GOOD_IP=%%i"
        echo   [OK] found route %%i
        > "%IPFILE%" echo %%i
      ) else (
        echo   [--] %%i unreachable
      )
    )
  )
)

set "RESOLVE_ARG="
if defined GOOD_IP (
  set "RESOLVE_ARG=-c http.curloptResolve=github.com:443:!GOOD_IP!"
) else (
  echo.
  echo   [WARN] No reachable IP found. Will try a plain direct connection.
  echo   If it fails, turn on your VPN / phone hotspot and run this again.
)

REM ================= token =================
echo.
echo Paste your GitHub token below.
echo   Classic token: needs "repo" + "workflow" scopes.
echo   Fine-grained token: Repository permissions - Actions=read/write, Pages=write, Contents=write.
echo NOTE: the token shows in plain text - do not screenshot this line.
echo.
set /p "GH_TOKEN=GitHub token: "
set "GH_TOKEN=%GH_TOKEN: =%"

if not defined GH_TOKEN (
  echo No token entered. Aborting.
  pause
  exit /b 1
)

REM ================= push (with retry over other routes) =================
echo.
echo Pushing to GitHub...
set "PUSH_URL=https://%GH_TOKEN%@github.com/%REPO_FULL%.git"
set "PUSH_LOG=%TEMP%\zxs_deploy_push.log"

git !RESOLVE_ARG! push -f "%PUSH_URL%" main > "%PUSH_LOG%" 2>&1
set "PUSH_ERR=!ERRORLEVEL!"
set "PUSH_OK=0"
findstr /C:"main -> main" "%PUSH_LOG%" >nul 2>&1 && set "PUSH_OK=1"

if not "!PUSH_OK!" == "1" (
  echo First attempt failed or push log looks abnormal, trying other routes...
  for %%r in (
    4.208.26.197
    20.27.177.113
    20.26.156.215
    20.207.73.82
    140.82.112.3
    140.82.113.3
    140.82.114.3
    140.82.121.3
    20.205.243.166
    192.30.255.112
  ) do (
    if not "!PUSH_OK!" == "1" (
      if not "%%r" == "!GOOD_IP!" (
        echo   retry via %%r ...
        git -c http.curloptResolve=github.com:443:%%r push -f "%PUSH_URL%" main > "%PUSH_LOG%" 2>&1
        set "PUSH_ERR=!ERRORLEVEL!"
        findstr /C:"main -> main" "%PUSH_LOG%" >nul 2>&1 && (
          set "PUSH_OK=1"
          > "%IPFILE%" echo %%r
        )
      )
    )
  )
)

if "!PUSH_OK!" == "1" (
  echo.
  echo [OK] Push finished.
  echo.
  echo ===== Auto-configure GitHub Pages (Source=GitHub Actions) =====
  call :CONFIGURE_PAGES
  echo.
  echo 部署进度: %ACTIONS_URL%
  echo 线上地址: %PAGES_URL%
) else (
  echo.
  echo [FAIL] Push failed on every route. Details:
  echo   %PUSH_LOG%
  echo.
  type "%PUSH_LOG%"
  echo.
  echo Common causes:
  echo   1. Network fully blocks GitHub right now - use phone hotspot / VPN.
  echo   2. Token lacks "repo" scope, or belongs to the wrong account.
)
set "PUSH_URL="
set "GH_TOKEN="
echo.
pause
exit /b 0

REM ================= subroutine =================
:CONFIGURE_PAGES
set "API_BASE=https://api.github.com/repos/%REPO_FULL%"
echo   Calling GitHub API: set Pages source to GitHub Actions ...
curl -s -o "%TEMP%\zxs_pages.json" -w "   HTTP %%{http_code}\n" -X PUT ^
  -H "Accept: application/vnd.github+json" ^
  -H "Authorization: Bearer %GH_TOKEN%" ^
  -H "X-GitHub-Api-Version: 2022-11-28" ^
  "%API_BASE%/pages" ^
  -d "{\"build_type\":\"workflow\"}"
echo   HTTP 200/204 means Pages source is set to GitHub Actions.

echo   The push above already triggered a deploy run. No manual rerun is required.
echo   Attempting to rerun the latest run for immediate deployment (optional) ...
for /f "delims=" %%i in ('powershell -NoProfile -Command "try{(Invoke-RestMethod -Uri '%API_BASE%/actions/workflows/deploy.yml/runs?per_page=1' -Headers @{Authorization='Bearer %GH_TOKEN%'}).workflow_runs[0].id}catch{''}"') do set "RUN_ID=%%i"
if defined RUN_ID (
  curl -s -o "%TEMP%\zxs_rerun.json" -w "   re-run HTTP %%{http_code}\n" -X POST -H "Accept: application/vnd.github+json" -H "Authorization: Bearer %GH_TOKEN%" -H "X-GitHub-Api-Version: 2022-11-28" "%API_BASE%/actions/runs/!RUN_ID!/rerun"
  powershell -NoProfile -Command "try{$r=Get-Content '%TEMP%\zxs_rerun.json' -Raw -ErrorAction SilentlyContinue; if($r -and $r.Trim().Length -gt 0){$j=ConvertFrom-Json $r -ErrorAction SilentlyContinue; if($j.message){Write-Host ('   API message: ' + $j.message)}}}catch{}"
  echo   If re-run returned 403:
  echo     - Classic token must include "workflow" scope in addition to "repo".
  echo     - Fine-grained token needs Actions=read/write permission.
  echo     - Repository Settings ^> Actions ^> General: Workflow permissions must be "Read and write permissions".
  echo   Otherwise the latest push has already started a deploy; just wait 1-2 minutes.
) else (
  echo   Could not auto-fetch latest run ID. If no new run appears in 1 minute,
  echo   go to %ACTIONS_URL% and click "Re-run jobs" on the latest failed/skipped run.
)
exit /b 0

:PROBE
set "PROBE_CODE="
for /f "usebackq delims=" %%c in (`"%CURL_BIN%" -s -o nul -w "%%{http_code}" --connect-timeout 4 --max-time 9 --resolve github.com:443:%~1 "%REPO_URL%/info/refs?service=git-upload-pack" 2^>nul`) do set "PROBE_CODE=%%c"
if "%PROBE_CODE%" == "200" exit /b 0
if "%PROBE_CODE%" == "401" exit /b 0
exit /b 1
