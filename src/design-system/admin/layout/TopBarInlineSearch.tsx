"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { runAdminTopbarSearch, type AdminSearchResult } from "@/lib/admin-search"
import { cn } from "../lib/cn"

/** Stable id for mobile nav / programatic focus (see AdminShell) */
export const YU3_TOPBAR_SEARCH_INPUT_ID = "yu3-topbar-search-input"

export function TopBarInlineSearch() {
  const router = useRouter()
  const supabase = React.useMemo(() => createClient(), [])
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<AdminSearchResult[]>([])
  const [panelOpen, setPanelOpen] = React.useState(false)
  const [searching, setSearching] = React.useState(false)
  const [selectedIdx, setSelectedIdx] = React.useState(0)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = React.useCallback(
    async (q: string) => {
      const r = await runAdminTopbarSearch(supabase, q, 12)
      setResults(r)
      setSelectedIdx(0)
      setSearching(false)
    },
    [supabase],
  )

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const t = query.trim()
    if (t.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(() => {
      void runSearch(t)
    }, 240)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, runSearch])

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setPanelOpen(false)
      }
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  React.useEffect(() => {
    setSelectedIdx((i) => Math.min(i, Math.max(0, results.length - 1)))
  }, [results.length])

  const navigate = (href: string) => {
    setPanelOpen(false)
    setQuery("")
    setResults([])
    router.push(href)
  }

  const q2 = query.trim().length >= 2
  const showPanel = panelOpen && q2
  const showEmpty = showPanel && !searching && results.length === 0

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (results.length === 0) return
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (results.length === 0) return
      setSelectedIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      const r = results[selectedIdx]
      if (r) {
        e.preventDefault()
        navigate(r.href)
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      setPanelOpen(false)
      setQuery("")
      setResults([])
    }
  }

  return (
    <div
      ref={rootRef}
      className="yu3-topbar-search relative min-w-0 w-full"
    >
      <div
        className={cn(
          "flex min-w-0 items-center h-9 md:h-10 pl-3 sm:pl-3.5 pr-1.5 sm:pr-2 rounded-full",
          "bg-[var(--yu3-topbar-search-bg)] border border-[var(--yu3-line-subtle)]",
          "ring-0 ring-offset-0 shadow-none",
          "focus-within:ring-0 focus-within:ring-offset-0 focus-within:shadow-none",
          "focus-within:border-[var(--yu3-line-subtle)]",
        )}
        >
        <input
          id={YU3_TOPBAR_SEARCH_INPUT_ID}
          type="search"
          name="topbar-entity-search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPanelOpen(true)
          }}
          onFocus={() => setPanelOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search the app, people, and records"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className={cn(
            "flex-1 min-w-0 bg-transparent text-[12px] sm:text-[13px] text-[var(--yu3-topbar-search-ink)] placeholder:text-[var(--yu3-ink-faint)]",
            "border-0 outline-none ring-0 ring-offset-0",
            "focus:outline-none focus:ring-0 focus:ring-offset-0",
            "focus-visible:outline-none focus-visible:ring-0",
            "appearance-none",
          )}
          aria-label="Search the Yugo app, people, and records"
          aria-expanded={showPanel}
          aria-controls="yu3-topbar-search-results"
          aria-autocomplete="list"
        />
      </div>

      {showPanel ? (
        <div
          id="yu3-topbar-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-[var(--yu3-z-palette)] mt-1.5 max-h-[min(60dvh,360px)] overflow-y-auto rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] shadow-[var(--yu3-shadow-lg)]"
        >
          {searching ? (
            <div className="px-3 py-4 text-center text-[12px] text-[var(--yu3-ink-muted)]">
              Searching
            </div>
          ) : showEmpty ? (
            <div className="px-3 py-4 text-center text-[12px] text-[var(--yu3-ink-muted)]">
              No results
            </div>
          ) : (
            results.map((r, idx) => (
              <button
                key={`${r.href}-${idx}`}
                type="button"
                role="option"
                aria-selected={idx === selectedIdx}
                onMouseEnter={() => setSelectedIdx(idx)}
                onClick={() => navigate(r.href)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-left border-b border-[var(--yu3-line-subtle)] last:border-0",
                  idx === selectedIdx
                    ? "bg-[var(--yu3-wine-wash)]"
                    : "hover:bg-[var(--yu3-bg-surface-sunken)]",
                )}
              >
                <span
                  className={cn(
                    "shrink-0 text-[9px] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-[4px] border border-[var(--yu3-line-subtle)]",
                    "text-[var(--yu3-ink-muted)]",
                  )}
                >
                  {r.type}
                </span>
                <div className="min-w-0 flex-1 text-left">
                  <div className="text-[12px] font-semibold text-[var(--yu3-ink-strong)] truncate">
                    {r.name}
                  </div>
                  {r.sub ? (
                    <div className="text-[10px] text-[var(--yu3-ink-faint)] truncate">
                      {r.sub}
                    </div>
                  ) : null}
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
