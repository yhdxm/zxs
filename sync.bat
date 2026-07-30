@echo off
cd /d "%~dp0"

echo ============================================
echo   拉取远程最新代码 (Smart Dashboard)
echo ============================================
echo.
echo 请输入 GitHub Token（需包含 repo + workflow 权限）:
set /p TOKEN=
echo.

if "%TOKEN%"=="" (
  echo [错误] 未输入 Token，已取消。
  pause
  exit /b 1
)

git config --global http.version HTTP/1.1
git config --global http.postBuffer 524288000
git config --global https.postBuffer 524288000

set REPO=https://YHDXM:%TOKEN%@github.com/YHDXM/ZXS.git

echo [1/3] 备份当前本地版本到分支 backup-local ...
git branch backup-local 2>nul
git branch -f backup-local 2>nul

echo [2/3] 拉取远程最新代码（最多重试 3 次）...
set RETRY=0
:fetch_loop
git fetch %REPO% main
if "%errorlevel%"=="0" goto fetch_ok
set /a RETRY+=1
if %RETRY% LSS 3 (
  echo   第 %RETRY% 次拉取失败，5 秒后重试...
  timeout /t 5 >nul
  goto fetch_loop
)
echo.
echo [失败] 拉取远程代码失败。可能原因：
echo   1. 网络被重置 —— 请开启代理/梯子后重试，或改用 SSH 方式；
echo   2. Token 权限不足 —— 请确认 Token 勾选了 repo 与 workflow；
echo   3. Token 已失效 —— 请重新生成。
echo 旧的本地代码未被改动，可放心重试。
pause
exit /b 1

:fetch_ok
echo   拉取成功。
echo [3/3] 以远程版本覆盖本地代码 ...
git reset --hard FETCH_HEAD

echo.
echo ============================================
echo   同步完成！本地代码已更新为远程最新版本。
echo   旧版本已备份在 backup-local 分支，如需找回：
echo     git merge backup-local
echo   线上已是最新，无需重新发布。
echo ============================================
echo.
pause
