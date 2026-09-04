import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
async function main() {
  const { getTodayString } = await import("@/lib/business-timezone");
  const buggy = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric", month: "2-digit", day: "numeric",
  });
  const canonical = getTodayString();
  console.log("BUGGY (toLocaleDateString):", JSON.stringify(buggy));
  console.log("CANONICAL (getTodayString):", JSON.stringify(canonical));
  console.log('compare "2026-09-05" <', JSON.stringify(buggy), "→", "2026-09-05" < buggy);
  console.log('compare "2026-09-05" <', JSON.stringify(canonical), "→", "2026-09-05" < canonical);
}
main();
