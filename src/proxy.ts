import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isInstitutionalEmail } from "@/lib/auth/email";
import { ACCESS_PATH, safeNextPath } from "@/lib/auth/redirect";
import { getSupabaseEnv } from "@/lib/supabase/env";

/** Paths reachable without a session: the access page and the logo it shows. */
function isPublicPath(pathname: string): boolean {
  return pathname === ACCESS_PATH || pathname.startsWith("/Info/");
}

/** `path` is same-origin and may carry its own query (it comes from `safeNextPath`). */
function redirectTo(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin));
}

/**
 * Gates the whole site (page, PDFs, RAG index) behind a Supabase session whose
 * email is institutional. Fails closed: without configuration nobody gets in.
 */
export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  let response = NextResponse.next({ request });

  const env = getSupabaseEnv();
  let email: string | null = null;

  if (env) {
    const supabase = createServerClient(env.url, env.publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    });

    // getClaims validates the JWT; never trust getSession() for authorization.
    const { data } = await supabase.auth.getClaims();
    const claimedEmail = data?.claims?.email;
    email = typeof claimedEmail === "string" ? claimedEmail : null;
  }

  const authorized = isInstitutionalEmail(email);

  if (pathname === ACCESS_PATH) {
    if (authorized) {
      return redirectTo(request, safeNextPath(request.nextUrl.searchParams.get("next")));
    }
    return response;
  }

  if (isPublicPath(pathname)) return response;

  if (!authorized) {
    const next = safeNextPath(`${pathname}${search}`);
    return redirectTo(request, `${ACCESS_PATH}?next=${encodeURIComponent(next)}`);
  }

  return response;
}

export const config = {
  // Everything except Next internals and the favicon, so PDFs and /rag are protected too.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
