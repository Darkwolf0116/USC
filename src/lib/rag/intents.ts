import { normalize } from "@/lib/search";
import { contentWords, wordsMatch } from "./text";
import type { AssistantAction } from "./types";

export interface IntentCatalog {
  categories: Array<{ slug: string; name: string }>;
  posters: Array<{ slug: string; title: string }>;
}

const POLITE_PREFIX =
  /^(?:por favor[ ,]*)?(?:(?:me )?(?:puedes|podrias|podria|quiero|quisiera|necesito|deseo)[ ,]+)?(?:por favor[ ,]*)?/;
const SEARCH_VERB = /^(?:buscar|busca|buscame|buscanos|encuentra|encuentrame)\s+(.+)$/;
const GO_VERB = /^(?:llevame|lleva|llevanos|ir|ve|vamos|navega|dirigeme)\s+(?:a|al|hacia|hasta)\s+(.+)$/;
const OPEN_VERB = /^(?:abre|abrir|abreme|muestrame|muestra|mostrar|ver|ensename|ensenar)\s+(.+)$/;

const CATEGORY_HINT = /\b(?:categoria|categorias|seccion|pestana|area)\b/g;
const POSTER_HINT = /\b(?:poster|posters|pdf|proyecto|proyectos|documento|articulo)\b/g;
const FILLER = /\b(?:el|la|los|las|un|una|de|del|sobre|acerca|que|se|llama|llamado|titulado)\b/g;

interface Match<T> {
  item: T;
  coverage: number;
  score: number;
}

function scoreName(queryWords: string[], name: string): { coverage: number; score: number; matched: number } {
  const nameWords = contentWords(name);
  if (queryWords.length === 0 || nameWords.length === 0) return { coverage: 0, score: 0, matched: 0 };
  const matched = queryWords.filter((q) => nameWords.some((w) => wordsMatch(q, w))).length;
  const covered = nameWords.filter((w) => queryWords.some((q) => wordsMatch(q, w))).length;
  const coverage = matched / queryWords.length;
  return { coverage, score: coverage + 0.25 * (covered / nameWords.length), matched };
}

function ranked<T>(
  queryWords: string[],
  items: T[],
  nameOf: (item: T) => string,
  minMatched: number,
  minCoverage: number,
): Array<Match<T>> {
  return items
    .map((item) => ({ item, ...scoreName(queryWords, nameOf(item)) }))
    .filter((m) => m.matched >= minMatched && m.coverage >= minCoverage)
    .sort((a, b) => b.score - a.score);
}

/**
 * Deterministic router for navigation commands ("llévame a…", "abre…", "buscar…").
 * Returns null for anything that looks like a question, so it goes through retrieval.
 */
export function detectIntent(input: string, catalog: IntentCatalog): AssistantAction | null {
  const text = normalize(input)
    .replace(/[¿?¡!.,;:"“”]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(POLITE_PREFIX, "")
    .trim();
  if (!text) return null;

  const search = SEARCH_VERB.exec(text);
  if (search) {
    const query = search[1]
      .replace(POSTER_HINT, " ")
      .replace(FILLER, " ")
      .replace(/\s+/g, " ")
      .trim();
    return query ? { type: "search", query } : null;
  }

  const go = GO_VERB.exec(text);
  const open = go ? null : OPEN_VERB.exec(text);
  const rest = (go ?? open)?.[1];
  if (!rest) return null;

  const categoryHint = new RegExp(CATEGORY_HINT.source).test(rest);
  const posterHint = new RegExp(POSTER_HINT.source).test(rest);
  const cleaned = rest.replace(CATEGORY_HINT, " ").replace(POSTER_HINT, " ");
  const queryWords = contentWords(cleaned);
  if (queryWords.length === 0) return null;

  const categories = ranked(queryWords, catalog.categories, (c) => c.name, 1, 1);
  const posters = ranked(queryWords, catalog.posters, (p) => p.title, queryWords.length > 1 ? 2 : 1, 0.6);

  const bestCategory = categories[0];
  const bestPoster = posters[0];
  const posterIsUnique =
    bestPoster !== undefined &&
    (posters.length === 1 || posters[1].score < bestPoster.score - 0.05) &&
    (queryWords.length > 1 || posterHint);

  if (categoryHint && bestCategory) return { type: "selectCategory", slug: bestCategory.item.slug };
  if (posterHint && bestPoster) {
    return posterIsUnique
      ? { type: "openPoster", slug: bestPoster.item.slug }
      : { type: "search", query: queryWords.join(" ") };
  }
  if (bestCategory && posterIsUnique) {
    const preferPoster = bestPoster.score > bestCategory.score || (bestPoster.score === bestCategory.score && !go);
    return preferPoster
      ? { type: "openPoster", slug: bestPoster.item.slug }
      : { type: "selectCategory", slug: bestCategory.item.slug };
  }
  if (posterIsUnique && bestPoster) return { type: "openPoster", slug: bestPoster.item.slug };
  if (bestCategory) return { type: "selectCategory", slug: bestCategory.item.slug };
  return null;
}
