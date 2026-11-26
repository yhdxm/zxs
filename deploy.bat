@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
set "GIT_TERMINAL_PROMPT=0"

set "REPO_OWNER=yhdxm"
set "REPO_NAME=zxs"
set "REPO_FULL=%REPO_OWNER%/%REPO_NAME%"
set "REPO_URL=https://github.com/%REPO_FULL%.git"
set "PAGES_URL=https://%REPO_OWNER%.github.io/%REPO_NAME%/"
set "ACTIONS_URL=https://github.com/%REPO_FULL%/actions"

echo.
echo === ZXS 一键部署 ===
echo   仓库: %REPO_FULL%
echo.

set "GIT_BIN_DIR="
if exist "%USERPROFILE%\.workbuddy\vendor\PortableGit\mingw64\bin\git.exe" (
  set "GIT_BIN_DIR=%USERPROFILE%\.workbuddy\vendor\PortableGit\mingw64\bin"
) else if exist "%USERPROFILE%\.workbuddy\vendor\PortableGit\cmd\git.exe" (
  set "GIT_BIN_DIR=%USERPROFILE%\.workbuddy\vendor\PortableGit\cmd"
) else if exist "C:/Program Files/Git/cmd/git.exe" (
  set "GIT_BIN_DIR=C:/Program Files\Git\cmd"
) else if exist "C:/Program Files (x86)/Git/cmd/git.exe" (
  set "GIT_BIN_DIR=C:/Program Files (x86)\Git\cmd"
) else if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" (
  set "GIT_BIN_DIR=%LOCALAPPDATA%\Programs\Git\cmd"
)

if not defined GIT_BIN_DIR (
  git --version >nul 2>&1
  if !ERRORLEVEL! == 0 goto GIT_READY
  echo 未找到 git.exe，请先安装 Git for Windows: https://git-scm.com/download/win
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
git config --local --unset-all credential.helper >nul 2>&1

REM 提交本地改动
git add -A
git diff --cached --name-only
git diff --cached --quiet
if !ERRORLEVEL! neq 0 (
  git commit -m "deploy: update (%date% %time%)"
) else (
  echo 没有改动的文件需要提交
)
git branch -M main

REM 找可达 GitHub IP
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
    192.30.255.112
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
  echo   [警告] 未找到任何可连接的 IP，将继续直接连接。
  echo   若最后失败，请开 VPN 或换手机热点后重新运行本脚本。
)

REM 凭据输入
echo.
echo 请输入GitHub凭据后按回车；脚本不会把凭据显示到屏幕上。
echo   需要仓库写入权限；若会修改 .github/workflows 还需工作流写入权限。
echo.
set /p "GH_TOKEN=请输入 GitHub 凭据: "
cls
echo ============================================
echo  ZXS deploy: 凭据已接收，正在部署
echo ============================================
set "GH_TOKEN=%GH_TOKEN: =%"

REM 凭据自检：在推送前识别明显输错的内容，避免走完整套线路才报错
set "PREFIX_BAD=1"
if /i "%GH_TOKEN:~0,4%"=="ghp_" set "PREFIX_BAD=0"
if /i "%GH_TOKEN:~0,11%"=="github_pat_" set "PREFIX_BAD=0"
if /i "%GH_TOKEN:~0,4%"=="gho_" set "PREFIX_BAD=0"
if /i "%GH_TOKEN:~0,4%"=="ghu_" set "PREFIX_BAD=0"
if /i "%GH_TOKEN:~0,4%"=="ghs_" set "PREFIX_BAD=0"
if /i "%GH_TOKEN:~0,4%"=="ghr_" set "PREFIX_BAD=0"
if "!PREFIX_BAD!"=="1" (
  echo.
  echo [自检] 输入的内容不像 GitHub 仓库凭据。
  echo   本机识别到的开头: %GH_TOKEN:~0,8%
  echo   正确格式应以 ghp_ 或 github_pat_ 开头；其他平台的密钥 GitHub 不认。
  echo.
  echo 已中止，请重新运行并输入 GitHub 仓库访问凭据。
  echo.
  pause
  exit /b 1
)

if not defined GH_TOKEN (
  echo 未输入凭据，已终止。
  pause
  exit /b 1
)

REM 推送
echo.
echo 正在推送到 GitHub...
set "PUSH_URL=https://x-access-token:%GH_TOKEN%@github.com/%REPO_FULL%.git"
set "PUSH_LOG=%TEMP%\zxs_deploy_push.log"
set "PUSH_OK=0"
set "AUTH_DEAD="

git config http.lowSpeedLimit 0
git config http.lowSpeedTime 9999
git config http.maxRequestBuffer 104857600

call :PUSH_DIRECT 3
if "!AUTH_DEAD!" == "1" goto AUTH_DEAD_END
if defined GOOD_IP (
  if not "!PUSH_OK!" == "1" call :PUSH_WITH_RETRY "!GOOD_IP!" 3
)
if "!AUTH_DEAD!" == "1" goto AUTH_DEAD_END
if not "!PUSH_OK!" == "1" (
  echo 直连与首选线路未成功，正在尝试其他线路...
  for %%r in (
    192.30.255.112
    4.208.26.197
    20.27.177.113
    20.26.156.215
    20.207.73.82
    140.82.112.3
    140.82.113.3
    140.82.114.3
    140.82.121.3
    20.205.243.166
  ) do (
    if not "!PUSH_OK!" == "1" (
      if not "%%r" == "!GOOD_IP!" (
        call :PUSH_WITH_RETRY "%%r" 2
        if "!AUTH_DEAD!" == "1" goto AUTH_DEAD_END
      )
    )
  )
)

if "!PUSH_OK!" == "1" goto PUSH_SUCCESS

findstr /C:"main -> main" "%PUSH_LOG%" >nul 2>&1
if !ERRORLEVEL! == 0 goto PUSH_SUCCESS
findstr /C:"Everything up-to-date" "%PUSH_LOG%" >nul 2>&1
if !ERRORLEVEL! == 0 goto PUSH_SUCCESS

echo.
echo [失败] 所有线路推送均失败。详情：
echo   %PUSH_LOG%
echo.
type "%PUSH_LOG%"
echo.
call :DIAGNOSE_FAIL
goto DEPLOY_END

:AUTH_DEAD_END
echo.
echo [失败] 认证未通过，已停止重试（认证问题与线路无关，无需逐个 IP 尝试）。
echo   详情: %PUSH_LOG%
echo.
type "%PUSH_LOG%"
echo.
call :DIAGNOSE_FAIL
goto DEPLOY_END

:PUSH_SUCCESS
echo.
echo [成功] 推送完成。
echo.
echo ===== 自动配置 GitHub Pages（源=GitHub Actions）=====
call :CONFIGURE_PAGES
echo.
echo 构建状态: %ACTIONS_URL%
echo 线上地址: %PAGES_URL%

:DEPLOY_END
set "PUSH_URL="
set "GH_TOKEN="
echo.
pause
exit /b 0

REM 直连推送（系统 DNS，不强制 IP）
:PUSH_DIRECT
set "TRY_N=%~1"
set /a D_IDX=0
:PUSH_DIRECT_LOOP
set /a D_IDX+=1
echo   系统直连 第 %D_IDX%/%TRY_N% 次尝试...
git -c credential.helper= push "%PUSH_URL%" main > "%PUSH_LOG%" 2>&1
if !ERRORLEVEL! == 0 (
  set "PUSH_OK=1"
  goto :EOF
)
call :CHECK_AUTH_DEAD
if "!AUTH_DEAD!" == "1" exit /b 0
if %D_IDX% lss %TRY_N% goto PUSH_DIRECT_LOOP
exit /b 0

:CHECK_AUTH_DEAD
findstr /C:"Invalid username or token" /C:"Authentication failed" /C:"Password authentication is not supported" /C:"could not read Username" /C:"terminal prompts disabled" "%PUSH_LOG%" >nul 2>&1
if !ERRORLEVEL! == 0 set "AUTH_DEAD=1"
exit /b 0

:DIAGNOSE_FAIL
findstr /C:"could not read Password" /C:"terminal prompts disabled" /C:"Authentication failed" /C:"Invalid username or token" /C:"Password authentication is not supported" "%PUSH_LOG%" >nul 2>&1
if !ERRORLEVEL! == 0 (
  echo 诊断：GitHub 拒绝了本次推送凭据（认证未通过，与网络线路无关）。
  echo   已强制禁用系统凭据缓存，仅使用本次输入的凭据；请重新运行并再输入一次凭据。
  echo   若仍不通过，请确认该凭据对仓库有写入权限。
  goto :EOF
)
findstr /C:"Could not resolve proxy" "%PUSH_LOG%" >nul 2>&1
if !ERRORLEVEL! == 0 (
  echo 诊断：代理地址无效 —— 请还原 git 的 http.proxy 设置：git config --global --unset http.proxy
  echo   本脚本不再需要代理；如果你开了代理，请确保是全局模式并已关闭。
  goto :EOF
)
findstr /C:"10054" /C:"Connection was reset" /C:"Empty reply" /C:"timed out" /C:"Could not resolve host" "%PUSH_LOG%" >nul 2>&1
if !ERRORLEVEL! == 0 (
  echo 诊断：连接被重置/中断 —— 这不是凭据问题。
  echo   curl/浏览器能打开 GitHub 但 git 写操作不通，通常是运营商链路问题。
  echo   建议：换手机热点试；确保 VPN 为全局模式（部分模式 git 不走代理）。
  goto :EOF
)
findstr /C:"401" /C:"403" /C:"Permission denied" /C:"not found" "%PUSH_LOG%" >nul 2>&1
if !ERRORLEVEL! == 0 (
  echo 诊断：凭据权限不足 —— 这是鉴权问题，不是网络问题。
  echo   需要 repo（classic）或 Contents=写入（细粒度）权限。
  goto :EOF
)
echo 诊断：原因未知，请把上面的日志发给 AI 处理；发送前删掉凭据那一行。
exit /b 0

:PUSH_WITH_RETRY
set "TRY_IP=%~1"
set "TRY_N=%~2"
set /a P_IDX=0
:PUSH_RETRY_LOOP
set /a P_IDX+=1
echo   线路 %TRY_IP% 第 %P_IDX%/%TRY_N% 次尝试...
git -c credential.helper= -c http.curloptResolve=github.com:443:%TRY_IP% push "%PUSH_URL%" main > "%PUSH_LOG%" 2>&1
if !ERRORLEVEL! == 0 (
  set "PUSH_OK=1"
  > "%IPFILE%" echo %TRY_IP%
  goto :EOF
)
call :CHECK_AUTH_DEAD
if "!AUTH_DEAD!" == "1" exit /b 0
if %P_IDX% lss %TRY_N% goto PUSH_RETRY_LOOP
exit /b 0

REM 子程序
:CONFIGURE_PAGES
set "API_BASE=https://api.github.com/repos/%REPO_FULL%"
echo   正在调用 GitHub API，把 Pages 源设置为 GitHub Actions ...
curl -s -o "%TEMP%\zxs_pages.json" -w "   HTTP %%{http_code}\n" -X PUT ^
  -H "Accept: application/vnd.github+json" ^
  -H "Authorization: Bearer %GH_TOKEN%" ^
  -H "X-GitHub-Api-Version: 2022-11-28" ^
  "%API_BASE%/pages" ^
  -d "{\"build_type\":\"workflow\"}"
echo   HTTP 200/204 表示 Pages 源已成功设置为 GitHub Actions。

echo   接下来请到 GitHub 仓库的 Actions 页面手动触发一次部署。
echo   查看地址：%ACTIONS_URL%
echo   通常 1-2 分钟后刷新线上地址即可看到新版本（首次可能更久）。
exit /b 0

:PROBE
set "PROBE_CODE="
for /f "usebackq delims=" %%c in (`"%CURL_BIN%" -s -o nul -w "%%{http_code}" --connect-timeout 4 --max-time 9 --resolve github.com:443:%~1 "%REPO_URL%/info/refs?service=git-upload-pack" 2^>nul`) do set "PROBE_CODE=%%c"
if "%PROBE_CODE%" == "200" exit /b 0
if "%PROBE_CODE%" == "401" exit /b 0
exit /b 1
