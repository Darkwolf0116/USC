"use client";

import {
  createContext,
  use,
  useId,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

export type PdfStatus = "loading" | "ready" | "error";

export interface PdfViewerState {
  page: number;
  numPages: number | null;
  /** Multiplier over the fit-to-width size. 1 means the page fills the available width. */
  zoom: number;
  status: PdfStatus;
}

export interface PdfViewerActions {
  nextPage: () => void;
  prevPage: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitWidth: () => void;
  documentLoaded: (numPages: number) => void;
  documentFailed: () => void;
  close: () => void;
}

export interface PdfViewerMeta {
  title: string;
  subtitle: string;
  fileUrl: string;
  titleId: string;
  canPrev: boolean;
  canNext: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  zoomPercent: number;
}

export interface PdfViewerContextValue {
  state: PdfViewerState;
  actions: PdfViewerActions;
  meta: PdfViewerMeta;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

type Action =
  | { type: "next" }
  | { type: "prev" }
  | { type: "zoom"; delta: number }
  | { type: "fit" }
  | { type: "loaded"; numPages: number }
  | { type: "failed" };

const INITIAL_STATE: PdfViewerState = { page: 1, numPages: null, zoom: 1, status: "loading" };

function reducer(state: PdfViewerState, action: Action): PdfViewerState {
  switch (action.type) {
    case "next":
      return state.numPages && state.page < state.numPages
        ? { ...state, page: state.page + 1 }
        : state;
    case "prev":
      return state.page > 1 ? { ...state, page: state.page - 1 } : state;
    case "zoom":
      return {
        ...state,
        zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((state.zoom + action.delta) * 100) / 100)),
      };
    case "fit":
      return { ...state, zoom: 1 };
    case "loaded":
      return { ...state, numPages: action.numPages, status: "ready", page: 1 };
    case "failed":
      return { ...state, status: "error" };
  }
}

const PdfViewerContext = createContext<PdfViewerContextValue | null>(null);

export function usePdfViewer(): PdfViewerContextValue {
  const value = use(PdfViewerContext);
  if (!value) throw new Error("PdfViewer parts must be rendered inside <PdfViewer.Root>.");
  return value;
}

interface RootProps {
  title: string;
  subtitle: string;
  fileUrl: string;
  onClose: () => void;
  children: ReactNode;
}

/** Owns the viewer state and exposes it to the compound parts through context. */
export function PdfViewerRoot({ title, subtitle, fileUrl, onClose, children }: RootProps) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const titleId = useId();

  const actions = useMemo<PdfViewerActions>(
    () => ({
      nextPage: () => dispatch({ type: "next" }),
      prevPage: () => dispatch({ type: "prev" }),
      zoomIn: () => dispatch({ type: "zoom", delta: ZOOM_STEP }),
      zoomOut: () => dispatch({ type: "zoom", delta: -ZOOM_STEP }),
      fitWidth: () => dispatch({ type: "fit" }),
      documentLoaded: (numPages) => dispatch({ type: "loaded", numPages }),
      documentFailed: () => dispatch({ type: "failed" }),
      close: onClose,
    }),
    [onClose],
  );

  const meta: PdfViewerMeta = {
    title,
    subtitle,
    fileUrl,
    titleId,
    canPrev: state.status === "ready" && state.page > 1,
    canNext: state.status === "ready" && state.numPages !== null && state.page < state.numPages,
    canZoomIn: state.status === "ready" && state.zoom < MAX_ZOOM,
    canZoomOut: state.status === "ready" && state.zoom > MIN_ZOOM,
    zoomPercent: Math.round(state.zoom * 100),
  };

  return (
    <PdfViewerContext value={{ state, actions, meta }}>
      <div className="viewer__frame">{children}</div>
    </PdfViewerContext>
  );
}
