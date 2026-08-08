@echo off
echo [입낚 실서버 배포 시작]
ssh -o StrictHostKeyChecking=no ubuntu@43.201.119.217 "cd /var/www/ipnak && git pull origin main && npm run build 2>&1 | tail -5 && pm2 restart ipnak && pm2 list"
echo [배포 완료]
pause
