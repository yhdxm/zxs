@echo off
cd /d %~dp0
echo ============================================
echo  ZXS deploy: commit (if needed) + push
echo ============================================
echo Staging fix files (no-op if already committed)...
git add scripts/rls_secure.sql
git add src/data/freeLlmResources.ts
git add src/prep/degreeService.ts
git add src/services/pushService.ts
git add src/views/DegreeEnglishView.vue
git add src/views/PushManageView.vue
git add src/views/SystemManageView.vue
git add src/views/WeaknessView.vue
git add src/prep/degreePhrasesExtra.ts
git add src/prep/degreeQuestionBank.ts

git diff --cached --quiet
if %errorlevel%==0 (
  echo No new changes to commit, pushing existing commits...
) else (
  set /p MSG=Commit message (Enter = default): 
  if "%MSG%"=="" set MSG=fix(push/degree): superadmin list, push user id, question bank merge, note optimistic, wordbook filter
  git commit -m "%MSG%"
)

echo.
echo Pushing to origin main...
echo When prompted, enter your GitHub username and Personal Access Token (this is the "key").
git push origin main

echo.
echo Done. Open GitHub Actions to confirm build success:
echo https://github.com/YHDXM/ZXS/actions
pause
