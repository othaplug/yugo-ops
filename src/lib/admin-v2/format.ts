// Shared formatters for admin-v2 modules. Every page imports from here
// so currency, percents, and dates render consistently.

export const formatCurrencyCompact = (value: number): string => {
  if (Math.abs(value) >= 1_000_000) {
    const formatted = (value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)
    return `$${formatted.replace(/\.0+$/, "")}M`
  }
  if (Math.abs(value) >= 1_000) {
    const formatted = (value / 1_000).toFixed(value >= 10_000 ? 0 : 1)
    return `$${formatted.replace(/\.0$/, "")}K`
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)

export const formatNumber = (value: number): string =>
  new Intl.NumberFormat("en-US").format(value)

export const formatPercent = (value: number, precision = 0): string =>
  `${value.toFixed(precision)}%`

export const formatShortDate = (iso: string): string => {
  const date = new Date(iso)
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

export const formatTimeOfDay = (iso: string): string => {
  const date = new Date(iso)
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

export const formatRelativeDays = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / (24 * 60 * 60 * 1000))
  if (days < 1) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export const formatInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase()
}
