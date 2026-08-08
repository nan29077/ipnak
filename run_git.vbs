Dim oShell
Set oShell = CreateObject("WScript.Shell")
oShell.Run "cmd /c ""E:\프로젝트\입낚\do_git_push.bat""", 0, True
Set oShell = Nothing
