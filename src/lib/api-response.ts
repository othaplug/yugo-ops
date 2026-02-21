import { NextResponse } from "next/server";

/** Standard API error response */
export function apiError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Standard API success response */
export function apiSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}
