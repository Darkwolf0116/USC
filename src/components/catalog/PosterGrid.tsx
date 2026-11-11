import type { Poster } from "@/data/types";
import { PosterCard } from "./PosterCard";

interface PosterGridProps {
  posters: Poster[];
  categorySlug: string;
  terms?: string[];
}

export function PosterGrid({ posters, categorySlug, terms }: PosterGridProps) {
  return (
    <ul className="poster-grid">
      {posters.map((poster) => (
        <li key={poster.slug}>
          <PosterCard poster={poster} categorySlug={categorySlug} terms={terms} />
        </li>
      ))}
    </ul>
  );
}
