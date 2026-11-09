export const ACCESS_PATH = "/acceso";

/**
 * Accepts only same-origin relative paths for the post-login redirect,
 * so `?next=` can never send the user to another site.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  if (next === ACCESS_PATH || next.startsWith(`${ACCESS_PATH}?`) || next.startsWith(`${ACCESS_PATH}/`)) {
    return "/";
  }
  return next;
}
