/** Longest comment, in characters, after trimming. Mirrors the check in `add_poster_comment`. */
export const MAX_COMMENT_LENGTH = 500;

export interface PosterComment {
  id: number;
  /** Full name the visitor typed when signing in. Never an e-mail address. */
  author: string;
  body: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

/** Trimmed comment text, or null when it is empty or longer than `MAX_COMMENT_LENGTH`. */
export function normalizeComment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length >= 1 && text.length <= MAX_COMMENT_LENGTH ? text : null;
}
