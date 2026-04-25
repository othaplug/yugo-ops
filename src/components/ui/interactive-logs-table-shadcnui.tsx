"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Check, ChevronDown, Filter, Search } from "lucide-react"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type LogLevel = "info" | "warning" | "error"

export interface Log {
  id: string
  timestamp: string
  level: LogLevel
  service: string
  message: string
  duration: string
  status: string
  tags: string[]
}

type Filters = {
  level: string[]
  service: string[]
  status: string[]
}

export const SAMPLE_LOGS: Log[] = [
  {
    id: "1",
    timestamp: "2024-11-08T14:32:45Z",
    level: "info",
    service: "api-gateway",
    message: "Request processed successfully",
    duration: "245ms",
    status: "200",
    tags: ["api", "success"],
  },
  {
    id: "2",
    timestamp: "2024-11-08T14:32:42Z",
    level: "warning",
    service: "cache-service",
    message: "Cache miss ratio exceeds threshold",
    duration: "1.2s",
    status: "warning",
    tags: ["cache", "performance"],
  },
  {
    id: "3",
    timestamp: "2024-11-08T14:32:40Z",
    level: "error",
    service: "database",
    message: "Connection timeout to replica",
    duration: "5.1s",
    status: "503",
    tags: ["db", "error"],
  },
  {
    id: "4",
    timestamp: "2024-11-08T14:32:38Z",
    level: "info",
    service: "auth-service",
    message: "User session created",
    duration: "156ms",
    status: "201",
    tags: ["auth", "session"],
  },
  {
    id: "5",
    timestamp: "2024-11-08T14:32:35Z",
    level: "info",
    service: "api-gateway",
    message: "Webhook delivered",
    duration: "432ms",
    status: "200",
    tags: ["webhook", "integration"],
  },
  {
    id: "6",
    timestamp: "2024-11-08T14:32:32Z",
    level: "error",
    service: "payment-service",
    message: "Payment gateway unavailable",
    duration: "2.3s",
    status: "502",
    tags: ["payment", "error"],
  },
  {
    id: "7",
    timestamp: "2024-11-08T14:32:30Z",
    level: "info",
    service: "search-service",
    message: "Index updated",
    duration: "876ms",
    status: "200",
    tags: ["search", "index"],
  },
  {
    id: "8",
    timestamp: "2024-11-08T14:32:28Z",
    level: "warning",
    service: "api-gateway",
    message: "Rate limit approaching",
    duration: "145ms",
    status: "429",
    tags: ["rate-limit", "warning"],
  },
]

const levelStyles: Record<LogLevel, string> = {
  info: "bg-[var(--yu3-info-tint)] text-[var(--yu3-info)]",
  warning: "bg-[var(--yu3-warning-tint)] text-[var(--yu3-warning)]",
  error: "bg-[var(--yu3-danger-tint)] text-[var(--yu3-danger)]",
}

const statusStyles: Record<string, string> = {
  "200": "text-[var(--yu3-success)]",
  "201": "text-[var(--yu3-success)]",
  "429": "text-[var(--yu3-warning)]",
  "502": "text-[var(--yu3-danger)]",
  "503": "text-[var(--yu3-danger)]",
  warning: "text-[var(--yu3-warning)]",
}

const LogRow = ({
  log,
  expanded,
  onToggle,
  reduceMotion,
}: {
  log: Log
  expanded: boolean
  onToggle: () => void
  reduceMotion: boolean
}) => {
  const formattedTime = new Date(log.timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  return (
    <>
      <motion.button
        className="hover:bg-muted/50 active:bg-muted/70 w-full p-4 text-left transition-colors"
        onClick={onToggle}
        type="button"
        whileHover={reduceMotion ? undefined : { y: 0.5 }}
        whileTap={reduceMotion ? undefined : { scale: 0.99 }}
      >
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            className="shrink-0"
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
          >
            <ChevronDown
              aria-hidden
              className="text-muted-foreground h-4 w-4"
            />
          </motion.div>
          <Badge
            className={cn("shrink-0 capitalize", levelStyles[log.level])}
            variant="secondary"
          >
            {log.level}
          </Badge>
          <time
            className="text-muted-foreground w-20 shrink-0 font-mono text-xs"
            dateTime={log.timestamp}
          >
            {formattedTime}
          </time>
          <span className="text-foreground min-w-max shrink-0 text-sm font-medium">
            {log.service}
          </span>
          <p className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
            {log.message}
          </p>
          <span
            className={cn(
              "shrink-0 font-mono text-sm font-semibold",
              statusStyles[log.status] ?? "text-muted-foreground"
            )}
          >
            {log.status}
          </span>
          <span className="text-muted-foreground w-16 shrink-0 text-right font-mono text-xs">
            {log.duration}
          </span>
        </div>
      </motion.button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="details"
            animate={reduceMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            className="bg-muted/50 border-border border-t overflow-hidden"
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0.12 } : { duration: 0.2 }}
          >
            <div className="space-y-4 p-4">
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                  Message
                </p>
                <p className="text-foreground bg-background rounded p-3 font-mono text-sm">
                  {log.message}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                    Duration
                  </p>
                  <p className="text-foreground font-mono">{log.duration}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
                    Timestamp
                  </p>
                  <p className="text-foreground font-mono text-xs">{log.timestamp}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                  Tags
                </p>
                <div className="flex flex-wrap gap-2">
                  {log.tags.map((tag) => (
                    <Badge key={tag} className="text-xs" variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}

const FilterPanel = ({
  filters,
  onChange,
  logs,
  reduceMotion,
}: {
  filters: Filters
  onChange: (next: Filters) => void
  logs: Log[]
  reduceMotion: boolean
}) => {
  const levels = Array.from(new Set(logs.map((l) => l.level)))
  const services = Array.from(new Set(logs.map((l) => l.service)))
  const statuses = Array.from(new Set(logs.map((l) => l.status)))

  const toggleFilter = (category: keyof Filters, value: string) => {
    const current = filters[category]
    const updated = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value]
    onChange({
      ...filters,
      [category]: updated,
    })
  }

  const clearAll = () => {
    onChange({ level: [], service: [], status: [] })
  }

  const hasActiveFilters = Object.values(filters).some(
    (group) => group.length > 0
  )

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="bg-card flex h-full w-[280px] min-w-0 flex-col space-y-6 overflow-y-auto p-4"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      transition={reduceMotion ? { duration: 0.12 } : { delay: 0.05 }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-foreground text-sm font-semibold">Filters</h3>
        {hasActiveFilters ? (
          <Button
            className="h-6 text-xs"
            onClick={clearAll}
            size="sm"
            type="button"
            variant="ghost"
          >
            Clear
          </Button>
        ) : null}
      </div>
      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Level
        </p>
        <div className="space-y-2">
          {levels.map((level) => {
            const selected = filters.level.includes(level)
            return (
              <motion.button
                key={level}
                aria-pressed={selected}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/40"
                )}
                onClick={() => {
                  toggleFilter("level", level)
                }}
                type="button"
                whileHover={reduceMotion ? undefined : { x: 2 }}
              >
                <span className="capitalize">{level}</span>
                {selected ? (
                  <Check aria-hidden className="h-3.5 w-3.5" />
                ) : null}
              </motion.button>
            )
          })}
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Service
        </p>
        <div className="space-y-2">
          {services.map((service) => {
            const selected = filters.service.includes(service)
            return (
              <motion.button
                key={service}
                aria-pressed={selected}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/40"
                )}
                onClick={() => {
                  toggleFilter("service", service)
                }}
                type="button"
                whileHover={reduceMotion ? undefined : { x: 2 }}
              >
                <span>{service}</span>
                {selected ? (
                  <Check aria-hidden className="h-3.5 w-3.5" />
                ) : null}
              </motion.button>
            )
          })}
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Status
        </p>
        <div className="space-y-2">
          {statuses.map((status) => {
            const selected = filters.status.includes(status)
            return (
              <motion.button
                key={status}
                aria-pressed={selected}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/40"
                )}
                onClick={() => {
                  toggleFilter("status", status)
                }}
                type="button"
                whileHover={reduceMotion ? undefined : { x: 2 }}
              >
                <span>{status}</span>
                {selected ? (
                  <Check aria-hidden className="h-3.5 w-3.5" />
                ) : null}
              </motion.button>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}

export interface InteractiveLogsTableProps {
  className?: string
  /** Defaults to the bundled sample set */
  logs?: Log[]
}

export const InteractiveLogsTable = ({
  className,
  logs: logsProp = SAMPLE_LOGS,
}: InteractiveLogsTableProps) => {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Filters>({
    level: [],
    service: [],
    status: [],
  })
  const shouldReduceMotion = useReducedMotion()
  const reduceMotion = Boolean(shouldReduceMotion)

  const data = logsProp

  const filteredLogs = useMemo(() => {
    return data.filter((log) => {
      const lowerQuery = searchQuery.toLowerCase()
      const matchSearch =
        log.message.toLowerCase().includes(lowerQuery) ||
        log.service.toLowerCase().includes(lowerQuery)
      const matchLevel =
        filters.level.length === 0 || filters.level.includes(log.level)
      const matchService =
        filters.service.length === 0 ||
        filters.service.includes(log.service)
      const matchStatus =
        filters.status.length === 0 || filters.status.includes(log.status)
      return matchSearch && matchLevel && matchService && matchStatus
    })
  }, [data, filters, searchQuery])

  const activeFilters =
    filters.level.length + filters.service.length + filters.status.length

  return (
    <div
      className={cn(
        "bg-background flex h-full min-h-0 w-full flex-1 flex-col",
        className
      )}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-border bg-card border-b p-6">
          <div className="space-y-4">
            <div>
              <h1 className="text-foreground text-2xl font-semibold">Logs</h1>
              <p className="text-muted-foreground text-sm">
                {filteredLogs.length} of {data.length} logs
              </p>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  aria-hidden
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                />
                <Input
                  aria-label="Search logs by message or service"
                  className="h-9 pl-9 text-sm"
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                  }}
                  placeholder="Search logs by message or service..."
                  value={searchQuery}
                />
              </div>
              <Button
                aria-expanded={showFilters}
                aria-label="Toggle filter panel"
                className="relative"
                onClick={() => {
                  setShowFilters((c) => !c)
                }}
                size="sm"
                type="button"
                variant={showFilters ? "default" : "outline"}
              >
                <Filter className="h-4 w-4" />
                {activeFilters > 0 ? (
                  <Badge
                    className="bg-destructive absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center p-0 text-xs"
                  >
                    {activeFilters}
                  </Badge>
                ) : null}
              </Button>
            </div>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <AnimatePresence initial={false}>
            {showFilters ? (
              <motion.div
                key="filters"
                animate={reduceMotion ? { opacity: 1, width: 280 } : { width: 280, opacity: 1 }}
                className="border-border overflow-hidden border-r"
                exit={reduceMotion ? { width: 0, opacity: 0 } : { width: 0, opacity: 0 }}
                initial={reduceMotion ? { width: 0, opacity: 0 } : { width: 0, opacity: 0 }}
                transition={reduceMotion ? { duration: 0.12 } : { duration: 0.2 }}
              >
                <FilterPanel
                  filters={filters}
                  logs={data}
                  onChange={setFilters}
                  reduceMotion={reduceMotion}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="divide-border divide-y">
              <AnimatePresence mode="popLayout">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log, index) => (
                    <motion.div
                      key={log.id}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      initial={{ opacity: 0, y: -10 }}
                      transition={
                        reduceMotion
                          ? { duration: 0.12 }
                          : { duration: 0.2, delay: index * 0.02 }
                      }
                    >
                      <LogRow
                        log={log}
                        expanded={expandedId === log.id}
                        onToggle={() => {
                          setExpandedId((c) => (c === log.id ? null : log.id))
                        }}
                        reduceMotion={reduceMotion}
                      />
                    </motion.div>
                  ))
                ) : (
                  <motion.div
                    key="empty-state"
                    animate={{ opacity: 1 }}
                    className="p-12 text-center"
                    initial={{ opacity: 0 }}
                  >
                    <p className="text-muted-foreground">
                      No logs match your filters.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
