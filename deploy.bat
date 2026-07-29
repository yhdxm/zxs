@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo === Smart Dashboard HTTPS Deploy ===
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
  if !ERRORLEVEL! == 0 goto :GIT_READY
  echo.
  echo git.exe not found. Please install Git for Windows first:
  echo   https://git-scm.com/download/win
  echo During install, select: "Git from the command line and also from 3rd-party software"
  pause
  exit /b 1
)

set "PATH=%GIT_BIN_DIR%;%PATH%"

:GIT_READY
git --version >nul 2>&1
if !ERRORLEVEL! neq 0 (
  echo.
  echo git.exe path is invalid.
  pause
  exit /b 1
)

if not exist ".git" (
  echo Initializing git repository...
  git init
  git remote add origin https://github.com/YHDXM/ZXS.git
)

git remote get-url origin >nul 2>&1
if !ERRORLEVEL! neq 0 (
  git remote add origin https://github.com/YHDXM/ZXS.git
)

:: Local commit identity (does not touch global git config)
git config user.email "deploy@zxs.local"
git config user.name "ZXS Deploy"

:: Local HTTP tuning for large pushes
git config http.version HTTP/1.1
git config http.postBuffer 524288000
git config https.postBuffer 524288000
git config http.sslVerify true

git add -A
git diff --cached --quiet
if !ERRORLEVEL! neq 0 (
  git commit -m "deploy: update site (%date% %time%)"
) else (
  echo No changes to commit. Pushing existing state...
)

git branch -M main

echo.
echo Pushing to GitHub (will retry up to 3 times)...
set ATTEMPT=0
:RETRY
set /a ATTEMPT+=1
git push -f origin main
if !ERRORLEVEL! == 0 goto SUCCESS
echo.
echo Attempt %ATTEMPT% failed.
if %ATTEMPT% lss 3 (
  echo Retrying in 5 seconds...
  timeout /t 5 /nobreak >nul
  goto RETRY
)
echo.
echo HTTPS push failed after 3 attempts.
echo Try deploy-ssh.bat if an SSH key is configured, or install Git for Windows.
pause
exit /b 1

:SUCCESS
echo.
echo Push finished. Check GitHub Actions tab for build status.
pause
