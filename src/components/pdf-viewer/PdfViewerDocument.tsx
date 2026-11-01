"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Download, ExternalLink, FileX, LoaderCircle } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { usePdfViewer } from "./PdfViewerContext";

// The worker must be configured in the same module that renders <Document> and <Page>.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

/** Stable object: a new reference on every render would reload the document. */
const DOCUMENT_OPTIONS = {
  standardFontDataUrl: "/pdfjs/standard_fonts/",
};

const CANVAS_PADDING = 32;

export function PdfViewerLoading() {
  return (
    <div className="viewer__message" role="status">
      <LoaderCircle className="viewer__spinner" size={32} aria-hidden="true" />
      <p>Cargando el PDF…</p>
    </div>
  );
}

function PdfViewerError() {
  const { meta } = usePdfViewer();
  return (
    <div className="viewer__message" role="alert">
      <FileX size={36} aria-hidden="true" />
      <p>No se pudo mostrar el PDF en esta ventana. Puedes descargarlo o abrirlo en una pestaña nueva.</p>
      <div className="viewer__message-actions">
        <a className="btn btn--primary" href={meta.fileUrl} download>
          <Download size={18} aria-hidden="true" />
          Descargar
        </a>
        <a
          className="btn btn--secondary"
          href={meta.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={18} aria-hidden="true" />
          Abrir en pestaña nueva
        </a>
      </div>
    </div>
  );
}

/** Renders the PDF with react-pdf. Loaded lazily from PdfViewer so it never reaches the server. */
export default function PdfViewerDocument() {
  const { state, actions, meta } = usePdfViewer();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);

  // Fit the page to the scroll area and keep it fitted when the window or panel resizes.
  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setAvailableWidth(Math.max(0, Math.floor(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const pageWidth = Math.max(0, availableWidth - CANVAS_PADDING);

  return (
    <div className="viewer__canvas" ref={canvasRef}>
      {state.status === "error" ? (
        <PdfViewerError />
      ) : (
        <div className="viewer__pages">
          <Document
            file={meta.fileUrl}
            options={DOCUMENT_OPTIONS}
            suspense={false}
            loading={<PdfViewerLoading />}
            error={<PdfViewerError />}
            onLoadSuccess={({ numPages }) => actions.documentLoaded(numPages)}
            onLoadError={() => actions.documentFailed()}
          >
            {pageWidth > 0 ? (
              <Page
                className="viewer__page"
                pageNumber={state.page}
                width={pageWidth}
                scale={state.zoom}
                loading={<PdfViewerLoading />}
              />
            ) : null}
          </Document>
        </div>
      )}
    </div>
  );
}
