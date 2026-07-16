"use client";
import { createContext, useContext } from "react";

export type AppSettings = {
  bassOnlyMode: boolean;
  reservationEnabled: boolean;
};

const AppSettingsContext = createContext<AppSettings>({
  bassOnlyMode: false,
  reservationEnabled: true,
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
