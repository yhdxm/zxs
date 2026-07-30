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
) else (
  echo WARNING: No local proxy detected on common ports.
  echo If GitHub push fails with "Connection reset", start your VPN/proxy first.
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
echo Pushing to GitHub...
set "REMOTE_URL=https://%GH_TOKEN%@github.com/YHDXM/ZXS.git"
git remote set-url origin "%REMOTE_URL%"
set "REMOTE_URL="
git push -f origin main > "%TEMP%\zxs_deploy_push.log" 2>&1
set "PUSH_ERR=%ERRORLEVEL%"
git remote set-url origin https://github.com/YHDXM/ZXS.git
set "GH_TOKEN="

if "%PUSH_ERR%" == "0" (
  echo.
  echo Push finished. Check GitHub Actions for build status:
  echo   https://github.com/YHDXM/ZXS/actions
) else (
  echo.
  echo Push failed. Open this file for details:
  echo   %TEMP%\zxs_deploy_push.log
  echo Common causes: token lacks "repo" scope, or wrong GitHub account.
)
echo.
echo (If the window ever closes too fast, the push log is saved at %TEMP%\zxs_deploy_push.log)
pause
