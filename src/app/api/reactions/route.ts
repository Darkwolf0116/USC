import type { NextRequest } from "next/server";
import { isKnownPosterKey, isReactionKey, type ReactionCounts, type ReactionKey } from "@/lib/reactions";
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

export interface ReactionsGetResponse {
  ok: boolean;
  /** Totals per poster key; posters without reactions are absent. */
  counts?: Record<string, ReactionCounts>;
  /** The visitor's own reaction per poster key. */
  mine?: Record<string, ReactionKey>;
  /** Number of comments per poster key; posters without comments are absent. */
  comments?: Record<string, number>;
  message?: string;
  /** `visitor_not_found`: the access cookie names a visitor Supabase does not know; the cookies were cleared. */
  code?: VisitorErrorCode;
}

export interface ReactionsPostResponse {
  ok: boolean;
  poster?: string;
  counts?: ReactionCounts;
  message?: string;
  code?: VisitorErrorCode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toCounts(value: unknown): ReactionCounts | null {
  if (!isRecord(value)) return null;
  const read = (key: ReactionKey) => (typeof value[key] === "number" ? value[key] : 0);
  return {
    love: read("love"),
    clap: read("clap"),
  };
}

/** Totals per poster plus the reactions of the visitor identified by the access cookie. */
export async function GET(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return json<ReactionsGetResponse>({ ok: false, message: "Las reacciones no están configuradas." }, 503);

  const visitorId = visitorIdOf(request);
  if (!visitorId) {
    return json<ReactionsGetResponse>({ ok: false, message: "Necesitas ingresar para ver las reacciones." }, 401);
  }

  const { data, error } = await newClient(env).rpc("get_poster_reactions", {
    p_visitor_id: visitorId,
  });
  if (error) {
    console.error("get_poster_reactions failed", error.code, error.message);
    if (isUnknownVisitorError(error)) return staleVisitorResponse<ReactionsGetResponse>();
    return json<ReactionsGetResponse>({ ok: false, message: "No pudimos cargar las reacciones." }, 502);
  }
  if (!isRecord(data) || !isRecord(data.counts) || !isRecord(data.mine)) {
    console.error("get_poster_reactions returned an unexpected value");
    return json<ReactionsGetResponse>({ ok: false, message: "No pudimos cargar las reacciones." }, 502);
  }
  // Only an explicit `false` proves the visitor is gone; a missing field (migration not applied yet) is unknown.
  if (data.visitor === false) {
    console.error("get_poster_reactions: visitor not found for the access cookie");
    return staleVisitorResponse<ReactionsGetResponse>();
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
  const comments: Record<string, number> = {};
  // `comments` is absent until the comments migration is applied; treat that as no comments.
  if (isRecord(data.comments)) {
    for (const [key, value] of Object.entries(data.comments)) {
      if (typeof value === "number") comments[key] = value;
    }
  }
  return json<ReactionsGetResponse>({ ok: true, counts, mine, comments }, 200);
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
  if (!isKnownPosterKey(poster))
    return json<ReactionsPostResponse>({ ok: false, message: "Documento no válido." }, 400);
  if (reaction !== null && !isReactionKey(reaction)) {
    return json<ReactionsPostResponse>({ ok: false, message: "Reacción no válida." }, 400);
  }

  const visitorId = visitorIdOf(request);
  if (!visitorId)
    return json<ReactionsPostResponse>({ ok: false, message: "Necesitas ingresar para reaccionar." }, 401);

  const { data, error } = await newClient(env).rpc("set_poster_reaction", {
    p_visitor_id: visitorId,
    p_poster_key: poster,
    p_reaction: reaction,
  });
  if (error) {
    console.error("set_poster_reaction failed", error.code, error.message);
    if (isUnknownVisitorError(error)) return staleVisitorResponse<ReactionsPostResponse>();
    if (error.code === CHECK_VIOLATION)
      return json<ReactionsPostResponse>({ ok: false, message: "Solicitud no válida." }, 400);
    return json<ReactionsPostResponse>({ ok: false, message: "No pudimos guardar tu reacción." }, 502);
  }
  const counts = toCounts(data);
  if (!counts) {
    console.error("set_poster_reaction returned an unexpected value");
    return json<ReactionsPostResponse>({ ok: false, message: "No pudimos guardar tu reacción." }, 502);
  }
  return json<ReactionsPostResponse>({ ok: true, poster, counts }, 200);
}
