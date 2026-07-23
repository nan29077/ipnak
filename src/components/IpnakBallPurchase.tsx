"use client";

import { FormEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, CreditCard, Loader2, MapPin, Minus, Package, Plus, Radio, Search, ShieldCheck, Truck, X } from "lucide-react";
import { AddressSearchModal } from "@/components/AddressSearchModal";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

type Step = "intro" | "form" | "pay" | "done";
const methods = [
  { key: "card", label: "신용·체크카드" },
  { key: "transfer", label: "계좌이체" },
  { key: "phone", label: "휴대폰 결제" },
];

export function IpnakBallPurchase({ price, buyer }: { price: number; buyer: { name: string; email: string } }) {
  const toast = useToast();
  const detailAddressRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [step, setStep] = useState<Step>("intro");
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState("card");
  const [loading, setLoading] = useState(false);
  const [orderNo, setOrderNo] = useState("");
  const [form, setForm] = useState({
    buyerName: buyer.name, buyerPhone: "", buyerEmail: buyer.email,
    recipientName: buyer.name, recipientPhone: "", postalCode: "", address: "",
    addressDetail: "", deliveryMemo: "",
  });

  const close = () => {
    if (!loading) {
      setAddressOpen(false);
      setOpen(false);
      if (step === "done") setStep("intro");
    }
  };
  function submitInfo(e: FormEvent) { e.preventDefault(); setStep("pay"); }
  async function pay() {
    setLoading(true);
    try {
      const res = await fetch("/api/ipnak-ball/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, quantity: qty, paymentMethod: method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "결제에 실패했습니다.");
      setOrderNo(data.orderNo); setStep("done");
    } catch (e: any) { toast(e.message, "error"); }
    finally { setLoading(false); }
  }
  const field = (key: keyof typeof form, label: string, required = false, type = "text") => (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-white/60">{label}{required && " *"}</span>
      <input type={type} required={required} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-full rounded-xl border border-white/10 bg-white/[.05] px-3 py-2.5 text-sm text-white outline-none focus:border-aqua-400" />
    </label>
  );

  return <>
    <div className="overflow-hidden rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/15 via-[#202020] to-aqua-500/10 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-soft"><Radio size={23} /></span>
        <div className="min-w-0 flex-1"><p className="text-[16px] font-extrabold text-navy-900">스마트 계측의 시작, 입낚볼</p><p className="mt-0.5 text-[12px] text-navy-400">NFC 연동으로 나의 어획 기록을 더 간편하게</p><p className="mt-2 text-[19px] font-extrabold text-orange-400">{price.toLocaleString()}원</p></div>
      </div>
      <button onClick={() => { setStep("intro"); setOpen(true); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-extrabold text-white">입낚볼 구매하기</button>
    </div>

    {open && typeof document !== "undefined" && createPortal(
      <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/75 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && close()}>
        <div className="ipnak-ball-scrollbar max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] bg-[#151b21] text-white shadow-2xl sm:rounded-[28px]">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#151b21]/95 px-5 py-4 backdrop-blur">
            <button onClick={() => step === "intro" ? close() : setStep(step === "pay" ? "form" : "intro")} className="p-1 text-white/60">{step === "intro" || step === "done" ? <X /> : <ChevronLeft />}</button>
            <p className="font-bold">{step === "intro" ? "입낚볼 소개" : step === "form" ? "구매자·배송지 정보" : step === "pay" ? "PG 결제" : "주문 완료"}</p><span className="w-7" />
          </div>

          {step === "intro" && <div className="p-5 pb-[max(24px,env(safe-area-inset-bottom))]">
            <div className="flex aspect-[16/8] items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500/25 to-aqua-500/20"><Radio size={72} className="text-orange-400" /></div>
            <h2 className="mt-5 text-xl font-extrabold">입낚볼 하나로 더 스마트한 낚시</h2>
            <div className="mt-4 space-y-3 text-sm text-white/65"><p className="flex gap-2"><Radio className="shrink-0 text-aqua-400" size={18} /> NFC 태그로 앱과 빠르게 연결</p><p className="flex gap-2"><ShieldCheck className="shrink-0 text-aqua-400" size={18} /> 측정 기록과 입낚볼 ID를 안전하게 저장</p><p className="flex gap-2"><Truck className="shrink-0 text-aqua-400" size={18} /> 결제 완료 후 순차 배송</p></div>
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/[.05] p-4"><span>수량</span><div className="flex items-center gap-3"><button onClick={() => setQty(Math.max(1, qty - 1))} className="rounded-full bg-white/10 p-1"><Minus size={16}/></button><b>{qty}</b><button onClick={() => setQty(Math.min(10, qty + 1))} className="rounded-full bg-white/10 p-1"><Plus size={16}/></button></div></div>
            <button onClick={() => setStep("form")} className="mt-5 w-full rounded-2xl bg-orange-500 py-3.5 font-extrabold">{(price * qty).toLocaleString()}원 · 구매하기</button>
          </div>}

          {step === "form" && <form onSubmit={submitInfo} className="space-y-5 p-5 pb-[max(24px,env(safe-area-inset-bottom))]">
            <section><h3 className="mb-3 flex items-center gap-2 font-bold"><Package size={17} className="text-orange-400"/>구매자 정보</h3><div className="space-y-3">{field("buyerName", "이름", true)}{field("buyerPhone", "휴대전화", true, "tel")}{field("buyerEmail", "이메일", false, "email")}</div></section>
            <section>
              <h3 className="mb-3 flex items-center gap-2 font-bold"><MapPin size={17} className="text-aqua-400"/>배송지 정보</h3>
              <div className="space-y-3">
                {field("recipientName", "받는 분", true)}
                {field("recipientPhone", "연락처", true, "tel")}
                <div>
                  <span className="mb-1 block text-[12px] font-semibold text-white/60">주소 *</span>
                  <div className="flex gap-2">
                    <input required readOnly value={form.postalCode} placeholder="우편번호" onClick={() => setAddressOpen(true)} className="w-[110px] rounded-xl border border-white/10 bg-white/[.05] px-3 py-2.5 text-sm text-white outline-none" />
                    <button type="button" onClick={() => setAddressOpen(true)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-orange-500/50 bg-orange-500/10 px-3 py-2.5 text-sm font-bold text-orange-300 hover:bg-orange-500/20"><Search size={16} /> 주소 검색</button>
                  </div>
                  <input required readOnly value={form.address} placeholder="주소 검색 버튼을 눌러 주세요" onClick={() => setAddressOpen(true)} className="mt-2 w-full cursor-pointer rounded-xl border border-white/10 bg-white/[.05] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-400" />
                </div>
                <label className="block"><span className="mb-1 block text-[12px] font-semibold text-white/60">상세 주소</span><input ref={detailAddressRef} value={form.addressDetail} onChange={(e) => setForm({ ...form, addressDetail: e.target.value })} placeholder="동·호수 등 상세주소" className="w-full rounded-xl border border-white/10 bg-white/[.05] px-3 py-2.5 text-sm text-white outline-none focus:border-aqua-400" /></label>
                {field("deliveryMemo", "배송 메모")}
              </div>
            </section>
            <button type="submit" className="w-full rounded-2xl bg-orange-500 py-3.5 font-extrabold">{(price * qty).toLocaleString()}원 결제하기</button>
          </form>}

          {step === "pay" && <div className="p-5 pb-[max(24px,env(safe-area-inset-bottom))]">
            <div className="rounded-2xl bg-white/[.05] p-5 text-center"><p className="text-xs text-white/50">최종 결제 금액</p><p className="mt-1 text-3xl font-extrabold">₩{(price * qty).toLocaleString()}</p></div>
            <p className="mb-2 mt-5 text-xs font-bold text-white/60">결제 수단</p><div className="grid grid-cols-3 gap-2">{methods.map(m => <button key={m.key} onClick={() => setMethod(m.key)} className={cn("rounded-xl border px-2 py-3 text-xs font-semibold", method === m.key ? "border-aqua-400 bg-aqua-500/10 text-aqua-300" : "border-white/10 text-white/50")}>{m.label}</button>)}</div>
            <p className="mt-4 rounded-xl bg-white/[.05] p-3 text-[11px] leading-relaxed text-white/50">현재 개발 환경의 테스트 PG 결제창입니다. 운영 PG 키 연동 시 동일한 주문 흐름에서 실제 승인 결과를 처리합니다.</p>
            <button onClick={pay} disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3.5 font-extrabold disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={18}/> : <CreditCard size={18}/>} 결제 승인</button>
          </div>}
          {step === "done" && <div className="p-8 text-center pb-[max(32px,env(safe-area-inset-bottom))]"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-aqua-500/15 text-aqua-400"><Check size={32}/></span><h2 className="mt-4 text-xl font-extrabold">구매가 완료되었습니다</h2><p className="mt-2 text-sm text-white/55">주문번호 {orderNo}<br/>관리자가 배송 상태를 순차적으로 업데이트합니다.</p><button onClick={close} className="mt-6 w-full rounded-2xl bg-white/10 py-3 font-bold">확인</button></div>}
        </div>
      </div>, document.body)}

    <AddressSearchModal open={addressOpen} onClose={() => setAddressOpen(false)} onComplete={({ postalCode, address }) => {
      setForm((current) => ({ ...current, postalCode, address }));
      setAddressOpen(false);
      window.setTimeout(() => detailAddressRef.current?.focus(), 50);
    }} />
  </>;
}
