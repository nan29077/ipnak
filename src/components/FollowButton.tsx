"use client";
import { useState, type MouseEvent } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui";
import { LoginRequiredModal } from "@/components/LoginRequiredModal";

export function FollowButton({ userId, initial, size = "md", full = true, loggedIn = true }: { userId: string; initial: boolean; size?: "sm" | "md" | "lg"; full?: boolean; loggedIn?: boolean }) {
  const toast = useToast();
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [loginModal, setLoginModal] = useState(false);

  async function toggle(e?: MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    if (!loggedIn) { setLoginModal(true); return; }
    setBusy(true);
    const prev = following;
    setFollowing(!prev);
    const res = await fetch(`/api/users/${userId}/follow`, { method: "POST" });
    setBusy(false);
    if (!res.ok) { setFollowing(prev); toast("로그인이 필요합니다", "error"); return; }
    const data = await res.json();
    setFollowing(data.following);
  }

  return (
    <>
      <Button
        onClick={toggle}
        disabled={busy}
        full={full}
        size={size}
        variant={following ? "outline" : "primary"}
        leftIcon={following ? <UserCheck size={size === "sm" ? 14 : 16} /> : <UserPlus size={size === "sm" ? 14 : 16} />}
      >
        {following ? "팔로잉" : "팔로우"}
      </Button>
      <LoginRequiredModal open={loginModal} onClose={() => setLoginModal(false)} feature="팔로우" />
    </>
  );
}
