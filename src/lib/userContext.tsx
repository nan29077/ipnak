"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { SessionUser } from "@/components/AppShell";
import { setLocalUserId } from "@/services/DatabaseService";

const UserContext = createContext<SessionUser>(null);

export function UserProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  // 계측일지(localStorage)는 계정별 키로 분리 저장한다.
  // useEffect 로 미루면 자식(계측일지)의 첫 로드 이펙트가 먼저 돌아 guest 버킷을 읽으므로
  // 렌더 시점에 동기로 주입한다. setLocalUserId 는 값이 같으면 즉시 반환한다.
  if (typeof window !== "undefined") setLocalUserId(user?.id ?? null);
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser(): SessionUser {
  return useContext(UserContext);
}
