import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { generateInstallPhotoReport } from "@/lib/designer-projects/photo-report";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { id: projectId } = await params;

  try {
    await generateInstallPhotoReport(projectId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to send photo report";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
