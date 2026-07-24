"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { SessionUser } from "@/components/AppShell";

const UserContext = createContext<SessionUser>(null);

export function UserProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser(): SessionUser {
  return useContext(UserContext);
}
