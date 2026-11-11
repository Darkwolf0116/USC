import { categories } from "@/data/catalog";

export type ReactionKey = "love" | "clap";

export interface ReactionDefinition {
  key: ReactionKey;
  emoji: string;
  label: string;
}

/** Display order. Emoji are used by explicit request instead of SVG icons. */
export const REACTIONS: readonly ReactionDefinition[] = [
  { key: "love", emoji: "❤️", label: "Me encanta" },
  { key: "clap", emoji: "👏", label: "Aplausos" },
];

export type ReactionCounts = Record<ReactionKey, number>;

export function emptyCounts(): ReactionCounts {
  return { love: 0, clap: 0 };
}

export function isReactionKey(value: unknown): value is ReactionKey {
  return typeof value === "string" && REACTIONS.some((reaction) => reaction.key === value);
}

/** Poster identity: the slug is only unique inside its axis, so the key includes the axis. */
export function posterKey(categorySlug: string, posterSlug: string): string {
  return `${categorySlug}/${posterSlug}`;
}

const KNOWN_KEYS = new Set(
  categories.flatMap((category) =>
    category.posters.map((poster) => posterKey(category.slug, poster.slug)),
  ),
);

export function isKnownPosterKey(value: unknown): value is string {
  return typeof value === "string" && KNOWN_KEYS.has(value);
}
