# -*- coding: utf-8 -*-
import subprocess
import os
import sys
import tempfile

os.chdir(r"E:\프로젝트\입낚")

print("[1/3] git lock 파일 정리...")
for lock in [r".git\index.lock", r".git\HEAD.lock", r".git\packed-refs.lock"]:
    if os.path.exists(lock):
        os.remove(lock)
        print(f"  삭제: {lock}")

print("[2/3] 전체 스테이징...")
subprocess.run(["git", "add", "-A"], check=True)

print("[3/3] 한국어 메시지로 커밋 및 push...")
msg = "알리고 알림톡/SMS 연동: OTP 회원가입 인증, 관리자 발송 페이지, AI API 연결 SMS 탭 제거, 전체 변경사항 통합"

with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', suffix='.txt', delete=False) as f:
    f.write(msg)
    tmpfile = f.name

env = os.environ.copy()
env['GIT_TERMINAL_PROMPT'] = '0'

result = subprocess.run(["git", "commit", "-F", tmpfile], env=env)
os.unlink(tmpfile)

if result.returncode != 0:
    print("커밋 실패 - 변경사항 없을 수 있음")
else:
    print("[4] origin main push...")
    subprocess.run(["git", "push", "origin", "main", "--force"], check=True)

print()
result2 = subprocess.run(["git", "log", "--oneline", "-5"], capture_output=True, text=True, encoding='utf-8')
print(result2.stdout)
print("완료!")
input("Press Enter to exit...")
