import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_PATH, safeNextPath } from "@/lib/auth/redirect";
import { ACCESS_COOKIE, isVisitorId } from "@/lib/auth/session";

const ACCESS_API_PATH = "/api/access";

/** Paths reachable without access: the access page, its API and the logo it shows. */
function isPublicPath(pathname: string): boolean {
  return pathname === ACCESS_PATH || pathname === ACCESS_API_PATH || pathname.startsWith("/Info/");
}

/** `path` is same-origin and may carry its own query (it comes from `safeNextPath`). */
function redirectTo(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin));
}

/**
 * Gates the whole site (page, PDFs, RAG index) behind the access cookie that
 * `POST /api/access` sets after registering the visit in Supabase.
 * Trust-based: the email is not verified (see supabase/README.md).
 */
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasAccess = isVisitorId(request.cookies.get(ACCESS_COOKIE)?.value);

  if (pathname === ACCESS_PATH) {
    if (hasAccess) {
      return redirectTo(request, safeNextPath(request.nextUrl.searchParams.get("next")));
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname) || hasAccess) return NextResponse.next();

  const next = safeNextPath(`${pathname}${search}`);
  return redirectTo(request, `${ACCESS_PATH}?next=${encodeURIComponent(next)}`);
}

export const config = {
  // Everything except Next internals and the favicon, so PDFs and /rag are protected too.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
