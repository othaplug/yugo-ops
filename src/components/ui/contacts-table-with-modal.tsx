"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  ChevronDown,
  Download,
  Mail,
  Share2,
  User,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { cn } from "@/lib/utils"

import { defaultContacts } from "./contacts-table-with-modal.data"
import type { Contact } from "./contacts-table-with-modal.types"

export type { Contact } from "./contacts-table-with-modal.types"

interface ContactsTableProps {
  title?: string
  contacts?: Contact[]
  onContactSelect?: (contactId: string) => void
  className?: string
  enableAnimations?: boolean
}

type SortField = "name" | "connectionStrength" | "twitterFollowers"
type SortOrder = "asc" | "desc"

const strengthOrder: Record<Contact["connectionStrength"], number> = {
  "Very weak": 0,
  Weak: 1,
  Good: 2,
  "Very strong": 3,
}

const getStrengthColor = (strength: string) => {
  const map: Record<
    string,
    { bgColor: string; textColor: string; dotColor: string }
  > = {
    "Very weak": {
      bgColor: "bg-[var(--yu3-danger-tint)]",
      textColor: "text-[var(--yu3-danger)]",
      dotColor: "bg-[var(--yu3-danger)]",
    },
    Weak: {
      bgColor: "bg-[var(--yu3-warning-tint)]",
      textColor: "text-[var(--yu3-warning)]",
      dotColor: "bg-[var(--yu3-warning)]",
    },
    Good: {
      bgColor: "bg-[var(--yu3-info-tint)]",
      textColor: "text-[var(--yu3-info)]",
      dotColor: "bg-[var(--yu3-info)]",
    },
    "Very strong": {
      bgColor: "bg-[var(--yu3-success-tint)]",
      textColor: "text-[var(--yu3-success)]",
      dotColor: "bg-[var(--yu3-success)]",
    },
  }
  return map[strength]!
}

const triggerDownload = (blob: Blob, name: string) => {
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

export const ContactsTable = ({
  title = "Person",
  contacts: initialContacts = defaultContacts,
  onContactSelect,
  className = "",
  enableAnimations = true,
}: ContactsTableProps) => {
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [filterStrength, setFilterStrength] = useState<string | null>(null)
  const [selectedContactDetail, setSelectedContactDetail] =
    useState<Contact | null>(null)
  const shouldReduceMotion = useReducedMotion()
  const selectAllInputRef = useRef<HTMLInputElement>(null)

  const ITEMS_PER_PAGE = 10

  const handleContactSelect = (contactId: string) => {
    setSelectedContacts((prev) => {
      if (prev.includes(contactId)) {
        return prev.filter((id) => id !== contactId)
      }
      return [...prev, contactId]
    })
    onContactSelect?.(contactId)
  }

  const handleSelectAll = useCallback(
    (pageIds: string[]) => {
      const allPageSelected =
        pageIds.length > 0 && pageIds.every((id) => selectedContacts.includes(id))
      if (allPageSelected) {
        setSelectedContacts((prev) => prev.filter((id) => !pageIds.includes(id)))
      } else {
        setSelectedContacts((prev) => Array.from(new Set([...prev, ...pageIds])))
      }
    },
    [selectedContacts]
  )

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortOrder("asc")
    }
    setShowSortMenu(false)
    setCurrentPage(1)
  }

  const handleFilter = (strength: string | null) => {
    setFilterStrength(strength)
    setShowFilterMenu(false)
    setCurrentPage(1)
  }

  const sortedAndFilteredContacts = useMemo(() => {
    let filtered = [...initialContacts]
    if (filterStrength) {
      filtered = filtered.filter((c) => c.connectionStrength === filterStrength)
    }
    if (!sortField) {
      return filtered
    }
    return [...filtered].sort((a, b) => {
      let aVal: string | number = a[sortField]
      let bVal: string | number = b[sortField]
      if (sortField === "connectionStrength") {
        aVal = strengthOrder[a.connectionStrength]
        bVal = strengthOrder[b.connectionStrength]
      }
      if (aVal < bVal) {
        return sortOrder === "asc" ? -1 : 1
      }
      if (aVal > bVal) {
        return sortOrder === "asc" ? 1 : -1
      }
      return 0
    })
  }, [filterStrength, initialContacts, sortField, sortOrder])

  const paginatedContacts = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE
    return sortedAndFilteredContacts.slice(
      startIdx,
      startIdx + ITEMS_PER_PAGE
    )
  }, [currentPage, sortedAndFilteredContacts])

  const pageIds = useMemo(
    () => paginatedContacts.map((c) => c.id),
    [paginatedContacts]
  )

  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedContacts.includes(id))
  const somePageSelected = pageIds.some((id) => selectedContacts.includes(id))

  useEffect(() => {
    const el = selectAllInputRef.current
    if (el) {
      el.indeterminate = somePageSelected && !allPageSelected
    }
  }, [allPageSelected, somePageSelected])

  const totalPages = Math.ceil(
    sortedAndFilteredContacts.length / ITEMS_PER_PAGE
  )

  const exportToCSV = () => {
    const headers = [
      "Name",
      "Email",
      "Connection Strength",
      "Twitter Followers",
      "Description",
    ]
    const rows = sortedAndFilteredContacts.map((contact) => [
      contact.name,
      contact.email,
      contact.connectionStrength,
      String(contact.twitterFollowers),
      contact.description ?? "",
    ])
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(",")
      ),
    ].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" })
    triggerDownload(
      blob,
      `contacts-${new Date().toISOString().split("T")[0]}.csv`
    )
  }

  const exportToJSON = () => {
    const jsonContent = JSON.stringify(sortedAndFilteredContacts, null, 2)
    const blob = new Blob([jsonContent], {
      type: "application/json;charset=utf-8",
    })
    triggerDownload(
      blob,
      `contacts-${new Date().toISOString().split("T")[0]}.json`
    )
  }

  const shouldAnimate = enableAnimations && !shouldReduceMotion

  const containerVariants = {
    visible: {
      transition: {
        staggerChildren: shouldAnimate ? 0.04 : 0,
        delayChildren: shouldAnimate ? 0.1 : 0,
      },
    },
  }

  const rowVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.98, filter: "blur(4px)" },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        type: "spring" as const,
        stiffness: 400,
        damping: 25,
        mass: 0.7,
      },
    },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
  }

  return (
    <div className={cn("mx-auto w-full max-w-7xl", className)}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2" />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              className={cn(
                "bg-background text-foreground border-border/50 hover:bg-muted/30 flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
                filterStrength && "ring-primary/30 ring-2"
              )}
              onClick={() => {
                setShowFilterMenu((v) => !v)
              }}
              type="button"
            >
              <svg
                aria-hidden
                className="shrink-0"
                fill="none"
                height="14"
                viewBox="0 0 16 16"
                width="14"
              >
                <path
                  d="M2 3H14M4 8H12M6 13H10"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.5"
                />
              </svg>
              Filter
              {filterStrength ? (
                <span className="bg-primary text-primary-foreground ml-1 rounded-sm px-1.5 py-0.5 text-xs">
                  1
                </span>
              ) : null}
            </button>
            {showFilterMenu ? (
              <>
                <button
                  aria-label="Close filter menu"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => {
                    setShowFilterMenu(false)
                  }}
                  type="button"
                />
                <div className="bg-background border-border/50 absolute right-0 z-20 mt-1 w-44 rounded-md border py-1 shadow-lg">
                  <button
                    className={cn(
                      "hover:bg-muted/50 w-full px-3 py-2 text-left text-sm transition-colors",
                      !filterStrength && "bg-muted/30"
                    )}
                    onClick={() => {
                      handleFilter(null)
                    }}
                    type="button"
                  >
                    All Connections
                  </button>
                  <div className="bg-border/30 my-1 h-px" />
                  {["Very strong", "Good", "Weak", "Very weak"].map(
                    (strength) => (
                      <button
                        key={strength}
                        className={cn(
                          "hover:bg-muted/50 flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                          filterStrength === strength && "bg-muted/30"
                        )}
                        onClick={() => {
                          handleFilter(strength)
                        }}
                        type="button"
                      >
                        {strength}
                      </button>
                    )
                  )}
                </div>
              </>
            ) : null}
          </div>

          <div className="relative">
            <button
              className="bg-background text-foreground border-border/50 hover:bg-muted/30 flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors"
              onClick={() => {
                setShowSortMenu((v) => !v)
              }}
              type="button"
            >
              <svg
                aria-hidden
                className="shrink-0"
                fill="none"
                height="14"
                viewBox="0 0 16 16"
                width="14"
              >
                <path
                  d="M3 6L6 3L9 6M6 3V13M13 10L10 13L7 10M10 13V3"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
              Sort
              {sortField ? (
                <span className="bg-primary text-primary-foreground ml-1 rounded-sm px-1.5 py-0.5 text-xs">
                  1
                </span>
              ) : null}
              <ChevronDown
                aria-hidden
                className="opacity-50"
                size={14}
              />
            </button>
            {showSortMenu ? (
              <>
                <button
                  aria-label="Close sort menu"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => {
                    setShowSortMenu(false)
                  }}
                  type="button"
                />
                <div className="bg-background border-border/50 absolute right-0 z-20 mt-1 w-48 rounded-md border py-1 shadow-lg">
                  <button
                    className={cn(
                      "hover:bg-muted/50 w-full px-3 py-2 text-left text-sm transition-colors",
                      sortField === "name" && "bg-muted/30"
                    )}
                    onClick={() => {
                      handleSort("name")
                    }}
                    type="button"
                  >
                    Name{" "}
                    {sortField === "name"
                      ? `(${sortOrder === "asc" ? "A to Z" : "Z to A"})`
                      : null}
                  </button>
                  <button
                    className={cn(
                      "hover:bg-muted/50 w-full px-3 py-2 text-left text-sm transition-colors",
                      sortField === "connectionStrength" && "bg-muted/30"
                    )}
                    onClick={() => {
                      handleSort("connectionStrength")
                    }}
                    type="button"
                  >
                    Connection{" "}
                    {sortField === "connectionStrength"
                      ? `(${
                          sortOrder === "asc" ? "Weaker first" : "Stronger first"
                        })`
                      : null}
                  </button>
                  <button
                    className={cn(
                      "hover:bg-muted/50 w-full px-3 py-2 text-left text-sm transition-colors",
                      sortField === "twitterFollowers" && "bg-muted/30"
                    )}
                    onClick={() => {
                      handleSort("twitterFollowers")
                    }}
                    type="button"
                  >
                    Followers{" "}
                    {sortField === "twitterFollowers"
                      ? `(${
                          sortOrder === "asc" ? "Low to high" : "High to low"
                        })`
                      : null}
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <div className="relative">
            <button
              className="bg-background text-foreground border-border/50 hover:bg-muted/30 flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors"
              onClick={() => {
                setShowExportMenu((v) => !v)
              }}
              type="button"
            >
              <Download aria-hidden size={14} />
              Export
              <ChevronDown aria-hidden className="opacity-50" size={14} />
            </button>
            {showExportMenu ? (
              <>
                <button
                  aria-label="Close export menu"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => {
                    setShowExportMenu(false)
                  }}
                  type="button"
                />
                <div className="bg-background border-border/50 absolute right-0 z-20 mt-1 w-32 rounded-md border shadow-lg">
                  <button
                    className="hover:bg-muted/50 flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors"
                    onClick={() => {
                      exportToCSV()
                      setShowExportMenu(false)
                    }}
                    type="button"
                  >
                    CSV
                  </button>
                  <button
                    className="border-border/30 hover:bg-muted/50 flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm transition-colors"
                    onClick={() => {
                      exportToJSON()
                      setShowExportMenu(false)
                    }}
                    type="button"
                  >
                    JSON
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="bg-background border-border/50 relative overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <div className="min-w-[1100px]">
            <div
              className="text-muted-foreground/60 border-border/30 bg-muted/5 border-b px-3 py-3 text-left text-xs font-medium"
              style={{
                display: "grid",
                gridTemplateColumns:
                  "40px 220px 160px 140px 200px 1fr 40px",
                columnGap: "0",
              }}
            >
              <div className="border-border/20 flex items-center justify-center border-r pr-3">
                <input
                  ref={selectAllInputRef}
                  aria-label="Select all on this page"
                  checked={allPageSelected}
                  className="border-border/40 h-4 w-4 cursor-pointer rounded accent-zinc-500"
                  onChange={() => {
                    handleSelectAll(pageIds)
                  }}
                  type="checkbox"
                />
              </div>
              <div className="border-border/20 flex items-center gap-1.5 border-r px-3">
                <svg
                  aria-hidden
                  className="opacity-40"
                  fill="none"
                  height="14"
                  viewBox="0 0 16 16"
                  width="14"
                >
                  <circle
                    cx="8"
                    cy="6"
                    fill="none"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M3 14C3 11.5 5 10 8 10C11 10 13 11.5 13 14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
                <span>{title}</span>
              </div>
              <div className="border-border/20 flex items-center gap-1.5 border-r px-3">
                <svg
                  aria-hidden
                  className="opacity-40"
                  fill="none"
                  height="14"
                  viewBox="0 0 16 16"
                  width="14"
                >
                  <path
                    d="M3 8L6 5L10 9L13 6"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.5"
                  />
                </svg>
                <span>Connection Streng…</span>
              </div>
              <div className="border-border/20 flex items-center gap-1.5 border-r px-3">
                <svg
                  aria-hidden
                  className="opacity-40"
                  fill="none"
                  height="14"
                  viewBox="0 0 16 16"
                  width="14"
                >
                  <path
                    d="M2 2H4M2 8H6M2 14H8M10 2V14M14 4V14"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.5"
                  />
                </svg>
                <span>Twitter Follo…</span>
              </div>
              <div className="border-border/20 flex items-center gap-1.5 border-r px-3">
                <svg
                  aria-hidden
                  className="opacity-40"
                  fill="none"
                  height="14"
                  viewBox="0 0 16 16"
                  width="14"
                >
                  <rect
                    x="2"
                    y="4"
                    width="12"
                    height="8"
                    fill="none"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M2 6L8 9L14 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
                <span>Email Addresses</span>
              </div>
              <div className="border-border/20 flex items-center gap-1.5 border-r px-3">
                <svg
                  aria-hidden
                  className="opacity-40"
                  fill="none"
                  height="14"
                  viewBox="0 0 16 16"
                  width="14"
                >
                  <path
                    d="M3 3H13M3 8H13M3 13H9"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.5"
                  />
                </svg>
                <span>Description</span>
              </div>
              <div className="flex items-center justify-center px-3">
                <svg
                  aria-hidden
                  className="opacity-30"
                  fill="none"
                  height="14"
                  viewBox="0 0 16 16"
                  width="14"
                >
                  <circle cx="8" cy="8" fill="currentColor" r="1" />
                  <circle cx="13" cy="8" fill="currentColor" r="1" />
                  <circle cx="3" cy="8" fill="currentColor" r="1" />
                </svg>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`page-${currentPage}`}
                animate="visible"
                initial={shouldAnimate ? "hidden" : "visible"}
                variants={shouldAnimate ? containerVariants : { visible: {} }}
              >
                {paginatedContacts.map((contact) => (
                  <motion.div
                    key={contact.id}
                    initial={false}
                    variants={shouldAnimate ? rowVariants : { visible: {} }}
                  >
                    <div
                      className={cn(
                        "group border-border/20 border-b px-3 py-3.5 transition-all duration-150",
                        "relative grid",
                        selectedContacts.includes(contact.id)
                          ? "bg-muted/30"
                          : "hover:bg-muted/20 bg-muted/5"
                      )}
                      style={{
                        gridTemplateColumns:
                          "40px 220px 160px 140px 200px 1fr 40px",
                        columnGap: 0,
                        alignItems: "center",
                      }}
                    >
                      <div className="border-border/20 flex items-center justify-center border-r pr-3">
                        <input
                          aria-label={`Select ${contact.name}`}
                          checked={selectedContacts.includes(contact.id)}
                          className="border-border/40 h-4 w-4 cursor-pointer rounded accent-zinc-500"
                          onChange={() => {
                            handleContactSelect(contact.id)
                          }}
                          type="checkbox"
                        />
                      </div>
                      <div className="border-border/20 flex min-w-0 items-center gap-2 border-r px-3">
                        <div className="bg-muted/30 inline-flex items-center gap-2 rounded-full px-2 py-1">
                          <svg
                            aria-hidden
                            className="h-3.5 w-3.5 shrink-0 opacity-50"
                            fill="none"
                            viewBox="0 0 16 16"
                          >
                            <circle
                              cx="8"
                              cy="6"
                              fill="none"
                              r="3"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                            <path
                              d="M3 14C3 11.5 5 10 8 10C11 10 13 11.5 13 14"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                          </svg>
                          <div className="min-w-0">
                            <div className="text-foreground truncate text-sm">
                              {contact.name}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="border-border/20 flex items-center border-r px-3">
                        {(() => {
                          const { bgColor, textColor, dotColor } =
                            getStrengthColor(contact.connectionStrength)
                          return (
                            <div
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
                                bgColor,
                                textColor
                              )}
                            >
                              {contact.connectionStrength ===
                              "Very strong" ? (
                                <svg
                                  aria-hidden
                                  className="h-3 w-3"
                                  viewBox="0 0 16 16"
                                  fill="currentColor"
                                >
                                  <path d="M8 1L3 9H7L8 15L13 7H9L8 1Z" />
                                </svg>
                              ) : (
                                <div
                                  className={cn("h-1.5 w-1.5 rounded-full", dotColor)}
                                />
                              )}
                              {contact.connectionStrength}
                            </div>
                          )
                        })()}
                      </div>
                      <div className="border-border/20 flex items-center border-r px-3">
                        <span className="text-foreground/80 text-sm">
                          {contact.twitterFollowers.toLocaleString()}
                        </span>
                      </div>
                      <div className="border-border/20 flex min-w-0 items-center border-r px-3">
                        <a
                          className="text-[var(--yu3-wine)] hover:text-[var(--yu3-wine-hover)] truncate text-sm"
                          href={`mailto:${contact.email}`}
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        >
                          {contact.email}
                        </a>
                      </div>
                      <div className="border-border/20 flex min-w-0 items-center border-r px-3">
                        <span className="text-muted-foreground/80 truncate text-sm">
                          {contact.description?.trim() || "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center justify-center px-3">
                        <button
                          aria-label={`Open details for ${contact.name}`}
                          className="hover:opacity-100 cursor-pointer opacity-0 transition-opacity group-hover:opacity-60"
                          onClick={() => {
                            setSelectedContactDetail(contact)
                          }}
                          type="button"
                        >
                          <svg
                            aria-hidden
                            fill="none"
                            height="14"
                            viewBox="0 0 16 16"
                            width="14"
                          >
                            <circle
                              cx="8"
                              cy="3"
                              fill="currentColor"
                              r="1.5"
                            />
                            <circle
                              cx="8"
                              cy="8"
                              fill="currentColor"
                              r="1.5"
                            />
                            <circle
                              cx="8"
                              cy="13"
                              fill="currentColor"
                              r="1.5"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence>
          {selectedContactDetail ? (
            <motion.div
              animate={{ opacity: 1 }}
              className="bg-background/60 absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => {
                setSelectedContactDetail(null)
              }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="bg-card border-border relative mx-6 w-full max-w-md rounded-xl border p-6 shadow-lg"
                exit={{ scale: 0.8, opacity: 0, y: 20 }}
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                onClick={(e) => {
                  e.stopPropagation()
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                  mass: 0.8,
                }}
              >
                <button
                  aria-label="Close"
                  className="bg-muted/50 hover:bg-muted/70 absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full transition-colors"
                  onClick={() => {
                    setSelectedContactDetail(null)
                  }}
                  type="button"
                >
                  <X className="text-muted-foreground h-3 w-3" />
                </button>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-full">
                      <User className="text-primary h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-foreground text-lg font-semibold">
                        {selectedContactDetail.name}
                      </h3>
                      {(() => {
                        const { bgColor, textColor, dotColor } = getStrengthColor(
                          selectedContactDetail.connectionStrength
                        )
                        return (
                          <div
                            className={cn(
                              "mt-1 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
                              bgColor,
                              textColor
                            )}
                          >
                            {selectedContactDetail.connectionStrength ===
                            "Very strong" ? (
                              <svg
                                aria-hidden
                                className="h-3 w-3"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                              >
                                <path d="M8 1L3 9H7L8 15L13 7H9L8 1Z" />
                              </svg>
                            ) : (
                              <div
                                className={cn("h-1.5 w-1.5 rounded-full", dotColor)}
                              />
                            )}
                            {selectedContactDetail.connectionStrength}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-muted-foreground mb-1 flex items-center gap-1.5">
                        <Mail aria-hidden className="h-3.5 w-3.5" />
                        <span className="text-xs tracking-wide uppercase">
                          Email
                        </span>
                      </div>
                      <a
                        className="text-[var(--yu3-wine)] hover:text-[var(--yu3-wine-hover)] text-sm"
                        href={`mailto:${selectedContactDetail.email}`}
                      >
                        {selectedContactDetail.email}
                      </a>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1 flex items-center gap-1.5">
                        <Share2 aria-hidden className="h-3.5 w-3.5" />
                        <span className="text-xs tracking-wide uppercase">
                          Twitter followers
                        </span>
                      </div>
                      <p className="text-foreground text-sm font-medium">
                        {selectedContactDetail.twitterFollowers.toLocaleString()}
                      </p>
                    </div>
                    {selectedContactDetail.description ? (
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">
                          Description
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {selectedContactDetail.description}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="border-border/50 border-t pt-3">
                    <motion.button
                      className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-md px-4 py-2 text-sm font-medium transition-colors"
                      onClick={() => {
                        window.location.assign(
                          `mailto:${selectedContactDetail.email}`
                        )
                      }}
                      type="button"
                      whileHover={
                        shouldReduceMotion ? undefined : { scale: 1.02 }
                      }
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                    >
                      Send email
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between px-2">
          <div className="text-muted-foreground/70 text-xs">
            Page {currentPage} of {totalPages} · {sortedAndFilteredContacts.length}{" "}
            contacts
          </div>
          <div className="flex gap-1.5">
            <button
              className="bg-background text-foreground border-border/50 hover:bg-muted/30 cursor-not-allowed rounded-md border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              disabled={currentPage === 1}
              onClick={() => {
                setCurrentPage((p) => Math.max(1, p - 1))
              }}
              type="button"
            >
              Previous
            </button>
            <button
              className="bg-background text-foreground border-border/50 hover:bg-muted/30 cursor-not-allowed rounded-md border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              disabled={currentPage === totalPages}
              onClick={() => {
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
