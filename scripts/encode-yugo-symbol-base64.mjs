#!/usr/bin/env node
/**
 * Writes src/lib/yugo-symbol-png-base64.ts from public/yugo-symbol.png
 * (keeps PDF watermark in sync with the public asset).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pngPath = path.join(root, "public", "yugo-symbol.png");
const outPath = path.join(root, "src", "lib", "yugo-symbol-png-base64.ts");

const b64 = fs.readFileSync(pngPath).toString("base64");
const chunk = 100;
const lines = [];
for (let i = 0; i < b64.length; i += chunk) {
  lines.push(`  "${b64.slice(i, i + chunk)}"`);
}
const body = lines.join(" +\n");
const ts = `/**
 * Raw base64 PNG for jsPDF addImage (no data: image/png prefix).
 * Regenerate from public/yugo-symbol.png after changing that asset:
 *   node scripts/encode-yugo-symbol-base64.mjs
 */
export const YUGO_SYMBOL_PNG_BASE64 =
${body};
`;
fs.writeFileSync(outPath, ts);
console.log("Wrote", outPath, `(${b64.length} chars base64)`);
