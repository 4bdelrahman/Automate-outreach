@echo off
cd /d "C:\Users\lenovo\Desktop\Email Automation"
set GH="C:\Program Files\GitHub CLI\gh.exe"

echo ================================================
echo  Step 1: Login to GitHub (browser will open)
echo ================================================
%GH% auth login --web --hostname github.com --git-protocol https

echo.
echo ================================================
echo  Step 2: Create private GitHub repo
echo ================================================
%GH% repo create email-automation --private --source=. --remote=origin --push --description "Email outreach automation"

echo.
echo ================================================
echo  Step 3: Add secrets (API keys)
echo ================================================
echo 3260ecc1e0bd8a5995271c9fcb722d55845e3729| %GH% secret set HUNTER_API_KEY
echo abdelrhman.ahmedmyp1@gmail.com| %GH% secret set GMAIL_USER
echo ujvm iuop qsup mulo| %GH% secret set GMAIL_PASSWORD

echo.
echo ================================================
echo  Step 4: Enable GitHub Actions
echo ================================================
%GH% workflow enable outreach.yml

echo.
echo ================================================
echo  ALL DONE!
echo  The bot will now run every 30 minutes on GitHub
echo  even when your laptop is off.
echo.
echo  Watch it run at: https://github.com/$(gh api user --jq .login)/email-automation/actions
echo ================================================
pause
