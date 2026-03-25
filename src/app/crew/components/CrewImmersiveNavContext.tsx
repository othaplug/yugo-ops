"use client";

import { createContext, useContext } from "react";

export type CrewImmersiveNavApi = {
  immersiveNav: boolean;
  setImmersiveNav: (v: boolean) => void;
};

export const CrewImmersiveNavContext = createContext<CrewImmersiveNavApi | null>(null);

export function useCrewImmersiveNav() {
  const ctx = useContext(CrewImmersiveNavContext);
  if (!ctx) {
    throw new Error("useCrewImmersiveNav must be used within CrewShell");
  }
  return ctx;
}
