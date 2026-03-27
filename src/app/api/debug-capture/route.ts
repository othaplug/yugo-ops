import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * Local-only debug sink used during development. Disabled in production.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const body = await req.json();
    const logPath = path.join(process.cwd(), ".cursor", "debug-a968d1.log");
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, JSON.stringify({ ...body, serverTimestamp: Date.now() }) + "\n");
  } catch {
    // ignore
  }
  return NextResponse.json({ ok: true });
}
