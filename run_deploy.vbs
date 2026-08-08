Set shell = CreateObject("WScript.Shell")
shell.Run "cmd /c ""cd /d E:\프로젝트\입낚 && ssh -o StrictHostKeyChecking=no ubuntu@43.201.119.217 ""cd /var/www/ipnak && git pull origin main && npm run build 2>&1 | tail -5 && pm2 restart ipnak && pm2 list"" > E:\프로젝트\입낚\deploy_result.txt 2>&1""", 1, True
shell.Run "notepad E:\프로젝트\입낚\deploy_result.txt", 1, False
