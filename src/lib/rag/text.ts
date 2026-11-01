import { normalize } from "@/lib/search";

const STOPWORDS = new Set(
  (
    "a al algo algun alguna algunas alguno algunos ante aqui asi aun cada como con contra cual cuales cuando de del desde donde " +
    "e el ella ellas ello ellos en entre era eran es esa esas ese eso esos esta estan estas este esto estos fue ha hay hasta " +
    "la las le les lo los me mi mis mas muy ni no nos o os otra otro para pero poco por porque que quien quienes se sea sean si " +
    "sido sin sobre son su sus te tiene tienen tu tus un una unas uno unos y ya yo " +
    "dime digame cuentame quiero necesito puedo puedes puede podria podrias existe existen"
  ).split(" "),
);

const TOKEN_SPLIT = /[^\p{L}\p{N}]+/u;

/** Very light Spanish stemming: plural "s"/"es" so "marchas" and "marcha" meet. */
function stem(term: string): string {
  if (term.length > 5 && term.endsWith("es")) return term.slice(0, -2);
  if (term.length > 4 && term.endsWith("s")) return term.slice(0, -1);
  return term;
}

/** Lowercase, accent-free, stopword-free, stemmed tokens. Shared by indexing and querying. */
export function tokenize(text: string): string[] {
  return normalize(text)
    .split(TOKEN_SPLIT)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))
    .map(stem);
}

/** Normalized (not stemmed) query words worth highlighting in a snippet. */
export function highlightTerms(query: string): string[] {
  const terms = normalize(query)
    .split(TOKEN_SPLIT)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
  return Array.from(new Set(terms));
}

/** Normalized words without stopwords or stemming, for matching names. */
export function contentWords(text: string): string[] {
  return normalize(text)
    .split(TOKEN_SPLIT)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

/** True when two words share a stem or a long common prefix ("practica" / "practicas"). */
export function wordsMatch(a: string, b: string): boolean {
  if (stem(a) === stem(b)) return true;
  const shortest = Math.min(a.length, b.length);
  return shortest >= 5 && (a.startsWith(b) || b.startsWith(a));
}
