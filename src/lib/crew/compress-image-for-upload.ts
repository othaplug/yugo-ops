/**
 * Downscale and re-encode crew job photos before upload so POST bodies stay under
 * typical host limits (e.g. Vercel ~4.5MB) and JSON error responses are not replaced
 * by plain-text 413 pages that break `response.json()`.
 */

const MAX_LONG_EDGE_PX = 2048
const JPEG_QUALITY = 0.82
/** Skip work for already-small files */
const SKIP_BELOW_BYTES = 512 * 1024

const canUseDom = () =>
  typeof document !== "undefined" && typeof createImageBitmap === "function"

export const compressImageFileForCrewUpload = async (file: File): Promise<File> => {
  if (!file.type.startsWith("image/")) return file
  if (file.size <= SKIP_BELOW_BYTES) return file
  if (!canUseDom()) return file

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  const { width, height } = bitmap
  if (width < 1 || height < 1) {
    bitmap.close()
    return file
  }

  const longEdge = Math.max(width, height)
  let outW = width
  let outH = height
  if (longEdge > MAX_LONG_EDGE_PX) {
    const scale = MAX_LONG_EDGE_PX / longEdge
    outW = Math.max(1, Math.round(width * scale))
    outH = Math.max(1, Math.round(height * scale))
  }

  const canvas = document.createElement("canvas")
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    bitmap.close()
    return file
  }
  ctx.drawImage(bitmap, 0, 0, outW, outH)
  bitmap.close()

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size >= file.size) {
          resolve(file)
          return
        }
        const base = file.name.replace(/\.[^.]+$/, "") || "photo"
        resolve(
          new File([blob], `${base}.jpg`, {
            type: "image/jpeg",
            lastModified: Date.now(),
          }),
        )
      },
      "image/jpeg",
      JPEG_QUALITY,
    )
  })
}
