"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

type PendingChangeRequestsContextType = {
  pendingCount: number;
  refetch: () => void;
};

const Context = createContext<PendingChangeRequestsContextType>({ pendingCount: 0, refetch: () => {} });

export function PendingChangeRequestsProvider({ children }: { children: ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);

  const refetch = useCallback(() => {
    fetch("/api/admin/change-requests/pending-count")
      .then((r) => r.json())
      .then((d) => setPendingCount(typeof d.count === "number" ? d.count : 0))
      .catch(() => setPendingCount(0));
  }, []);

  useEffect(() => {
    refetch();
    // Refetch again after 2s so badge appears quickly if first request was slow or realtime is delayed
    const early = setTimeout(refetch, 2000);
    const interval = setInterval(refetch, 60000);
    return () => {
      clearTimeout(early);
      clearInterval(interval);
    };
  }, [refetch]);

  return (
    <Context.Provider value={{ pendingCount, refetch }}>
      {children}
    </Context.Provider>
  );
}

export function usePendingChangeRequests() {
  return useContext(Context);
}
