"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  MoveHorizontal,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { usePdfViewer } from "./PdfViewerContext";

export function PdfViewerHeader() {
  const { actions, meta } = usePdfViewer();
  return (
    <div className="viewer__header">
      <h2 className="viewer__title" id={meta.titleId}>
        {meta.title}
        <span className="viewer__subtitle">
          {meta.subtitle}
        </span>
      </h2>
      <button
        type="button"
        className="btn btn--icon viewer__close"
        aria-label="Cerrar visor"
        data-autofocus=""
        onClick={actions.close}
      >
        <X size={22} aria-hidden="true" />
      </button>
    </div>
  );
}

export function PdfViewerToolbar() {
  const { state, actions, meta } = usePdfViewer();
  const pageLabel =
    state.numPages === null ? "Página" : `Página ${state.page} de ${state.numPages}`;

  return (
    <div className="viewer__toolbar" role="toolbar" aria-label="Herramientas del visor">
      <div className="viewer__group">
        <button
          type="button"
          className="btn btn--quiet btn--icon"
          aria-label="Página anterior"
          disabled={!meta.canPrev}
          onClick={actions.prevPage}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <span className="viewer__status" aria-live="polite">
          {pageLabel}
        </span>
        <button
          type="button"
          className="btn btn--quiet btn--icon"
          aria-label="Página siguiente"
          disabled={!meta.canNext}
          onClick={actions.nextPage}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="viewer__group">
        <button
          type="button"
          className="btn btn--quiet btn--icon"
          aria-label="Reducir zoom"
          disabled={!meta.canZoomOut}
          onClick={actions.zoomOut}
        >
          <ZoomOut size={20} aria-hidden="true" />
        </button>
        <span className="viewer__zoom" aria-label={`Zoom ${meta.zoomPercent} por ciento`}>
          {meta.zoomPercent}%
        </span>
        <button
          type="button"
          className="btn btn--quiet btn--icon"
          aria-label="Aumentar zoom"
          disabled={!meta.canZoomIn}
          onClick={actions.zoomIn}
        >
          <ZoomIn size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn--quiet viewer__action"
          aria-label="Ajustar al ancho"
          disabled={state.status !== "ready"}
          onClick={actions.fitWidth}
        >
          <MoveHorizontal size={20} aria-hidden="true" />
          <span className="viewer__label">Ajustar al ancho</span>
        </button>
      </div>

      <div className="viewer__group viewer__group--end">
        <a
          className="btn btn--secondary viewer__action"
          href={meta.fileUrl}
          download
          aria-label="Descargar"
        >
          <Download size={20} aria-hidden="true" />
          <span className="viewer__label">Descargar</span>
        </a>
        <a
          className="btn btn--secondary viewer__action"
          href={meta.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir en pestaña nueva"
        >
          <ExternalLink size={20} aria-hidden="true" />
          <span className="viewer__label">Abrir en pestaña nueva</span>
        </a>
      </div>
    </div>
  );
}
