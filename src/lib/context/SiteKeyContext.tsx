"use client";

import { createContext, useContext } from "react";
import { CUSTOMER } from "@/config/customer";

const SiteKeyContext = createContext<string>(CUSTOMER.siteKey);

export function SiteKeyProvider({
  siteKey,
  children,
}: {
  siteKey: string;
  children: React.ReactNode;
}) {
  return (
    <SiteKeyContext.Provider value={siteKey}>
      {children}
    </SiteKeyContext.Provider>
  );
}

export function useSiteKey(): string {
  return useContext(SiteKeyContext);
}
