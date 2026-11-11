"use client";

import { useEffect, useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { MAX_COMMENT_LENGTH, type PosterComment } from "@/lib/comments";
import { useReactions } from "./ReactionsProvider";

interface CommentsPanelProps {
  id: string;
  variant: "card" | "viewer";
  posterKey: string;
  title: string;
  open: boolean;
}

const dateFormat = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short" });
const relativeFormat = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

/** "hace 5 minutos"; the full date goes in the tooltip. */
function relativeDate(iso: string, now: number): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "hace un momento";
  if (abs < 3600) return relativeFormat.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relativeFormat.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 30) return relativeFormat.format(Math.round(seconds / 86400), "day");
  if (abs < 86400 * 365) return relativeFormat.format(Math.round(seconds / (86400 * 30)), "month");
  return relativeFormat.format(Math.round(seconds / (86400 * 365)), "year");
}

function CommentItem({ comment, now }: { comment: PosterComment; now: number }) {
  return (
    <li className="comment">
      <p className="comment__meta">
        <strong className="comment__author">{comment.author}</strong>
        <time className="comment__date" dateTime={comment.createdAt} title={dateFormat.format(new Date(comment.createdAt))}>
          {relativeDate(comment.createdAt, now)}
        </time>
      </p>
      {/* Rendered as text (never HTML); `white-space: pre-wrap` keeps the author's line breaks. */}
      <p className="comment__body">{comment.body}</p>
    </li>
  );
}

/** The comments of one poster: a list, plus a form to add one. Hidden until the toggle opens it. */
export function CommentsPanel({ id, variant, posterKey, title, open }: CommentsPanelProps) {
  const { comments, actions } = useReactions();
  const entry = comments.lists[posterKey];
  const status = entry?.status ?? "idle";
  const items = entry?.items ?? [];
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const fieldId = useId();
  const counterId = `${fieldId}-count`;

  // Load on open (and refresh on each reopen); the relative dates are recomputed at the same time.
  const { loadComments } = actions;
  useEffect(() => {
    if (!open) return;
    void loadComments(posterKey).then(() => setNow(Date.now()));
  }, [open, posterKey, loadComments]);

  const length = text.trim().length;
  const tooLong = length > MAX_COMMENT_LENGTH;
  const canSubmit = status === "ready" && !sending && length > 0 && !tooLong;

  const submit = async () => {
    if (!canSubmit) return;
    setSending(true);
    setError(null);
    const result = await actions.addComment(posterKey, text.trim());
    setSending(false);
    if (result.ok) {
      setText("");
      setNow(Date.now());
    } else {
      setError(result.message);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <section id={id} className={`comments comments--${variant}`} aria-label={`Comentarios de ${title}`} hidden={!open}>
      {open ? (
        <>
          {status === "loading" || (status === "idle" && items.length === 0) ? (
            <p className="comments__state" role="status">
              Cargando comentarios…
            </p>
          ) : null}
          {status === "error" ? (
            <div className="comments__state comments__state--error" role="alert">
              <p>No pudimos cargar los comentarios.</p>
              <button type="button" className="btn btn--secondary" onClick={() => void loadComments(posterKey)}>
                Reintentar
              </button>
            </div>
          ) : null}
          {status === "ready" && items.length === 0 ? <p className="comments__state">Sé el primero en comentar</p> : null}
          {items.length > 0 ? (
            <ul className="comments__list" aria-label="Lista de comentarios">
              {items.map((comment) => (
                <CommentItem key={comment.id} comment={comment} now={now} />
              ))}
            </ul>
          ) : null}

          <form className="comments__form" onSubmit={handleSubmit}>
            <label className="comments__label" htmlFor={fieldId}>
              Escribe un comentario
            </label>
            <textarea
              id={fieldId}
              className="comments__field"
              rows={3}
              value={text}
              aria-describedby={counterId}
              aria-invalid={tooLong}
              onChange={(event) => {
                setText(event.target.value);
                if (error) setError(null);
              }}
              onKeyDown={handleKeyDown}
            />
            <div className="comments__footer">
              <span id={counterId} className={`comments__counter${tooLong ? " comments__counter--over" : ""}`}>
                {length}/{MAX_COMMENT_LENGTH}
              </span>
              <button type="submit" className="btn btn--primary comments__submit" disabled={!canSubmit}>
                {sending ? "Publicando…" : "Publicar"}
              </button>
            </div>
            {tooLong ? (
              <p className="comments__error" role="alert">
                El comentario no puede superar {MAX_COMMENT_LENGTH} caracteres.
              </p>
            ) : null}
            {error ? (
              <p className="comments__error" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </>
      ) : null}
    </section>
  );
}
