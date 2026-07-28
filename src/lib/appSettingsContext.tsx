"use client";
import { createContext, useContext } from "react";

export type AppSettings = {
  bassOnlyMode: boolean;
  reservationEnabled: boolean;
  shopMenuEnabled: boolean;
  shopTagEnabled: boolean;
  walkingFeedEnabled: boolean;
  pointsEnabled: boolean;
  // 낚시단 유료 개설(개설 10,000P · 가입 1,000P) — pointsEnabled 가 ON 일 때만 유효
  groupPointsRequired: boolean;
};

const AppSettingsContext = createContext<AppSettings>({
  bassOnlyMode: false,
  reservationEnabled: true,
  shopMenuEnabled: true,
  shopTagEnabled: true,
  walkingFeedEnabled: true,
  pointsEnabled: false,
  groupPointsRequired: false,
});

export function AppSettingsProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AppSettings;
}) {
  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettings {
  return useContext(AppSettingsContext);
}

/** 배스낚시 전용 모드 ON → "앵글러", OFF → "낚시꾼" */
export function useAnglerLabel(): string {
  const { bassOnlyMode } = useContext(AppSettingsContext);
  return bassOnlyMode ? "앵글러" : "낚시꾼";
}
