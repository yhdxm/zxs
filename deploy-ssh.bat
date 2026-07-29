@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo === Smart Dashboard SSH Deploy ===
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

set KEYFILE=%USERPROFILE%\.ssh\id_ed25519

if not exist "%KEYFILE%" (
  echo SSH key not found at %KEYFILE%.
  echo.
  echo Generate one first:
  echo   1. Open Git Bash
  echo   2. Run: ssh-keygen -t ed25519 -C "YHDXM"
  echo   3. Press Enter to save to default location
  echo   4. Go to https://github.com/settings/keys and click "New SSH key"
  echo   5. Copy the contents of: %KEYFILE%.pub
  echo   6. Paste into GitHub and save
  echo.
  pause
  exit /b 1
)

if not exist ".git" (
  echo Initializing git repository...
  git init
  git remote add origin git@github.com:YHDXM/ZXS.git
)

git remote get-url origin >nul 2>&1
if !ERRORLEVEL! neq 0 (
  git remote add origin git@github.com:YHDXM/ZXS.git
) else (
  git remote set-url origin git@github.com:YHDXM/ZXS.git
)

:: Local commit identity (does not touch global git config)
git config user.email "deploy@zxs.local"
git config user.name "ZXS Deploy"

git add -A
git diff --cached --quiet
if !ERRORLEVEL! neq 0 (
  git commit -m "deploy: update site (%date% %time%)"
) else (
  echo No changes to commit. Pushing existing state...
)

git branch -M main

echo.
echo Pushing to GitHub via SSH...
git push -f origin main
if !ERRORLEVEL! neq 0 (
  echo.
  echo SSH push failed. Make sure the SSH key is added to GitHub:
  echo   https://github.com/settings/keys
  echo.
  pause
  exit /b 1
)

echo.
echo Push finished. Check GitHub Actions tab for build status.
pause
