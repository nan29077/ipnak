"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, User, FileText, MapPin, Check, Loader2, X, Phone } from "lucide-react";
import { PageHeader, Button } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { getAvatarUrl } from "@/lib/avatarUtils";
import { PasswordChangeSection } from "@/components/PasswordChangeSection";

export default function EditProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nickname, setNickname] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [region, setRegion] = useState("");
  const [userId, setUserId] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  // 소셜 전용 계정은 비밀번호 변경 폼 대신 안내를 보여준다
  const [hasPassword, setHasPassword] = useState(true);

  // 현재 프로필 불러오기 — 비로그인이면 저장할 수 없으므로 로그인 페이지로 보낸다
  // (다른 /me 하위 페이지는 서버 컴포넌트라 redirect로 처리하지만 이 페이지는 클라이언트 컴포넌트다)
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d?.user) {
          setUserId(d.user.id ?? "");
          setNickname(d.user.nickname ?? "");
          setName(d.user.name ?? "");
          setPhone(d.user.phone ?? "");
          setBio(d.user.bio ?? "");
          setRegion(d.user.region ?? "");
          setAvatarUrl(d.user.avatarUrl ?? null);
          setAvatarPreview(d.user.avatarUrl ?? null);
          setHasPassword(d.user.hasPassword !== false);
          setLoading(false);
        } else {
          router.replace("/login");
        }
      })
      .catch(() => setLoading(false));
  }, [router]);

  // 프로필 사진 선택 → 압축 → base64 preview
  const handleAvatarFile = useCallback((file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const SIZE = 200;
      const scale = Math.min(1, SIZE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const b64 = canvas.toDataURL("image/jpeg", 0.8);
      setAvatarPreview(b64);
      setAvatarUrl(b64);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  async function handleSave() {
    if (!nickname.trim() || nickname.trim().length < 2) {
      toast("닉네임은 2자 이상이어야 합니다", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), name: name.trim(), phone: phone.trim(), bio: bio.trim(), region: region.trim(), avatarUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      toast("프로필을 업데이트했습니다", "success");
      router.replace("/me");
      router.refresh();
    } catch (e: any) {
      toast(e?.message || "저장에 실패했습니다", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader title="프로필 수정" back />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleAvatarFile(e.target.files?.[0])}
      />

      <div className="space-y-5 p-4">
        {/* 프로필 사진 */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-orange-500/40 bg-navy-50">
              <img
                src={avatarPreview && !avatarPreview.includes("pravatar.cc") ? avatarPreview : getAvatarUrl(userId, null)}
                alt="프로필"
                className="h-full w-full object-cover"
              />
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-gray-900 shadow-soft transition-colors hover:bg-orange-600"
            >
              <Camera size={15} />
            </button>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="text-[13px] font-semibold text-orange-400 hover:text-orange-300"
          >
            사진 변경
          </button>
        </div>

        {/* 닉네임 */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-navy-400">
            <User size={13} /> 닉네임 <span className="text-orange-400">*</span>
          </label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            placeholder="닉네임 (2~20자)"
            className="w-full rounded-xl border border-navy-100 bg-[#162538] px-4 py-3 text-[14px] text-navy-800 placeholder-navy-300 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
          />
          <p className="mt-1 text-right text-[11px] text-navy-400">{nickname.length}/20</p>
        </div>

        {/* 이름 */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-navy-400">
            <User size={13} /> 이름
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            placeholder="이름 (선택)"
            className="w-full rounded-xl border border-navy-100 bg-[#162538] px-4 py-3 text-[14px] text-navy-800 placeholder-navy-300 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
          />
        </div>

        {/* 전화번호 */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-navy-400">
            <Phone size={13} /> 전화번호
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={20}
            type="tel"
            placeholder="예: 010-1234-5678 (선택)"
            className="w-full rounded-xl border border-navy-100 bg-[#162538] px-4 py-3 text-[14px] text-navy-800 placeholder-navy-300 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
          />
        </div>

        {/* 한 줄 소개 */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-navy-400">
            <FileText size={13} /> 한 줄 소개
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="나를 소개해 보세요 (선택, 최대 200자)"
            className="w-full resize-none rounded-xl border border-navy-100 bg-[#162538] px-4 py-3 text-[14px] text-navy-800 placeholder-navy-300 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
          />
          <p className="mt-1 text-right text-[11px] text-navy-400">{bio.length}/200</p>
        </div>

        {/* 주요 활동 지역 */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-navy-400">
            <MapPin size={13} /> 주요 활동 지역
          </label>
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            maxLength={30}
            placeholder="예: 서울, 경기, 부산 등"
            className="w-full rounded-xl border border-navy-100 bg-[#162538] px-4 py-3 text-[14px] text-navy-800 placeholder-navy-300 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
          />
        </div>

        {/* 저장 버튼 */}
        <Button
          full
          onClick={handleSave}
          disabled={saving}
          leftIcon={saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        >
          {saving ? "저장 중..." : "저장하기"}
        </Button>

        <PasswordChangeSection hasPassword={hasPassword} />
      </div>
    </div>
  );
}
