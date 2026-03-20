"use client";

import { IconContext } from "@phosphor-icons/react";

export default function PhosphorProvider({ children }: { children: React.ReactNode }) {
  return (
    <IconContext.Provider value={{ weight: "duotone" }}>
      {children}
    </IconContext.Provider>
  );
}
