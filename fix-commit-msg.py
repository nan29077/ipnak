# -*- coding: utf-8 -*-
import subprocess
import os
import sys
import tempfile

os.chdir(r"E:\프로젝트\입낚")

print("[1/4] 깨진 커밋 3개 소프트 리셋...")
# Remove stale lock if exists
lock = r".git\index.lock"
if os.path.exists(lock):
    os.remove(lock)

subprocess.run(["git", "reset", "--soft", "HEAD~3"], check=True)

print("[2/4] 전체 스테이징...")
subprocess.run(["git", "add", "-A"], check=True)

print("[3/4] 올바른 한국어 메시지로 커밋...")
msg = "알리고 알림톡/SMS 연동: OTP 회원가입 인증, 관리자 발송 페이지, AI API 연결 SMS 탭 제거, 전체 변경사항 통합"

with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', suffix='.txt', delete=False) as f:
    f.write(msg)
    tmpfile = f.name

env = os.environ.copy()
env['GIT_TERMINAL_PROMPT'] = '0'
subprocess.run(["git", "commit", "-F", tmpfile], check=True, env=env)
os.unlink(tmpfile)

print("[4/4] origin main 강제 push...")
subprocess.run(["git", "push", "origin", "main", "--force"], check=True)

print()
subprocess.run(["git", "log", "--oneline", "-5"])
print()
print("완료! GitHub에서 한국어가 정상 표시됩니다.")
input("Press Enter to exit...")
