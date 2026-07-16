"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus } from "lucide-react";
import { Sheet, Button, Select, Card } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { won, kstFormat } from "@/lib/utils";
import { addDays } from "date-fns";

export function BookingForm({ listingId, price, maxPeople, slots, loggedIn }: {
  listingId: string; price: number; maxPeople: number;
  slots: { date: string; timeLabel: string | null; remaining: number }[]; loggedIn: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(slots[0]?.date ?? kstFormat(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [people, setPeople] = useState(1);
  const [loading, setLoading] = useState(false);

  async function book() {
    setLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, date, people }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류");
      toast("예약이 요청되었습니다 (확정 대기)", "success");
      setOpen(false);
      router.push("/me");
      router.refresh();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-navy-100 bg-[#1e1e1e] p-3 md:relative md:border-0 md:p-0">
        <div className="mx-auto flex max-w-[640px] items-center gap-3">
          <div className="md:hidden"><p className="text-[11px] text-navy-400">1인</p><p className="text-base font-extrabold text-navy-800">{won(price)}</p></div>
          <Button size="lg" className="ml-auto flex-1 md:flex-none md:px-8"
            onClick={() => loggedIn ? setOpen(true) : toast("로그인이 필요합니다", "error")}>
            예약하기
          </Button>
        </div>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="예약 정보">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy-700">날짜 / 시간</label>
            <Select value={date} onChange={(e) => setDate(e.target.value)}>
              {slots.map((s, i) => (
                <option key={i} value={s.date} disabled={s.remaining <= 0}>
                  {kstFormat(new Date(s.date), "M월 d일")} {s.timeLabel} · {s.remaining > 0 ? `잔여 ${s.remaining}` : "마감"}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy-700">인원</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setPeople((p) => Math.max(1, p - 1))} aria-label="인원 줄이기" className="rounded-full bg-navy-50 p-2 text-navy-700 btn-press transition-colors hover:bg-navy-100"><Minus size={16} /></button>
              <span className="w-10 text-center text-base font-bold text-navy-800">{people}</span>
              <button onClick={() => setPeople((p) => Math.min(maxPeople, p + 1))} aria-label="인원 늘리기" className="rounded-full bg-navy-50 p-2 text-navy-700 btn-press transition-colors hover:bg-navy-100"><Plus size={16} /></button>
              <span className="text-xs text-navy-300">최대 {maxPeople}명</span>
            </div>
          </div>
          <Card className="flex items-center justify-between bg-navy-50/60 px-3 py-3">
            <span className="text-sm text-navy-500">총 결제금액</span>
            <span className="text-lg font-extrabold text-navy-800">{won(price * people)}</span>
          </Card>
          <p className="text-xs text-navy-300">※ 결제는 추후 PG 연동 예정입니다. 지금은 mock 예약으로 처리됩니다.</p>
          <Button full onClick={book} disabled={loading}
            leftIcon={loading ? <Loader2 size={16} className="animate-spin" /> : undefined}>
            예약 요청
          </Button>
        </div>
      </Sheet>
    </>
  );
}
