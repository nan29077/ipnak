@echo off
cd /d "E:\프로젝트\입낚"
echo prisma generate 실행 중...
node_modules\.bin\prisma.cmd generate > prisma_gen_result.txt 2>&1
type prisma_gen_result.txt
