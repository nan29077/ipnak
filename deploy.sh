#!/bin/bash
echo "🚀 배포 시작..."
cd /var/www/ipnak

git pull origin main

# 프로덕션(MariaDB)용 provider로 변경 (로컬 개발은 sqlite 유지)
sed -i 's/provider = "sqlite"/provider = "mysql"/' prisma/schema.prisma

npm run build
pm2 restart ipnak
echo "✅ 배포 완료!"
