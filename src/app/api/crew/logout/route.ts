import { NextRequest, NextResponse } from "next/server";
import { CREW_COOKIE_NAME } from "@/lib/crew-token";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/crew/login", req.url));
  res.cookies.set(CREW_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
