@echo off
cd /d "E:\프로젝트\입낚"
(
echo === lock 파일 제거 ===
del /f ".git\index.lock" 2>&1
del /f ".git\HEAD.lock" 2>&1
echo === git add ===
git add -A 2>&1
echo === git commit ===
git commit -m "UI 개선: AI측정 NFC입력, 하단여백, 마켓헤더 정리, 텍스트크기 조정" 2>&1
echo === git push ===
git push origin main 2>&1
echo === 완료 ===
git log --oneline -3 2>&1
) > "E:\프로젝트\입낚\git_push_result.txt" 2>&1
echo Done. Check git_push_result.txt
