"use client";

import { REACTIONS, emptyCounts } from "@/lib/reactions";
import { useReactions } from "./ReactionsProvider";

interface ReactionBarProps {
  /** `card` sits under a poster card; `viewer` sits in the PDF viewer. */
  variant: "card" | "viewer";
  /** Key of the poster, `eje-N/<slug>` (see `posterKey`). */
  posterKey: string;
  title: string;
}

/** Four reaction buttons with their totals; the visitor's own choice is pressed. */
export function ReactionBar({ variant, posterKey, title }: ReactionBarProps) {
  const { state, actions, meta } = useReactions();
  const counts = state.counts[posterKey] ?? emptyCounts();
  const mine = state.mine[posterKey] ?? null;

  return (
    <div
      className={`reactions reactions--${variant}`}
      role="group"
      aria-label={`Reacciones a ${title}`}
      data-status={meta.status}
    >
      {REACTIONS.map((reaction) => {
        const count = counts[reaction.key];
        return (
          <button
            key={reaction.key}
            type="button"
            className="reaction"
            aria-pressed={mine === reaction.key}
            aria-label={`${reaction.label}, ${count} ${count === 1 ? "reacción" : "reacciones"}`}
            title={reaction.label}
            data-reaction={reaction.key}
            disabled={meta.status !== "ready"}
            onClick={() => void actions.react(posterKey, reaction.key)}
          >
            <span className="reaction__emoji" aria-hidden="true">
              {reaction.emoji}
            </span>
            <span className="reaction__count" aria-hidden="true">
              {count > 0 ? count : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
