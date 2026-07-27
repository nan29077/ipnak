@echo off
del /f "E:\프로젝트\입낚\.git\index.lock"
cd /d "E:\프로젝트\입낚"
git add public/ipnak-ball-40mm-bear-logo-print-sheet-a4.png public/ipnak-ball-flat-bass-example.png public/logo-ipnak-bear-mark-ball-white-arrow.png
git commit -m "입낚볼 이미지 교체: 인쇄물 낚시바늘 로고 복원, 볼 예시 사진 로고 적용"
echo 완료! 아무 키나 누르세요...
pause
