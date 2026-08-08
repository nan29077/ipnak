Set oShell = CreateObject("WScript.Shell")
oShell.Run "cmd /c cd /d E:\프로젝트\입낚 && npx prisma generate > prisma_gen_result.txt 2>&1", 1, True
oShell.Run "notepad E:\프로젝트\입낚\prisma_gen_result.txt", 1, False
