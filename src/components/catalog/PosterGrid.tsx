import type { Poster } from "@/data/types";
import { PosterCard } from "./PosterCard";

interface PosterGridProps {
  posters: Poster[];
  terms?: string[];
}

export function PosterGrid({ posters, terms }: PosterGridProps) {
  return (
    <ul className="poster-grid">
      {posters.map((poster) => (
        <li key={poster.slug}>
          <PosterCard poster={poster} terms={terms} />
        </li>
      ))}
    </ul>
  );
}
