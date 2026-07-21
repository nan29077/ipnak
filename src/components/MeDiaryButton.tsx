"use client";
/**
 * 마이페이지 — "내 측정일지 전체보기" 버튼 + 바텀시트
 * 서버 컴포넌트(me/page.tsx)에서 client state 를 사용할 수 없으므로 분리
 */
import { useState } from "react";
import { Button } from "@/components/ui";
import { DiarySheet } from "@/components/DiarySheet";

export function MeDiaryButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" full onClick={() => setOpen(true)}>
        내 측정일지 전체보기
      </Button>
      <DiarySheet open={open} onClose={() => setOpen(false)} groupByDate />
    </>
  );
}
