"use client";

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ReactionsNotice } from "./ReactionsNotice";
import type { ReactionsGetResponse, ReactionsPostResponse } from "@/app/api/reactions/route";
import { emptyCounts, type ReactionCounts, type ReactionKey } from "@/lib/reactions";

export type ReactionsStatus = "loading" | "ready" | "error";

export interface ReactionsState {
  /** Totals per poster key; posters nobody reacted to are absent. */
  counts: Record<string, ReactionCounts>;
  /** The visitor's own reaction per poster key. */
  mine: Record<string, ReactionKey>;
}

export interface ReactionsActions {
  /** Picks `reaction` for the poster; picking the current one removes it, another one switches. */
  react: (posterKey: string, reaction: ReactionKey) => Promise<void>;
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
  const stateRef = useRef(state);
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

  const value = useMemo<ReactionsContextValue>(
    () => ({
      state,
      actions: { react },
      meta: { status, notice, announcement },
    }),
    [state, react, status, notice, announcement],
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
