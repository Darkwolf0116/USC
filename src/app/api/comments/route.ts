import type { NextRequest } from "next/server";
import { normalizeComment, type PosterComment } from "@/lib/comments";
import { isKnownPosterKey } from "@/lib/reactions";
import { getSupabaseEnv } from "@/lib/supabase/env";
import {
  CHECK_VIOLATION,
  isUnknownVisitorError,
  json,
  newClient,
  staleVisitorResponse,
  visitorIdOf,
  type VisitorErrorCode,
} from "@/lib/supabase/visitor";

export interface CommentsGetResponse {
  ok: boolean;
  /** Newest first. */
  comments?: PosterComment[];
  message?: string;
  code?: VisitorErrorCode;
}

export interface CommentsPostResponse {
  ok: boolean;
  comment?: PosterComment;
  message?: string;
  code?: VisitorErrorCode;
}

/** Custom SQLSTATE `add_poster_comment` raises for the anti-spam limit (see the migration). */
const RATE_LIMITED = "P0429";
const STALE_MESSAGE = "Tu sesión expiró. Vuelve a ingresar para comentar.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toComment(value: unknown): PosterComment | null {
  if (!isRecord(value)) return null;
  const { id, body, created_at: createdAt, author } = value;
  if (
    typeof id !== "number" ||
    typeof body !== "string" ||
    typeof createdAt !== "string" ||
    typeof author !== "string"
  ) {
    return null;
  }
  return { id, body, createdAt, author };
}

/** Comments of one poster, newest first. */
export async function GET(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return json<CommentsGetResponse>({ ok: false, message: "Los comentarios no están configurados." }, 503);

  const poster = request.nextUrl.searchParams.get("poster");
  if (!isKnownPosterKey(poster)) return json<CommentsGetResponse>({ ok: false, message: "Documento no válido." }, 400);

  if (!visitorIdOf(request)) {
    return json<CommentsGetResponse>({ ok: false, message: "Necesitas ingresar para ver los comentarios." }, 401);
  }

  const { data, error } = await newClient(env).rpc("get_poster_comments", { p_poster_key: poster });
  if (error) {
    console.error("get_poster_comments failed", error.code, error.message);
    return json<CommentsGetResponse>({ ok: false, message: "No pudimos cargar los comentarios." }, 502);
  }
  if (!Array.isArray(data)) {
    console.error("get_poster_comments returned an unexpected value");
    return json<CommentsGetResponse>({ ok: false, message: "No pudimos cargar los comentarios." }, 502);
  }
  const comments = data.map(toComment).filter((comment): comment is PosterComment => comment !== null);
  return json<CommentsGetResponse>({ ok: true, comments }, 200);
}

/** Adds a comment from the visitor identified by the access cookie. */
export async function POST(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return json<CommentsPostResponse>({ ok: false, message: "Los comentarios no están configurados." }, 503);

  let poster: unknown;
  let rawBody: unknown;
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) throw new Error("body is not an object");
    poster = body.poster;
    rawBody = body.body;
  } catch {
    return json<CommentsPostResponse>({ ok: false, message: "Solicitud no válida." }, 400);
  }
  if (!isKnownPosterKey(poster)) return json<CommentsPostResponse>({ ok: false, message: "Documento no válido." }, 400);
  const text = normalizeComment(rawBody);
  if (text === null) {
    return json<CommentsPostResponse>(
      { ok: false, message: "El comentario debe tener entre 1 y 500 caracteres." },
      400,
    );
  }

  const visitorId = visitorIdOf(request);
  if (!visitorId) return json<CommentsPostResponse>({ ok: false, message: "Necesitas ingresar para comentar." }, 401);

  const { data, error } = await newClient(env).rpc("add_poster_comment", {
    p_visitor_id: visitorId,
    p_poster_key: poster,
    p_body: text,
  });
  if (error) {
    console.error("add_poster_comment failed", error.code, error.message);
    if (isUnknownVisitorError(error)) return staleVisitorResponse<CommentsPostResponse>(STALE_MESSAGE);
    if (error.code === RATE_LIMITED) {
      return json<CommentsPostResponse>(
        { ok: false, message: "Espera unos segundos antes de volver a comentar." },
        429,
      );
    }
    if (error.code === CHECK_VIOLATION) return json<CommentsPostResponse>({ ok: false, message: "Solicitud no válida." }, 400);
    return json<CommentsPostResponse>({ ok: false, message: "No pudimos publicar tu comentario." }, 502);
  }
  const comment = toComment(data);
  if (!comment) {
    console.error("add_poster_comment returned an unexpected value");
    return json<CommentsPostResponse>({ ok: false, message: "No pudimos publicar tu comentario." }, 502);
  }
  return json<CommentsPostResponse>({ ok: true, comment }, 201);
}
