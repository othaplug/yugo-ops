"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

const DRAWER_PARAM = "drawer"

type DrawerHandle = {
  isOpen: boolean
  id: string | null
  open: (id: string) => void
  close: () => void
  setOpen: (open: boolean) => void
}

const buildValue = (module: string, id: string) => `${module}:${id}`

const parseValue = (
  raw: string | null,
  module: string,
): { matches: boolean; id: string | null } => {
  if (!raw) return { matches: false, id: null }
  const [mod, ...rest] = raw.split(":")
  if (mod !== module) return { matches: false, id: null }
  return { matches: true, id: rest.join(":") || null }
}

export const useDrawer = (module: string): DrawerHandle => {
  const router = useRouter()
  const pathname = usePathname() ?? ""
  const searchParams = useSearchParams()
  const raw = searchParams?.get(DRAWER_PARAM) ?? null
  const { matches, id } = parseValue(raw, module)

  const setParam = React.useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "")
      if (next) {
        params.set(DRAWER_PARAM, next)
      } else {
        params.delete(DRAWER_PARAM)
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const open = React.useCallback(
    (nextId: string) => setParam(buildValue(module, nextId)),
    [module, setParam],
  )

  const close = React.useCallback(() => {
    if (!matches) return
    setParam(null)
  }, [matches, setParam])

  const setOpen = React.useCallback(
    (open: boolean) => {
      if (!open) close()
    },
    [close],
  )

  return {
    isOpen: matches,
    id,
    open,
    close,
    setOpen,
  }
}
