"use client";

import { createContext, useContext, ReactNode } from "react";

const PartnerOrgContext = createContext<{ orgDisplayName: string } | null>(null);

export function PartnerOrgProvider({
  orgDisplayName,
  children,
}: {
  orgDisplayName: string;
  children: ReactNode;
}) {
  return (
    <PartnerOrgContext.Provider value={{ orgDisplayName }}>
      {children}
    </PartnerOrgContext.Provider>
  );
}

export function usePartnerOrgDisplayName(): string {
  const ctx = useContext(PartnerOrgContext);
  return ctx?.orgDisplayName ?? "Partner";
}
