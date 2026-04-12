import fs from "fs";
import path from "path";

/**
 * Load Yugo wordmark PNG as a data URI for jsPDF (server-only).
 */
export function loadYugoLogoDataUriForPdf(): string {
  const dir = path.join(process.cwd(), "public", "images");
  for (const name of ["yugo-logo-wine.png", "yugo-logo-black.png"] as const) {
    try {
      const logoPath = path.join(dir, name);
      const base64 = fs.readFileSync(logoPath, { encoding: "base64" });
      return `data:image/png;base64,${base64}`;
    } catch {
      /* try next */
    }
  }
  return "";
}
