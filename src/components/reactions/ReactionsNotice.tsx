"use client";

import { ACCESS_PATH, safeNextPath } from "@/lib/auth/redirect";
import type { ReactionsNotice as Notice } from "./ReactionsProvider";

interface ReactionsNoticeProps {
  notice: Notice;
  /** Pinned to the bottom of the screen instead of sitting under a bar. */
  floating?: boolean;
}

/** Visible message about a failed reaction; an expired session offers a link to sign in again. */
export function ReactionsNotice({ notice, floating = false }: ReactionsNoticeProps) {
  // Notices only exist after a client-side request, so `window` is always defined here.
  const next = safeNextPath(`${window.location.pathname}${window.location.search}`);
  const href = `${ACCESS_PATH}?next=${encodeURIComponent(next)}`;

  return (
    <div
      className={`reactions-notice reactions-notice--${notice.kind}${floating ? " reactions-notice--floating" : ""}`}
      data-notice={notice.kind}
    >
      <p className="reactions-notice__text">{notice.message}</p>
      {notice.kind === "expired" ? (
        <a className="btn btn--primary reactions-notice__action" href={href}>
          Ingresar de nuevo
        </a>
      ) : null}
    </div>
  );
}
