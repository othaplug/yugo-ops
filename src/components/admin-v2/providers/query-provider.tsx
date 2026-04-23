"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  })

let browserQueryClient: QueryClient | null = null

const getQueryClient = () => {
  if (typeof window === "undefined") return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  const client = getQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
