@echo off
cd /d "%~dp0"
echo ================================================
echo  GitHub Autopilot Setup
echo ================================================
echo.

:: Check if git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed.
    echo Download it from: https://git-scm.com/download/win
    pause
    exit /b
)

:: Initialize git repo if not already done
if not exist ".git" (
    git init
    echo [OK] Git repo initialized.
)

:: Stage all files
git add .
git commit -m "Initial email automation setup" --allow-empty

echo.
echo ================================================
echo  NEXT STEP: Push to GitHub
echo ================================================
echo.
echo 1. Go to https://github.com/new
echo 2. Create a NEW private repo called: email-automation
echo 3. Copy the repo URL (looks like: https://github.com/YOURNAME/email-automation.git)
echo.
set /p REPO_URL="Paste your GitHub repo URL here and press Enter: "

git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] Code pushed to GitHub!
    echo.
    echo ================================================
    echo  FINAL STEP: Add Secrets in GitHub
    echo ================================================
    echo.
    echo Go to your repo on GitHub:
    echo   Settings ^> Secrets and variables ^> Actions ^> New repository secret
    echo.
    echo Add these 3 secrets:
    echo   Name: HUNTER_API_KEY     Value: 3260ecc1e0bd8a5995271c9fcb722d55845e3729
    echo   Name: GMAIL_USER         Value: abdelrhman.ahmedmyp1@gmail.com
    echo   Name: GMAIL_PASSWORD     Value: ujvm iuop qsup mulo
    echo.
    echo Once done, the bot runs every 30 minutes automatically — even with laptop off!
) else (
    echo [ERROR] Push failed. Make sure the repo URL is correct and you're logged in.
)

echo.
pause
