export const ACCESS_PATH = "/acceso";

const PROBE_ORIGIN = "http://same-origin.invalid";
// Browsers strip tabs/newlines and treat "\" as "/" while parsing, so "/\t/evil.com" means "//evil.com".
const UNSAFE_CHARACTERS = /[\u0000-\u001f\u007f\\]/;

/**
 * Accepts only same-origin relative paths for the post-login redirect,
 * so `?next=` can never send the user to another site.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || UNSAFE_CHARACTERS.test(next)) {
    return "/";
  }

  let url: URL;
  try {
    url = new URL(next, PROBE_ORIGIN);
  } catch {
    return "/";
  }
  if (url.origin !== PROBE_ORIGIN || url.pathname === ACCESS_PATH || url.pathname.startsWith(`${ACCESS_PATH}/`)) {
    return "/";
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
