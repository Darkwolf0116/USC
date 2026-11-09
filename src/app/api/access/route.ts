import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  normalizeEmail,
  normalizeFullName,
  validateAccessForm,
  type AccessFormErrors,
} from "@/lib/auth/email";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE_SECONDS,
  VISITOR_NAME_COOKIE,
  firstNameOf,
  isVisitorId,
} from "@/lib/auth/session";
import { getSupabaseEnv } from "@/lib/supabase/env";

export interface AccessResponseBody {
  ok: boolean;
  firstName?: string;
  errors?: AccessFormErrors;
  message?: string;
}

const CHECK_VIOLATION = "23514";

function json(body: AccessResponseBody, status: number): NextResponse<AccessResponseBody> {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Registers the visit in Supabase and, only if that succeeds, grants access with a cookie. */
export async function POST(request: Request) {
  const env = getSupabaseEnv();
  if (!env) {
    return json({ ok: false, message: "El acceso no está configurado. Falta definir las variables de Supabase del sitio." }, 503);
  }

  let fullName = "";
  let email = "";
  try {
    const body = (await request.json()) as { fullName?: unknown; email?: unknown };
    fullName = typeof body.fullName === "string" ? body.fullName : "";
    email = typeof body.email === "string" ? body.email : "";
  } catch {
    return json({ ok: false, message: "Solicitud no válida." }, 400);
  }

  const errors = validateAccessForm(fullName, email);
  if (errors.fullName || errors.email) return json({ ok: false, errors }, 400);

  const name = normalizeFullName(fullName);
  const supabase = createClient(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("register_visit", {
    p_full_name: name,
    p_email: normalizeEmail(email),
    p_user_agent: request.headers.get("user-agent"),
  });

  if (error) {
    if (error.code === CHECK_VIOLATION) {
      const field = /usc\.edu\.co/i.test(error.message) ? "email" : "fullName";
      return json(
        {
          ok: false,
          errors: field === "email"
            ? { email: "Solo se permiten correos @usc.edu.co." }
            : { fullName: "Escribe tu nombre y apellido, solo con letras." },
        },
        400,
      );
    }
    console.error("register_visit failed", error.code, error.message);
    return json({ ok: false, message: "No pudimos registrar tu ingreso. Inténtalo de nuevo en unos segundos." }, 502);
  }

  if (!isVisitorId(typeof data === "string" ? data : null)) {
    console.error("register_visit returned an unexpected value");
    return json({ ok: false, message: "No pudimos registrar tu ingreso. Inténtalo de nuevo en unos segundos." }, 502);
  }

  const firstName = firstNameOf(name);
  const response = json({ ok: true, firstName }, 200);
  const secure = new URL(request.url).protocol === "https:";
  response.cookies.set(ACCESS_COOKIE, data as string, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE_SECONDS,
  });
  response.cookies.set(VISITOR_NAME_COOKIE, encodeURIComponent(firstName), {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE_SECONDS,
  });
  return response;
}

/** Signs the visitor out by clearing both cookies. */
export async function DELETE() {
  const response = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(VISITOR_NAME_COOKIE);
  return response;
}
