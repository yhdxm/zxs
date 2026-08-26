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
echo === 智习 ZXS 一键部署 ===
echo   仓库: %REPO_FULL%
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
  echo 未找到 git.exe。请先安装 Git for Windows: https://git-scm.com/download/win
  pause
  exit /b 1
)
set "PATH=%GIT_BIN_DIR%;%PATH%"

:GIT_READY
if not exist ".git" (
  echo 正在初始化 git 仓库...
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
  echo 没有本地改动需要提交。
)
git branch -M main

REM ================= find a reachable GitHub IP =================
set "CURL_BIN=curl"
if exist "%SystemRoot%\System32\curl.exe" set "CURL_BIN=%SystemRoot%\System32\curl.exe"

set "IPFILE=.git\gh_last_ip.txt"
set "GOOD_IP="

echo 正在寻找可连接的 GitHub 线路...

if exist "%IPFILE%" (
  set /p LAST_IP=<"%IPFILE%"
  if defined LAST_IP (
    call :PROBE "!LAST_IP!"
    if !ERRORLEVEL! == 0 (
      set "GOOD_IP=!LAST_IP!"
      echo   [成功] 使用缓存线路 !LAST_IP!
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
        echo   [成功] 找到可用线路 %%i
        > "%IPFILE%" echo %%i
      ) else (
        echo   [--] %%i 无法连接
      )
    )
  )
)

set "RESOLVE_ARG="
if defined GOOD_IP (
  set "RESOLVE_ARG=-c http.curloptResolve=github.com:443:!GOOD_IP!"
) else (
  echo.
  echo   [警告] 未找到任何可连接的 IP。将尝试直接连接。
  echo   如果仍失败，请开启 VPN 或手机热点后重新运行本脚本。
)

REM ================= token =================
echo.
echo 请在下方粘贴你的 GitHub token。
echo   经典 token（classic）：需要 "repo" + "workflow" 两个权限范围。
echo   细粒度 token：仓库权限需 Actions=读取/写入、Pages=写入、Contents=写入。
echo 注意：token 会以明文显示，请勿截图这一行。
echo.
set /p "GH_TOKEN=请输入 GitHub token: "
set "GH_TOKEN=%GH_TOKEN: =%"

if not defined GH_TOKEN (
  echo 未输入 token，已终止。
  pause
  exit /b 1
)

REM ================= push (with retry over other routes) =================
echo.
echo 正在推送到 GitHub...
set "PUSH_URL=https://%GH_TOKEN%@github.com/%REPO_FULL%.git"
set "PUSH_LOG=%TEMP%\zxs_deploy_push.log"

git !RESOLVE_ARG! push -f "%PUSH_URL%" main > "%PUSH_LOG%" 2>&1
set "PUSH_ERR=!ERRORLEVEL!"
set "PUSH_OK=0"
findstr /C:"main -> main" "%PUSH_LOG%" >nul 2>&1 && set "PUSH_OK=1"

if not "!PUSH_OK!" == "1" (
  echo 首次推送失败或日志异常，正在尝试其他线路...
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
        echo   正在通过线路 %%r 重试 ...
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

if "!PUSH_OK!" == "1" goto PUSH_SUCCESS

REM 二次确认：即使 push 命令返回异常，只要日志中出现 "main -> main" 也视为成功
findstr /C:"main -> main" "%PUSH_LOG%" >nul 2>&1
if !ERRORLEVEL! == 0 goto PUSH_SUCCESS

echo.
echo [失败] 所有线路推送均失败。详情：
echo   %PUSH_LOG%
echo.
type "%PUSH_LOG%"
echo.
echo 常见原因：
echo   1. 当前网络完全屏蔽了 GitHub —— 请开启手机热点或 VPN 后重试。
echo   2. token 缺少 "repo" 权限，或不属于当前账号。
goto DEPLOY_END

:PUSH_SUCCESS
echo.
echo [成功] 推送完成。
echo.
echo ===== 自动配置 GitHub Pages（部署源=GitHub Actions）=====
call :CONFIGURE_PAGES
echo.
echo 部署进度: %ACTIONS_URL%
echo 线上地址: %PAGES_URL%

:DEPLOY_END
set "PUSH_URL="
set "GH_TOKEN="
echo.
pause
exit /b 0

REM ================= subroutine =================
:CONFIGURE_PAGES
set "API_BASE=https://api.github.com/repos/%REPO_FULL%"
echo   正在调用 GitHub API：将 Pages 部署源设为 GitHub Actions ...
curl -s -o "%TEMP%\zxs_pages.json" -w "   HTTP %%{http_code}\n" -X PUT ^
  -H "Accept: application/vnd.github+json" ^
  -H "Authorization: Bearer %GH_TOKEN%" ^
  -H "X-GitHub-Api-Version: 2022-11-28" ^
  "%API_BASE%/pages" ^
  -d "{\"build_type\":\"workflow\"}"
echo   HTTP 200/204 表示 Pages 部署源已成功设为 GitHub Actions。

echo   上方的推送已经触发了一次自动部署，无需手动重新运行。
echo   正在尝试重新运行最新一次任务以立即部署（可选）...
for /f "delims=" %%i in ('powershell -NoProfile -Command "try{(Invoke-RestMethod -Uri '%API_BASE%/actions/workflows/deploy.yml/runs?per_page=1' -Headers @{Authorization='Bearer %GH_TOKEN%'}).workflow_runs[0].id}catch{''}"') do set "RUN_ID=%%i"
if defined RUN_ID (
  curl -s -o "%TEMP%\zxs_rerun.json" -w "   re-run HTTP %%{http_code}\n" -X POST -H "Accept: application/vnd.github+json" -H "Authorization: Bearer %GH_TOKEN%" -H "X-GitHub-Api-Version: 2022-11-28" "%API_BASE%/actions/runs/!RUN_ID!/rerun"
  powershell -NoProfile -Command "try{$r=Get-Content '%TEMP%\zxs_rerun.json' -Raw -ErrorAction SilentlyContinue; if($r -and $r.Trim().Length -gt 0){$j=ConvertFrom-Json $r -ErrorAction SilentlyContinue; if($j.message){Write-Host ('   API 提示: ' + $j.message)}}}catch{}"
  echo   如果重新运行返回 403：
  echo     - 经典 token 需额外包含 "workflow" 权限（除 "repo" 外）。
  echo     - 细粒度 token 需具备 Actions=读取/写入 权限。
  echo     - 仓库设置 ^> Actions ^> General：Workflow 权限需设为"读取和写入权限"。
  echo   否则最新推送已自动开始部署，请等待 1-2 分钟即可。
) else (
  echo   无法自动获取最新任务 ID。若 1 分钟内未出现新任务，
  echo   请打开 %ACTIONS_URL%，在最新一次失败/跳过的任务上点击"Re-run jobs"。
)
exit /b 0

:PROBE
set "PROBE_CODE="
for /f "usebackq delims=" %%c in (`"%CURL_BIN%" -s -o nul -w "%%{http_code}" --connect-timeout 4 --max-time 9 --resolve github.com:443:%~1 "%REPO_URL%/info/refs?service=git-upload-pack" 2^>nul`) do set "PROBE_CODE=%%c"
if "%PROBE_CODE%" == "200" exit /b 0
if "%PROBE_CODE%" == "401" exit /b 0
exit /b 1
