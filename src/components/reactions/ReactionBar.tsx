"use client";

import { useId, useState } from "react";
import { REACTIONS, emptyCounts } from "@/lib/reactions";
import { CommentsPanel } from "./CommentsPanel";
import { ReactionsNotice } from "./ReactionsNotice";
import { useReactions } from "./ReactionsProvider";

interface ReactionBarProps {
  /** `card` sits under a poster card; `viewer` sits in the PDF viewer. */
  variant: "card" | "viewer";
  /** Key of the poster, `eje-N/<slug>` (see `posterKey`). */
  posterKey: string;
  title: string;
}

/** Two reaction buttons and a comments toggle in one row; the comments panel opens below it. */
export function ReactionBar({ variant, posterKey, title }: ReactionBarProps) {
  const { state, comments, actions, meta } = useReactions();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const commentCount = comments.counts[posterKey] ?? 0;
  const counts = state.counts[posterKey] ?? emptyCounts();
  const mine = state.mine[posterKey] ?? null;
  const notice = meta.notice;
  // Save errors show under the bar that failed; the expired-session notice is shown once, floating,
  // and repeated here only inside the viewer, which covers the page behind it.
  const showNotice =
    notice !== null && (notice.kind === "error" ? notice.posterKey === posterKey : variant === "viewer");

  return (
    <div className={`reactions-wrap reactions-wrap--${variant}`}>
      <div className={`reactions reactions--${variant}`} data-status={meta.status}>
        <div className="reactions__group" role="group" aria-label={`Reacciones a ${title}`}>
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
        <button
          type="button"
          className="comments-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`Comentarios, ${commentCount}`}
          data-comments-toggle
          onClick={() => setOpen((value) => !value)}
        >
          <span className="reaction__emoji" aria-hidden="true">
            💬
          </span>
          <span aria-hidden="true" className="comments-toggle__label">
            Comentarios
          </span>
          <span className="comments-toggle__count" aria-hidden="true">
            ({commentCount})
          </span>
        </button>
      </div>
      {showNotice ? <ReactionsNotice notice={notice} /> : null}
      <CommentsPanel id={panelId} variant={variant} posterKey={posterKey} title={title} open={open} />
    </div>
  );
}
