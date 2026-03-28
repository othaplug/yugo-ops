import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const logPath = path.join(process.cwd(), ".cursor", "debug-a968d1.log");
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, JSON.stringify({ ...body, serverTimestamp: Date.now() }) + "\n");
  } catch {}
  return NextResponse.json({ ok: true });
}
