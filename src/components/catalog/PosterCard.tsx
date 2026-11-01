"use client";

import { Download, Eye } from "lucide-react";
import type { Poster } from "@/data/types";
import { useCatalog } from "./CatalogProvider";
import { Highlight } from "./Highlight";
import { PosterPreview } from "./PosterPreview";

interface PosterCardProps {
  poster: Poster;
  /** Normalized search terms to highlight. Leave empty outside search results. */
  terms?: string[];
}

export function PosterCard({ poster, terms = [] }: PosterCardProps) {
  const { actions } = useCatalog();

  return (
    <article className="poster-card">
      <div className="poster-card__media">
        <PosterPreview poster={poster} />
      </div>

      <div className="poster-card__body">
        <h3 className="poster-card__title">
          <Highlight text={poster.title} terms={terms} />
        </h3>
        <div className="poster-card__meta">
          <p>
            <strong>Estudiantes:</strong>{" "}
            {poster.students.map((student, index) => (
              <span key={student}>
                {index > 0 ? ", " : ""}
                <Highlight text={student} terms={terms} />
              </span>
            ))}
          </p>
          <p>
            <strong>Docente:</strong> <Highlight text={poster.advisor} terms={terms} />
          </p>
          <p>
            <strong>Semestre:</strong> <span className="num">{poster.semester}</span>
          </p>
        </div>
        <p className="poster-card__summary">{poster.summary}</p>
      </div>

      <div className="poster-card__actions">
        <button
          type="button"
          className="btn btn--primary"
          aria-label={`Ver PDF completo: ${poster.title}`}
          aria-haspopup="dialog"
          onClick={(event) => actions.openViewer(poster, event.currentTarget)}
        >
          <Eye size={18} aria-hidden="true" />
          Ver PDF completo
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
