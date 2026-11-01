import { normalize } from "@/lib/search";

/** A window of about `length` characters around the first match of any term. */
export function makeSnippet(text: string, terms: string[], length = 200): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= length) return clean;
  const haystack = normalize(clean);
  let at = -1;
  for (const term of terms) {
    const found = haystack.indexOf(term);
    if (found !== -1 && (at === -1 || found < at)) at = found;
  }
  let start = at === -1 ? 0 : Math.max(0, at - Math.floor(length / 4));
  if (start > 0) {
    const space = clean.indexOf(" ", start);
    if (space !== -1 && space - start < 20) start = space + 1;
  }
  let end = Math.min(clean.length, start + length);
  if (end < clean.length) {
    const space = clean.lastIndexOf(" ", end);
    if (space > start + length * 0.6) end = space;
  }
  return `${start > 0 ? "…" : ""}${clean.slice(start, end).trim()}${end < clean.length ? "…" : ""}`;
}
