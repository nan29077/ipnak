@echo off
chcp 65001 >nul
cd /d "E:\프로젝트\입낚"
echo 개발 서버 재시작 중...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 >nul
start "" cmd /c "start-dev.bat"
echo 재시작 완료!
