"use client";

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ReactionsNotice } from "./ReactionsNotice";
import type { CommentsGetResponse, CommentsPostResponse } from "@/app/api/comments/route";
import type { ReactionsGetResponse, ReactionsPostResponse } from "@/app/api/reactions/route";
import type { PosterComment } from "@/lib/comments";
import { emptyCounts, type ReactionCounts, type ReactionKey } from "@/lib/reactions";

export type ReactionsStatus = "loading" | "ready" | "error";

export interface ReactionsState {
  /** Totals per poster key; posters nobody reacted to are absent. */
  counts: Record<string, ReactionCounts>;
  /** The visitor's own reaction per poster key. */
  mine: Record<string, ReactionKey>;
}

export type CommentsStatus = "idle" | "loading" | "ready" | "error";

/** Comments of one poster, loaded the first time its panel is opened. */
export interface CommentsEntry {
  status: CommentsStatus;
  /** Newest first. */
  items: PosterComment[];
}

export type AddCommentResult = { ok: true } | { ok: false; message: string };

export interface CommentsState {
  /** Number of comments per poster key; posters without comments are absent. */
  counts: Record<string, number>;
  lists: Record<string, CommentsEntry>;
}

export interface ReactionsActions {
  /** Picks `reaction` for the poster; picking the current one removes it, another one switches. */
  react: (posterKey: string, reaction: ReactionKey) => Promise<void>;
  /** Loads (or refreshes) the comments of a poster; the list in `state.comments` updates when it arrives. */
  loadComments: (posterKey: string) => Promise<void>;
  /** Publishes a comment; on success it is inserted at the top of the poster's list. */
  addComment: (posterKey: string, body: string) => Promise<AddCommentResult>;
}

/** A visible message about a failed load or save. */
export interface ReactionsNotice {
  /** `expired`: the access cookie is stale and the person must sign in again; `error`: a transient failure. */
  kind: "expired" | "error";
  message: string;
  /** Poster whose save failed; null when the failure is not tied to one poster. */
  posterKey: string | null;
}

export interface ReactionsMeta {
  status: ReactionsStatus;
  notice: ReactionsNotice | null;
  /** Text of the polite live region. */
  announcement: string;
}

export interface ReactionsContextValue {
  state: ReactionsState;
  comments: CommentsState;
  actions: ReactionsActions;
  meta: ReactionsMeta;
}

const ReactionsContext = createContext<ReactionsContextValue | null>(null);

export function useReactions(): ReactionsContextValue {
  const value = use(ReactionsContext);
  if (!value) throw new Error("useReactions must be used inside <ReactionsProvider>.");
  return value;
}

/** Counts after moving the visitor from `from` to `to` (either may be null). */
function shiftCounts(
  current: ReactionCounts | undefined,
  from: ReactionKey | null,
  to: ReactionKey | null,
): ReactionCounts {
  const next = { ...(current ?? emptyCounts()) };
  if (from) next[from] = Math.max(0, next[from] - 1);
  if (to) next[to] += 1;
  return next;
}

/** Loads the totals once and keeps them in sync with optimistic updates. */
export function ReactionsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ReactionsState>({ counts: {}, mine: {} });
  const [status, setStatus] = useState<ReactionsStatus>("loading");
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState<ReactionsNotice | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [commentLists, setCommentLists] = useState<Record<string, CommentsEntry>>({});
  const stateRef = useRef(state);
  /** Bumped by every published comment, so a list fetched before it cannot overwrite it. */
  const commentVersionRef = useRef(new Map<string, number>());
  const loadingCommentsRef = useRef(new Set<string>());
  const postingCommentRef = useRef(false);
  const pendingRef = useRef(new Set<string>());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // A transient error disappears on its own; the "sign in again" notice stays until the person acts.
  useEffect(() => {
    if (notice?.kind !== "error") return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const expire = useCallback((message: string) => {
    setNotice({ kind: "expired", message, posterKey: null });
    setAnnouncement(message);
    setStatus("error");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch("/api/reactions", {
          signal: controller.signal,
          cache: "no-store",
        });
        const body = (await response.json()) as ReactionsGetResponse;
        if (body.code === "visitor_not_found") {
          expire(body.message ?? "Tu sesión expiró. Vuelve a ingresar para reaccionar.");
          return;
        }
        if (!response.ok || !body.ok) throw new Error("load failed");
        setState({ counts: body.counts ?? {}, mine: body.mine ?? {} });
        setCommentCounts(body.comments ?? {});
        setStatus("ready");
      } catch {
        if (controller.signal.aborted) return;
        setStatus("error");
        setAnnouncement("No pudimos cargar las reacciones.");
      }
    })();
    return () => controller.abort();
  }, [expire]);

  const react = useCallback(
    async (posterKey: string, reaction: ReactionKey) => {
      // One request per poster at a time keeps the optimistic state and the server in order.
      if (pendingRef.current.has(posterKey)) return;
      pendingRef.current.add(posterKey);
      setNotice(null);

      const before = stateRef.current;
      const previous = before.mine[posterKey] ?? null;
      const next = previous === reaction ? null : reaction;

      const mine = { ...before.mine };
      if (next) mine[posterKey] = next;
      else delete mine[posterKey];
      const optimistic: ReactionsState = {
        counts: {
          ...before.counts,
          [posterKey]: shiftCounts(before.counts[posterKey], previous, next),
        },
        mine,
      };
      stateRef.current = optimistic;
      setState(optimistic);

      const revert = () =>
        setState((current) => {
          const restored = { ...current.mine };
          if (previous) restored[posterKey] = previous;
          else delete restored[posterKey];
          return {
            counts: {
              ...current.counts,
              [posterKey]: before.counts[posterKey] ?? emptyCounts(),
            },
            mine: restored,
          };
        });

      try {
        const response = await fetch("/api/reactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ poster: posterKey, reaction: next }),
        });
        const body = (await response.json()) as ReactionsPostResponse;
        if (body.code === "visitor_not_found") {
          revert();
          expire(body.message ?? "Tu sesión expiró. Vuelve a ingresar para reaccionar.");
          return;
        }
        if (!response.ok || !body.ok || !body.counts) throw new Error("save failed");
        const serverCounts = body.counts;
        setState((current) => ({
          ...current,
          counts: { ...current.counts, [posterKey]: serverCounts },
        }));
        setAnnouncement(next ? "Reacción guardada." : "Reacción quitada.");
      } catch {
        revert();
        const message = "No pudimos guardar tu reacción. Inténtalo de nuevo.";
        setNotice({ kind: "error", message, posterKey });
        setAnnouncement(message);
      } finally {
        pendingRef.current.delete(posterKey);
      }
    },
    [expire],
  );

  const loadComments = useCallback(
    async (posterKey: string) => {
      if (loadingCommentsRef.current.has(posterKey)) return;
      loadingCommentsRef.current.add(posterKey);
      const version = commentVersionRef.current.get(posterKey) ?? 0;
      // Keep showing what we have while refreshing; only the first load shows a loading state.
      setCommentLists((current) => {
        const entry = current[posterKey];
        if (entry && entry.status === "ready") return current;
        return { ...current, [posterKey]: { status: "loading", items: entry?.items ?? [] } };
      });
      try {
        const response = await fetch(`/api/comments?poster=${encodeURIComponent(posterKey)}`, {
          cache: "no-store",
        });
        const body = (await response.json()) as CommentsGetResponse;
        if (body.code === "visitor_not_found") {
          setCommentLists((current) => ({ ...current, [posterKey]: { status: "idle", items: [] } }));
          expire(body.message ?? "Tu sesión expiró. Vuelve a ingresar para comentar.");
          return;
        }
        if (!response.ok || !body.ok || !body.comments) throw new Error("load failed");
        const items = body.comments;
        if ((commentVersionRef.current.get(posterKey) ?? 0) === version) {
          setCommentLists((current) => ({ ...current, [posterKey]: { status: "ready", items } }));
          // The list is capped at 200; below the cap its length is the exact total.
          if (items.length < 200) setCommentCounts((current) => ({ ...current, [posterKey]: items.length }));
        }
      } catch {
        setCommentLists((current) => {
          const entry = current[posterKey];
          // A refresh that fails keeps the list already shown.
          if (entry?.status === "ready") return current;
          return { ...current, [posterKey]: { status: "error", items: entry?.items ?? [] } };
        });
      } finally {
        loadingCommentsRef.current.delete(posterKey);
      }
    },
    [expire],
  );

  const addComment = useCallback(
    async (posterKey: string, text: string): Promise<AddCommentResult> => {
      if (postingCommentRef.current) return { ok: false, message: "Tu comentario ya se está publicando." };
      postingCommentRef.current = true;
      try {
        const response = await fetch("/api/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ poster: posterKey, body: text }),
        });
        const body = (await response.json()) as CommentsPostResponse;
        if (body.code === "visitor_not_found") {
          const message = body.message ?? "Tu sesión expiró. Vuelve a ingresar para comentar.";
          expire(message);
          return { ok: false, message };
        }
        if (!response.ok || !body.ok || !body.comment) {
          return { ok: false, message: body.message ?? "No pudimos publicar tu comentario. Inténtalo de nuevo." };
        }
        const comment = body.comment;
        commentVersionRef.current.set(posterKey, (commentVersionRef.current.get(posterKey) ?? 0) + 1);
        setCommentLists((current) => ({
          ...current,
          [posterKey]: { status: "ready", items: [comment, ...(current[posterKey]?.items ?? [])] },
        }));
        setCommentCounts((current) => ({ ...current, [posterKey]: (current[posterKey] ?? 0) + 1 }));
        setAnnouncement("Comentario publicado.");
        return { ok: true };
      } catch {
        return { ok: false, message: "No pudimos publicar tu comentario. Inténtalo de nuevo." };
      } finally {
        postingCommentRef.current = false;
      }
    },
    [expire],
  );

  const comments = useMemo<CommentsState>(
    () => ({ counts: commentCounts, lists: commentLists }),
    [commentCounts, commentLists],
  );

  const value = useMemo<ReactionsContextValue>(
    () => ({
      state,
      comments,
      actions: { react, loadComments, addComment },
      meta: { status, notice, announcement },
    }),
    [state, comments, react, loadComments, addComment, status, notice, announcement],
  );

  return (
    <ReactionsContext value={value}>
      {children}
      {notice?.kind === "expired" ? <ReactionsNotice notice={notice} floating /> : null}
      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </ReactionsContext>
  );
}
