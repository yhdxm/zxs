@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
set "GIT_TERMINAL_PROMPT=0"

echo.
echo === Smart Dashboard Deploy ===
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
  git remote add origin https://github.com/yhdxm/zxs.git
)
git remote get-url origin >nul 2>&1
if !ERRORLEVEL! neq 0 (
  git remote add origin https://github.com/yhdxm/zxs.git
)

git config user.email "deploy@zxs.local"
git config user.name "ZXS Deploy"
git config http.version HTTP/1.1
git config http.postBuffer 524288000
git config https.postBuffer 524288000
git config --local credential.helper ""

set "PROXY_PORT="
for %%p in (7890 10809 1080 8118 7070) do (
  powershell -NoProfile -Command "try { $c=New-Object System.Net.Sockets.TcpClient('127.0.0.1',%%p); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
  if !ERRORLEVEL! == 0 (
    set "PROXY_PORT=%%p"
    goto PROXY_FOUND
  )
)

:PROXY_FOUND
if defined PROXY_PORT (
  echo Detected local proxy: 127.0.0.1:!PROXY_PORT!
  git config --local http.proxy http://127.0.0.1:!PROXY_PORT!
  git config --local https.proxy http://127.0.0.1:!PROXY_PORT!
  set "http_proxy=http://127.0.0.1:!PROXY_PORT!"
  set "https_proxy=http://127.0.0.1:!PROXY_PORT!"
) else (
  echo WARNING: No local proxy detected on common ports.
  echo If GitHub push fails with "Connection reset", start your VPN/proxy first.
)

echo.
echo Build check first? (recommended, catches compile errors) [Y/n]
set /p "BUILD_CHOICE=Build verify? "
if not defined BUILD_CHOICE set "BUILD_CHOICE=Y"
if /i "!BUILD_CHOICE!"=="Y" (
  where npm >nul 2>&1
  if !ERRORLEVEL! == 0 (
    echo Running build (npm run build)...
    call npm run build > "%TEMP%\zxs_build.log" 2>&1
    set "BUILD_ERR=!ERRORLEVEL!"
    if not "!BUILD_ERR!"=="0" (
      echo.
      echo [X] Build FAILED - deployment aborted. Log: %TEMP%\zxs_build.log
      pause
      exit /b 1
    )
    echo [OK] Build passed.
  ) else (
    echo npm not found - skipping build check (push only).
  )
)

git add -A
git diff --cached --quiet
if !ERRORLEVEL! neq 0 (
  git commit -m "deploy: update (%date% %time%)"
) else (
  echo No local changes to commit.
)

git branch -M main

echo.
echo Paste your GitHub token below (classic token, needs "repo" scope).
echo NOTE: the token shows in plain text - do not screenshot this line.
echo.
set /p "GH_TOKEN=GitHub token: "
set "GH_TOKEN=%GH_TOKEN: =%"

if not defined GH_TOKEN (
  echo No token entered. Aborting.
  pause
  exit /b 1
)

echo.
echo Pushing to GitHub (up to 3 attempts)...
set "REMOTE_URL=https://%GH_TOKEN%@github.com/YHDXM/ZXS.git"
git remote set-url origin "%REMOTE_URL%"
set "ATTEMPT=0"
:PUSH_LOOP
set /a ATTEMPT+=1
echo Push attempt !ATTEMPT!...
git push -f origin main > "%TEMP%\zxs_deploy_push.log" 2>&1
set "PUSH_ERR=!ERRORLEVEL!"
if "!PUSH_ERR!"=="0" goto PUSH_OK
if !ATTEMPT! lss 3 (
  echo Push failed (attempt !ATTEMPT!), retry in 5s...
  timeout /t 5 >nul
  goto PUSH_LOOP
)
goto PUSH_FAIL

:PUSH_OK
git remote set-url origin https://github.com/YHDXM/ZXS.git
set "ZWS_TOKEN=%GH_TOKEN%"
set "ZWS_PROXY=%PROXY_PORT%"
set "GH_TOKEN="

echo.
echo [OK] Push succeeded. Checking GitHub Actions deployment status...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy_watch.ps1"
set "WATCH_ERR=!ERRORLEVEL!"
set "ZWS_TOKEN="
set "ZWS_PROXY="
set "http_proxy="
set "https_proxy="

if "!WATCH_ERR!"=="0" (
  echo.
  echo [OK][OK] DEPLOY SUCCESS - production updated.
) else if "!WATCH_ERR!"=="2" (
  echo.
  echo [!] Push succeeded, but could not auto-confirm Actions status (network/proxy limit).
  echo     Please check manually: https://github.com/YHDXM/ZXS/actions
) else (
  echo.
  echo [X][X] DEPLOY FAILED - check Actions run log:
  echo     https://github.com/YHDXM/ZXS/actions
)
echo.
pause
if "!WATCH_ERR!"=="0" ( exit /b 0 ) else if "!WATCH_ERR!"=="2" ( exit /b 0 ) else ( exit /b 1 )

:PUSH_FAIL
git remote set-url origin https://github.com/YHDXM/ZXS.git
set "GH_TOKEN="
set "http_proxy="
set "https_proxy="
echo.
echo [X] Push FAILED. Log: %TEMP%\zxs_deploy_push.log
echo     Common causes: token lacks "repo" scope, or wrong GitHub account.
echo.
pause
exit /b 1
