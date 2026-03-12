@echo off
cd /d "%~dp0"
echo ================================================
echo  Email Automation Autopilot
echo ================================================
npm install --silent
node main.js
pause
