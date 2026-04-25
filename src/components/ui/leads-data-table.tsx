"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowUpRight, ChevronDown, MoreHorizontal } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { cn } from "@/lib/utils"

export type LeadsTableBulkAction =
  | "engage"
  | "createGroup"
  | "downloadCsv"
  | "delete"

export interface Lead {
  id: string
  name: string
  email: string
  source: string
  sourceType: "organic" | "campaign"
  status: "pre-sale" | "closed" | "lost" | "closing" | "new"
  size: number
  interest: number[]
  probability: "low" | "mid" | "high"
  lastAction: string
}

export interface LeadsTableProps {
  title?: string
  leads?: Lead[]
  onLeadAction?: (leadId: string, action: string) => void
  onBulkAction?: (action: LeadsTableBulkAction, leadIds: string[]) => void
  className?: string
}

const defaultLeads: Lead[] = [
  {
    id: "1",
    name: "Andy Shepard",
    email: "a.shepard@gmail.com",
    source: "ORGANIC",
    sourceType: "organic",
    status: "pre-sale",
    size: 120000,
    interest: [45, 52, 48, 55, 58, 60, 57, 62, 65, 63],
    probability: "mid",
    lastAction: "Sep 12, 2024",
  },
  {
    id: "2",
    name: "Emily Thompson",
    email: "a.shepard@gmail.com",
    source: "SB2024",
    sourceType: "campaign",
    status: "closed",
    size: 200000,
    interest: [30, 35, 42, 48, 55, 62, 68, 70, 75, 78],
    probability: "high",
    lastAction: "Sep 13, 2024",
  },
  {
    id: "3",
    name: "Michael Carter",
    email: "a.shepard@gmail.com",
    source: "SUMMER2",
    sourceType: "campaign",
    status: "pre-sale",
    size: 45000,
    interest: [70, 68, 65, 60, 58, 55, 52, 48, 45, 42],
    probability: "low",
    lastAction: "Sep 12, 2024",
  },
  {
    id: "4",
    name: "David Anderson",
    email: "a.shepard@gmail.com",
    source: "DTJ25",
    sourceType: "campaign",
    status: "pre-sale",
    size: 80000,
    interest: [25, 28, 32, 38, 45, 52, 58, 62, 68, 70],
    probability: "high",
    lastAction: "Sep 12, 2024",
  },
  {
    id: "5",
    name: "Lily Hernandez",
    email: "a.shepard@gmail.com",
    source: "ORGANIC",
    sourceType: "organic",
    status: "lost",
    size: 110000,
    interest: [60, 58, 55, 50, 45, 42, 38, 35, 30, 28],
    probability: "low",
    lastAction: "Sep 12, 2024",
  },
  {
    id: "6",
    name: "Christopher Wilson",
    email: "a.shepard@gmail.com",
    source: "SB2024",
    sourceType: "campaign",
    status: "closed",
    size: 2120000,
    interest: [40, 42, 45, 48, 50, 52, 55, 58, 60, 62],
    probability: "mid",
    lastAction: "Sep 12, 2024",
  },
  {
    id: "7",
    name: "Isabella Lopez",
    email: "a.shepard@gmail.com",
    source: "ORGANIC",
    sourceType: "organic",
    status: "closing",
    size: 20000,
    interest: [35, 38, 42, 46, 50, 55, 60, 65, 68, 72],
    probability: "high",
    lastAction: "Sep 12, 2024",
  },
  {
    id: "8",
    name: "Sophia Morgan",
    email: "a.shepard@gmail.com",
    source: "AFF20",
    sourceType: "campaign",
    status: "new",
    size: 95000,
    interest: [55, 52, 48, 45, 40, 38, 35, 32, 30, 28],
    probability: "low",
    lastAction: "Sep 11, 2024",
  },
  {
    id: "9",
    name: "John Davis",
    email: "a.shepard@gmail.com",
    source: "ORGANIC",
    sourceType: "organic",
    status: "pre-sale",
    size: 200000,
    interest: [30, 35, 40, 45, 50, 55, 60, 58, 62, 65],
    probability: "mid",
    lastAction: "Sep 11, 2024",
  },
]

const parseLastActionDate = (s: string) => {
  if (s === "Engage") {
    return new Date("2024-09-15").getTime()
  }
  const t = Date.parse(s)
  return Number.isNaN(t) ? 0 : t
}

export const LeadsTable = ({
  title = "Leads",
  leads: initialLeads = defaultLeads,
  onLeadAction,
  onBulkAction,
  className = "",
}: LeadsTableProps) => {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const [hoveredAction, setHoveredAction] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    setLeads(initialLeads)
  }, [initialLeads])

  const handleLeadSelection = (leadId: string, selected: boolean) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev)
      if (selected) {
        next.add(leadId)
      } else {
        next.delete(leadId)
      }
      return next
    })
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedLeads(new Set(leads.map((lead) => lead.id)))
    } else {
      setSelectedLeads(new Set())
    }
  }

  const isSelected = (leadId: string) => selectedLeads.has(leadId)
  const isAllSelected =
    selectedLeads.size === leads.length && leads.length > 0
  const isIndeterminate =
    selectedLeads.size > 0 && selectedLeads.size < leads.length

  const handleLeadAction = (leadId: string, action: string) => {
    onLeadAction?.(leadId, action)
  }

  const handleSort = useCallback(() => {
    setSortOrder((currentOrder) => {
      const newOrder = currentOrder === "asc" ? "desc" : "asc"
      setLeads((prev) =>
        [...prev].sort((a, b) => {
          const aDate = parseLastActionDate(a.lastAction)
          const bDate = parseLastActionDate(b.lastAction)
          return newOrder === "asc" ? aDate - bDate : bDate - aDate
        })
      )
      return newOrder
    })
  }, [])

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`
    }
    return `$${amount.toLocaleString()}`
  }

  const getSourcePill = (source: string, sourceType: "organic" | "campaign") => {
    const isOrganic = sourceType === "organic"
    return (
      <div
        className={cn(
          "rounded-lg border px-2 py-1 text-xs font-medium",
          isOrganic
            ? "border-[var(--yu3-line)] bg-[var(--yu3-forest-tint)] text-[var(--yu3-forest)]"
            : "border-[var(--yu3-line)] bg-[var(--yu3-info-tint)] text-[var(--yu3-info)]"
        )}
      >
        {source}
        {!isOrganic ? (
          <ArrowUpRight aria-hidden className="ml-1 inline h-3 w-3 opacity-60" />
        ) : null}
      </div>
    )
  }

  const getStatusPill = (status: Lead["status"]) => {
    const statusConfig = {
      "pre-sale": {
        bg: "bg-[var(--yu3-warning-tint)]",
        text: "text-[var(--yu3-warning)]",
        border: "border-[var(--yu3-line)]",
        label: "PRE-SALE",
      },
      closed: {
        bg: "bg-[var(--yu3-success-tint)]",
        text: "text-[var(--yu3-success)]",
        border: "border-[var(--yu3-line)]",
        label: "CLOSED",
      },
      lost: {
        bg: "bg-[var(--yu3-danger-tint)]",
        text: "text-[var(--yu3-danger)]",
        border: "border-[var(--yu3-line)]",
        label: "LOST",
      },
      closing: {
        bg: "bg-[var(--yu3-info-tint)]",
        text: "text-[var(--yu3-info)]",
        border: "border-[var(--yu3-line)]",
        label: "CLOSING",
      },
      new: {
        bg: "bg-[var(--yu3-wine-tint)]",
        text: "text-[var(--yu3-wine)]",
        border: "border-[var(--yu3-line)]",
        label: "NEW",
      },
    } as const
    const config = statusConfig[status]
    return (
      <div
        className={cn(
          "rounded-lg border px-2 py-1 text-xs font-medium",
          config.bg,
          config.text,
          config.border
        )}
      >
        {config.label}
      </div>
    )
  }

  const renderSparkline = (data: number[]) => {
    if (data.length === 0) {
      return <span className="text-muted-foreground/50 text-xs">N/A</span>
    }
    if (data.length === 1) {
      const upColor = "var(--yu3-success)"
      const y = 12
      return (
        <div className="h-6 w-16">
          <svg
            aria-hidden
            className="overflow-visible"
            height="20"
            viewBox="0 0 60 20"
            width="60"
          >
            <circle cx="30" cy={y} fill={upColor} r="2" />
          </svg>
        </div>
      )
    }
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const isUpTrend = data[data.length - 1]! > data[0]!
    const points = data
      .map((value, index) => {
        const x = (index / (data.length - 1)) * 60
        const y = 20 - ((value - min) / range) * 15
        return `${x},${y}`
      })
      .join(" ")

    const upColor = "var(--yu3-success)"
    const downColor = "var(--yu3-danger)"

    const lastX = 60
    const lastY = 20 - ((data[data.length - 1]! - min) / range) * 15

    return (
      <div className="h-6 w-16">
        <svg
          aria-hidden
          className="overflow-visible"
          height="20"
          viewBox="0 0 60 20"
          width="60"
        >
          <polyline
            className="drop-shadow-sm"
            fill="none"
            points={points}
            stroke={isUpTrend ? upColor : downColor}
            strokeWidth="2"
          />
          <circle
            cx={lastX}
            cy={lastY}
            fill={isUpTrend ? upColor : downColor}
            r="2"
          />
        </svg>
      </div>
    )
  }

  const getProbabilityIcon = (probability: Lead["probability"]) => {
    const barCount =
      probability === "low" ? 1 : probability === "mid" ? 2 : 3
    const probabilityColors = {
      low: "bg-[var(--yu3-warning-tint)] text-[var(--yu3-warning)] border-[var(--yu3-line)]",
      mid: "bg-[var(--yu3-neutral-tint)] text-[var(--yu3-ink)] border-[var(--yu3-line)]",
      high: "bg-[var(--yu3-success-tint)] text-[var(--yu3-success)] border-[var(--yu3-line)]",
    }
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border px-2 py-1 text-xs font-medium",
          probabilityColors[probability]
        )}
      >
        <div className="flex items-end gap-0.5">
          {[1, 2, 3].map((bar) => (
            <div
              key={bar}
              className={cn(
                "w-1 rounded-full",
                bar <= barCount ? "bg-current" : "bg-current/30"
              )}
              style={{
                height: bar === 1 ? "4px" : bar === 2 ? "8px" : "12px",
              }}
            />
          ))}
        </div>
        <span className="uppercase tracking-wide">{probability}</span>
      </div>
    )
  }

  const containerVariants = {
    visible: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.04,
        delayChildren: shouldReduceMotion ? 0 : 0.1,
      },
    },
  }

  const rowVariants = shouldReduceMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.15 } },
      }
    : {
        hidden: {
          opacity: 0,
          y: 20,
          scale: 0.98,
          filter: "blur(4px)",
        },
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
      }

  const handleBulk = (action: LeadsTableBulkAction) => {
    const ids = Array.from(selectedLeads)
    onBulkAction?.(action, ids)
  }

  return (
    <div className={cn("mx-auto w-full max-w-7xl", className)}>
      <h2 className="sr-only">{title}</h2>
      <div className="bg-background border-border/50 overflow-hidden rounded-2xl border">
        <div className="text-muted-foreground/70 border-border/20 bg-muted/15 border-b px-6 py-3 text-xs font-medium tracking-wide uppercase">
          <div className="grid grid-cols-7 gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  aria-label="Select all leads"
                  checked={isAllSelected}
                  className="bg-background text-muted-foreground focus:ring-muted-foreground/20 accent-muted-foreground h-4 w-4 rounded border-muted-foreground/40 focus:ring-2"
                  onChange={(e) => {
                    handleSelectAll(e.target.checked)
                  }}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = isIndeterminate
                    }
                  }}
                  type="checkbox"
                />
              </div>
              <span>Lead</span>
            </div>
            <div>Source</div>
            <div>Status</div>
            <div>Size</div>
            <div>Interest</div>
            <div>Probability</div>
            <div>
              <button
                className="inline-flex cursor-pointer items-center gap-2"
                onClick={handleSort}
                type="button"
              >
                <span>Last Action</span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "h-4 w-4 transition-transform",
                    sortOrder === "asc" && "rotate-180"
                  )}
                />
              </button>
            </div>
          </div>
        </div>

        <motion.div
          animate="visible"
          initial="hidden"
          variants={containerVariants}
        >
          {leads.map((lead, index) => (
            <motion.div
              key={lead.id}
              transition={
                shouldReduceMotion ? { duration: 0 } : undefined
              }
              variants={rowVariants}
            >
              <div
                className={cn(
                  "group relative grid cursor-pointer grid-cols-7 gap-4 px-6 py-2 transition-colors",
                    isSelected(lead.id)
                    ? "bg-[var(--yu3-wine-tint)]"
                    : "hover:bg-muted/30",
                  index < leads.length - 1 && "border-border/20 border-b"
                )}
                onMouseEnter={() => {
                  setHoveredAction(lead.id)
                }}
                onMouseLeave={() => {
                  setHoveredAction(null)
                }}
              >
                <div className="flex items-center gap-3">
                  <input
                    aria-label={`Select ${lead.name}`}
                    checked={isSelected(lead.id)}
                    className="bg-background text-muted-foreground focus:ring-muted-foreground/20 accent-muted-foreground h-4 w-4 rounded border-muted-foreground/40 focus:ring-2"
                    onChange={(e) => {
                      e.stopPropagation()
                      handleLeadSelection(lead.id, e.target.checked)
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                    type="checkbox"
                  />
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="border-border/20 bg-muted/30 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border">
                      <span className="text-muted-foreground/80 text-sm font-medium">
                        {lead.name.charAt(0)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-foreground/90 truncate font-medium">
                        {lead.name}
                      </div>
                      <div className="text-muted-foreground/70 truncate text-xs">
                        {lead.email}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center">
                  {getSourcePill(lead.source, lead.sourceType)}
                </div>

                <div className="flex items-center">
                  {getStatusPill(lead.status)}
                </div>

                <div className="flex items-center">
                  <span className="text-foreground/90 font-semibold">
                    {formatCurrency(lead.size)}
                  </span>
                </div>

                <div className="flex items-center">
                  {renderSparkline(lead.interest)}
                </div>

                <div className="flex items-center">
                  {getProbabilityIcon(lead.probability)}
                </div>

                <div className="flex items-center">
                  <AnimatePresence mode="wait">
                    {hoveredAction === lead.id ? (
                      <motion.button
                        animate={
                          shouldReduceMotion
                            ? { opacity: 1 }
                            : { opacity: 1, x: 0, filter: "blur(0px)" }
                        }
                        className="text-primary border-primary/30 bg-primary/10 hover:bg-primary/20 flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1 text-xs font-medium shadow-sm transition-all duration-200 hover:shadow-md"
                        exit={
                          shouldReduceMotion
                            ? { opacity: 0 }
                            : { opacity: 0, x: -10, filter: "blur(4px)" }
                        }
                        initial={
                          shouldReduceMotion
                            ? { opacity: 0 }
                            : { opacity: 0, x: -10, filter: "blur(4px)" }
                        }
                        onClick={() => {
                          handleLeadAction(lead.id, "engage")
                        }}
                        transition={
                          shouldReduceMotion
                            ? { duration: 0.1 }
                            : { type: "spring", stiffness: 500, damping: 25 }
                        }
                        type="button"
                      >
                        Engage
                        <div
                          aria-hidden
                          className="bg-primary/30 mx-1 h-3 w-px"
                        />
                        <MoreHorizontal aria-hidden className="h-3 w-3" />
                      </motion.button>
                    ) : (
                      <motion.span
                        animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                        className="text-muted-foreground/70 text-xs"
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 10 }}
                        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 10 }}
                        transition={{ duration: shouldReduceMotion ? 0 : 0.05 }}
                      >
                        {lead.lastAction}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <AnimatePresence>
        {selectedLeads.size > 0 ? (
          <motion.div
            animate={
              shouldReduceMotion
                ? { y: 0, opacity: 1 }
                : { y: 0, opacity: 1, filter: "blur(0px)" }
            }
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform"
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { y: 100, opacity: 0, filter: "blur(8px)" }
            }
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { y: 100, opacity: 0, filter: "blur(8px)" }
            }
            transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
          >
            <div className="bg-background/95 border-border/50 flex items-center gap-4 rounded-xl border px-4 py-2 shadow-2xl backdrop-blur-lg">
              <span className="text-foreground/80 text-xs font-medium">
                {selectedLeads.size} selected leads
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  onClick={() => {
                    handleBulk("engage")
                  }}
                  type="button"
                >
                  Engage
                </button>
                <button
                  className="bg-muted text-foreground/80 hover:bg-muted/80 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  onClick={() => {
                    handleBulk("createGroup")
                  }}
                  type="button"
                >
                  Create group
                </button>
                <button
                  className="bg-muted text-foreground/80 hover:bg-muted/80 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  onClick={() => {
                    handleBulk("downloadCsv")
                  }}
                  type="button"
                >
                  Download as .CSV
                </button>
                <button
                  className="border-(--yu3-line) bg-(--yu3-danger-tint) text-(--yu3-danger) hover:opacity-90 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                  onClick={() => {
                    handleBulk("delete")
                  }}
                  type="button"
                >
                  Delete leads
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
