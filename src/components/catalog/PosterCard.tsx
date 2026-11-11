"use client";

import Image from "next/image";
import { Download, Eye } from "lucide-react";
import type { Poster } from "@/data/types";
import { ReactionBar } from "@/components/reactions/ReactionBar";
import { posterKey } from "@/lib/reactions";
import { useCatalog } from "./CatalogProvider";
import { Highlight } from "./Highlight";

interface PosterCardProps {
  poster: Poster;
  /** Slug of the axis that holds the poster; part of its reaction key. */
  categorySlug: string;
  /** Normalized search terms to highlight. Leave empty outside search results. */
  terms?: string[];
}

/** PDF card: first-page preview, the title below it, then the reactions and the view and download actions. */
export function PosterCard({ poster, categorySlug, terms = [] }: PosterCardProps) {
  const { actions } = useCatalog();

  return (
    <article className="poster-card">
      <button
        type="button"
        className="poster-card__preview"
        style={{ aspectRatio: `${poster.thumbnailWidth} / ${poster.thumbnailHeight}` }}
        aria-label={`Abrir PDF: ${poster.title}`}
        aria-haspopup="dialog"
        onClick={(event) => actions.openViewer(poster, event.currentTarget)}
      >
        {/* Static WebP generated at build time: the optimizer adds nothing and /_next/image
            bypasses the access gate's cookie, so it is served as-is. */}
        <Image
          src={poster.thumbnail}
          alt={`Vista previa de ${poster.title}`}
          width={poster.thumbnailWidth}
          height={poster.thumbnailHeight}
          sizes="(min-width: 64rem) 15rem, (min-width: 40rem) 33vw, 80vw"
          unoptimized
        />
      </button>

      <h3 className="poster-card__title" title={poster.title}>
        <Highlight text={poster.title} terms={terms} />
      </h3>
      {poster.pages > 1 ? <p className="poster-card__pages">{poster.pages} páginas</p> : null}

      <ReactionBar variant="card" posterKey={posterKey(categorySlug, poster.slug)} title={poster.title} />

      <div className="poster-card__actions">
        <button
          type="button"
          className="btn btn--primary"
          aria-label={`Ver PDF: ${poster.title}`}
          aria-haspopup="dialog"
          onClick={(event) => actions.openViewer(poster, event.currentTarget)}
        >
          <Eye size={18} aria-hidden="true" />
          Ver PDF
        </button>
        <a
          className="btn btn--secondary"
          href={poster.pdf}
          download
          aria-label={`Descargar PDF: ${poster.title}`}
        >
          <Download size={18} aria-hidden="true" />
          Descargar PDF
        </a>
      </div>
    </article>
  );
}
