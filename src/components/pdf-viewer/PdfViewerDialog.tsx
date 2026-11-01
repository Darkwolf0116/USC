"use client";

import { useCallback, useEffect, useRef, type MouseEvent, type SyntheticEvent } from "react";
import type { Poster } from "@/data/types";
import { useCatalog } from "@/components/catalog/CatalogProvider";
import { lockScroll, unlockScroll } from "@/lib/scroll-lock";
import { PdfViewer } from "./PdfViewer";

const EXIT_MS = 220;
const EXIT_REDUCED_MS = 120;

/**
 * Modal variant of the viewer: a native <dialog> opened with showModal().
 * Esc, backdrop click and the close button all run the same animated close.
 */
export function PdfViewerDialog() {
  const { state, actions } = useCatalog();
  const poster = state.viewerPoster;
  if (!poster) return null;
  return <ViewerModal key={poster.slug} poster={poster} onClosed={actions.closeViewer} />;
}

interface ViewerModalProps {
  poster: Poster;
  onClosed: () => void;
}

function ViewerModal({ poster, onClosed }: ViewerModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closingRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Guard: React Strict Mode runs effects twice in development.
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    lockScroll();
    return unlockScroll;
  }, []);

  const requestClose = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || closingRef.current) return;
    closingRef.current = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    dialog.setAttribute("data-closing", "");
    window.setTimeout(() => {
      if (dialog.open) dialog.close();
    }, reduced ? EXIT_REDUCED_MS : EXIT_MS);
  }, []);

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    // Esc: take over so the exit animation can run before the dialog closes.
    event.preventDefault();
    requestClose();
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) requestClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="viewer keep-motion"
      aria-label={`Visor de PDF: ${poster.title}`}
      onCancel={handleCancel}
      onClose={onClosed}
      onClick={handleBackdropClick}
    >
      <PdfViewer.Root
        title={poster.title}
        subtitle={`Docente: ${poster.advisor}. Semestre ${poster.semester}`}
        fileUrl={poster.pdf}
        onClose={requestClose}
      >
        <PdfViewer.Header />
        <PdfViewer.Toolbar />
        <PdfViewer.Document />
      </PdfViewer.Root>
    </dialog>
  );
}
