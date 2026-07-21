"use client";
import { createContext, useContext } from "react";

export type AppSettings = {
  bassOnlyMode: boolean;
  reservationEnabled: boolean;
  shopMenuEnabled: boolean;
  walkingFeedEnabled: boolean;
  pointsEnabled: boolean;
};

const AppSettingsContext = createContext<AppSettings>({
  bassOnlyMode: false,
  reservationEnabled: true,
  shopMenuEnabled: true,
  walkingFeedEnabled: true,
  pointsEnabled: false,
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
