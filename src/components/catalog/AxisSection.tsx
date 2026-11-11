import type { Category } from "@/data/types";
import { PosterGrid } from "./PosterGrid";

interface AxisSectionProps {
  category: Category;
}

/** One research axis: anchor id (`eje-N`), heading with its name and the grid of documents. */
export function AxisSection({ category }: AxisSectionProps) {
  const count = category.posters.length;
  const titleId = `${category.slug}-title`;

  return (
    <section id={category.slug} className="axis" aria-labelledby={titleId}>
      <header className="axis__head">
        <h2 className="axis__title" id={titleId}>
          <span className="axis__number">Eje {category.number}</span>
          <span className="axis__name">{category.name}</span>
        </h2>
        <p className="axis__count">
          {count} {count === 1 ? "documento" : "documentos"}
        </p>
      </header>
      <PosterGrid posters={category.posters} />
    </section>
  );
}
