/**
 * Generate and trigger a browser CSV download.
 * @param headers - Column header names
 * @param rows    - Array of arrays (values are coerced to string, commas/quotes escaped)
 * @param filename - Suggested filename (without extension)
 */
export function downloadCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
  filename: string,
): void {
  const escape = (v: string | number | null | undefined): string => {
    const s = v === null || v === undefined ? "" : String(v)
    // Wrap in quotes if value contains comma, newline, or double-quote
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const lines = [headers, ...rows].map((row) => row.map(escape).join(","))
  const csv = lines.join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
