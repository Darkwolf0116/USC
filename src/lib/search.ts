import type { Category, Poster } from "@/data/types";

/** Lowercase text without diacritics, so "Análisis" matches "analisis". */
export function normalize(input: string): string {
  return input.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

interface NormalizedWithMap {
  text: string;
  /** For each character of `text`, where it starts in the original string. */
  starts: number[];
  /** For each character of `text`, where it ends in the original string. */
  ends: number[];
}

function normalizeWithMap(input: string): NormalizedWithMap {
  let text = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  for (const char of input) {
    const piece = normalize(char);
    for (let i = 0; i < piece.length; i += 1) {
      starts.push(offset);
      ends.push(offset + char.length);
    }
    text += piece;
    offset += char.length;
  }
  return { text, starts, ends };
}

/** Splits a raw query into unique, normalized terms. */
export function parseQuery(query: string): string[] {
  const terms = normalize(query)
    .split(/\s+/)
    .filter((term) => term.length > 0);
  return Array.from(new Set(terms));
}

export interface HighlightSegment {
  text: string;
  match: boolean;
}

/** Splits `text` into segments, flagging the parts that match any term. */
export function highlightSegments(text: string, terms: string[]): HighlightSegment[] {
  if (terms.length === 0) return [{ text, match: false }];
  const { text: normalized, starts, ends } = normalizeWithMap(text);
  const ranges: Array<[number, number]> = [];
  for (const term of terms) {
    let from = 0;
    while (from <= normalized.length - term.length) {
      const at = normalized.indexOf(term, from);
      if (at === -1) break;
      ranges.push([starts[at], ends[at + term.length - 1]]);
      from = at + Math.max(term.length, 1);
    }
  }
  if (ranges.length === 0) return [{ text, match: false }];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) {
      last[1] = Math.max(last[1], range[1]);
    } else {
      merged.push([range[0], range[1]]);
    }
  }

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), match: false });
    segments.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
  return segments;
}

export interface SearchGroup {
  category: Category;
  posters: Poster[];
}

export interface SearchOutcome {
  groups: SearchGroup[];
  count: number;
}

function haystack(poster: Poster, category: Category): string {
  return normalize(
    [poster.title, ...poster.students, poster.advisor, category.name].join(" "),
  );
}

/** Finds posters whose title, students, advisor or category name contain every term. */
export function searchCatalog(categories: Category[], query: string): SearchOutcome {
  const terms = parseQuery(query);
  if (terms.length === 0) return { groups: [], count: 0 };

  const groups: SearchGroup[] = [];
  let count = 0;
  for (const category of categories) {
    const posters = category.posters.filter((poster) => {
      const text = haystack(poster, category);
      return terms.every((term) => text.includes(term));
    });
    if (posters.length > 0) {
      groups.push({ category, posters });
      count += posters.length;
    }
  }
  return { groups, count };
}
