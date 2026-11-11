import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, isVisitorId } from "@/lib/auth/session";
import {
  isKnownPosterKey,
  isReactionKey,
  type ReactionCounts,
  type ReactionKey,
} from "@/lib/reactions";
import { getSupabaseEnv, type SupabaseEnv } from "@/lib/supabase/env";

export interface ReactionsGetResponse {
  ok: boolean;
  /** Totals per poster key; posters without reactions are absent. */
  counts?: Record<string, ReactionCounts>;
  /** The visitor's own reaction per poster key. */
  mine?: Record<string, ReactionKey>;
  message?: string;
}

export interface ReactionsPostResponse {
  ok: boolean;
  poster?: string;
  counts?: ReactionCounts;
  message?: string;
}

const CHECK_VIOLATION = "23514";

function json<T>(body: T, status: number): NextResponse<T> {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function visitorIdOf(request: NextRequest): string | null {
  const value = request.cookies.get(ACCESS_COOKIE)?.value;
  return value && isVisitorId(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toCounts(value: unknown): ReactionCounts | null {
  if (!isRecord(value)) return null;
  const read = (key: ReactionKey) => (typeof value[key] === "number" ? value[key] : 0);
  return { love: read("love"), clap: read("clap"), insight: read("insight"), inspire: read("inspire") };
}

function newClient(env: SupabaseEnv) {
  return createClient(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Totals per poster plus the reactions of the visitor identified by the access cookie. */
export async function GET(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return json<ReactionsGetResponse>({ ok: false, message: "Las reacciones no están configuradas." }, 503);

  const visitorId = visitorIdOf(request);
  if (!visitorId) {
    return json<ReactionsGetResponse>({ ok: false, message: "Necesitas ingresar para ver las reacciones." }, 401);
  }

  const { data, error } = await newClient(env).rpc("get_poster_reactions", { p_visitor_id: visitorId });
  if (error || !isRecord(data) || !isRecord(data.counts) || !isRecord(data.mine)) {
    console.error("get_poster_reactions failed", error?.code, error?.message);
    return json<ReactionsGetResponse>({ ok: false, message: "No pudimos cargar las reacciones." }, 502);
  }

  const counts: Record<string, ReactionCounts> = {};
  for (const [key, value] of Object.entries(data.counts)) {
    const parsed = toCounts(value);
    if (parsed) counts[key] = parsed;
  }
  const mine: Record<string, ReactionKey> = {};
  for (const [key, value] of Object.entries(data.mine)) {
    if (isReactionKey(value)) mine[key] = value;
  }
  return json<ReactionsGetResponse>({ ok: true, counts, mine }, 200);
}

/** Sets, switches or (with `reaction: null`) removes the visitor's reaction to one poster. */
export async function POST(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return json<ReactionsPostResponse>({ ok: false, message: "Las reacciones no están configuradas." }, 503);

  let poster: unknown;
  let reaction: unknown;
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) throw new Error("body is not an object");
    poster = body.poster;
    reaction = body.reaction;
  } catch {
    return json<ReactionsPostResponse>({ ok: false, message: "Solicitud no válida." }, 400);
  }
  if (!isKnownPosterKey(poster)) return json<ReactionsPostResponse>({ ok: false, message: "Documento no válido." }, 400);
  if (reaction !== null && !isReactionKey(reaction)) {
    return json<ReactionsPostResponse>({ ok: false, message: "Reacción no válida." }, 400);
  }

  const visitorId = visitorIdOf(request);
  if (!visitorId) return json<ReactionsPostResponse>({ ok: false, message: "Necesitas ingresar para reaccionar." }, 401);

  const { data, error } = await newClient(env).rpc("set_poster_reaction", {
    p_visitor_id: visitorId,
    p_poster_key: poster,
    p_reaction: reaction,
  });
  if (error) {
    if (error.code === CHECK_VIOLATION) return json<ReactionsPostResponse>({ ok: false, message: "Solicitud no válida." }, 400);
    console.error("set_poster_reaction failed", error.code, error.message);
    return json<ReactionsPostResponse>({ ok: false, message: "No pudimos guardar tu reacción." }, 502);
  }
  const counts = toCounts(data);
  if (!counts) {
    console.error("set_poster_reaction returned an unexpected value");
    return json<ReactionsPostResponse>({ ok: false, message: "No pudimos guardar tu reacción." }, 502);
  }
  return json<ReactionsPostResponse>({ ok: true, poster, counts }, 200);
}
