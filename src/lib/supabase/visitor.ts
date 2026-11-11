import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, VISITOR_NAME_COOKIE, isVisitorId } from "@/lib/auth/session";
import type { SupabaseEnv } from "@/lib/supabase/env";

/** `visitor_not_found`: the access cookie names a visitor Supabase does not know; the cookies were cleared. */
export type VisitorErrorCode = "visitor_not_found";

/** Postgres `check_violation`, raised by the SQL functions for invalid input. */
export const CHECK_VIOLATION = "23514";

const UNKNOWN_VISITOR_MESSAGE = "Visitante no valido";
const DEFAULT_STALE_MESSAGE = "Tu sesión expiró. Vuelve a ingresar para reaccionar.";

/** JSON response that must never be cached (everything here depends on the visitor). */
export function json<T>(body: T, status: number): NextResponse<T> {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function newClient(env: SupabaseEnv) {
  return createClient(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The visitor id in the access cookie, or null when it is missing or malformed. */
export function visitorIdOf(request: NextRequest): string | null {
  const value = request.cookies.get(ACCESS_COOKIE)?.value;
  return value && isVisitorId(value) ? value : null;
}

/** True only for the error the SQL functions raise when the visitor row does not exist. */
export function isUnknownVisitorError(error: { code?: string; message?: string }): boolean {
  return error.code === CHECK_VIOLATION && (error.message ?? "").includes(UNKNOWN_VISITOR_MESSAGE);
}

/** 401 that also signs the browser out, so the next visit registers a fresh visitor. */
export function staleVisitorResponse<
  T extends { ok: boolean; message?: string; code?: VisitorErrorCode },
>(message: string = DEFAULT_STALE_MESSAGE): NextResponse<T> {
  const response = json({ ok: false, code: "visitor_not_found", message } as T, 401);
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(VISITOR_NAME_COOKIE);
  return response;
}
