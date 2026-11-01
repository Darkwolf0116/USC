"use client";

import dynamic from "next/dynamic";
import { PdfViewerRoot } from "./PdfViewerContext";
import { PdfViewerHeader, PdfViewerToolbar } from "./PdfViewerParts";

/**
 * Only the react-pdf part is lazy and client-only: the PDF.js bundle and worker load
 * the first time a viewer opens, never during server rendering or on page load.
 */
const PdfViewerDocumentLazy = dynamic(() => import("./PdfViewerDocument"), {
  ssr: false,
  loading: () => (
    <div className="viewer__canvas">
      <div className="viewer__message" role="status">
        <p>Cargando el visor…</p>
      </div>
    </div>
  ),
});

/**
 * Compound PDF viewer.
 *
 *   <PdfViewer.Root title subtitle fileUrl onClose>
 *     <PdfViewer.Header />
 *     <PdfViewer.Toolbar />
 *     <PdfViewer.Document />
 *   </PdfViewer.Root>
 */
export const PdfViewer = {
  Root: PdfViewerRoot,
  Header: PdfViewerHeader,
  Toolbar: PdfViewerToolbar,
  Document: PdfViewerDocumentLazy,
};
