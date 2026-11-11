"use client";

import {
  createContext,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Category, Poster } from "@/data/types";
import { CATALOG_SECTION_ID } from "@/lib/constants";
import { parseQuery, searchCatalog, type SearchGroup } from "@/lib/search";

const CATEGORY_PARAM = "categoria";
const SEARCH_DEBOUNCE_MS = 250;

export interface CatalogState {
  /** Raw text of the search field. */
  query: string;
  /** Debounced, trimmed text that drives the results. */
  searchTerm: string;
  /** Poster open in the PDF viewer, or null. */
  viewerPoster: Poster | null;
}

export interface SelectCategoryOptions {
  /** Scroll the axis section into view (smooth unless the user prefers reduced motion). */
  scroll?: boolean;
}

export interface CatalogActions {
  selectCategory: (slug: string, options?: SelectCategoryOptions) => void;
  setQuery: (query: string) => void;
  clearQuery: () => void;
  openViewer: (poster: Poster, trigger: HTMLElement | null) => void;
  closeViewer: () => void;
}

export interface CatalogMeta {
  categories: Category[];
  totalPosters: number;
  isSearching: boolean;
  results: SearchGroup[];
  resultCount: number;
  /** Normalized terms of the active search, used to highlight matches. */
  searchTerms: string[];
  /** Text for the polite live region, set once the debounce settles. */
  announcement: string;
}

export interface CatalogContextValue {
  state: CatalogState;
  actions: CatalogActions;
  meta: CatalogMeta;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function useCatalog(): CatalogContextValue {
  const value = use(CatalogContext);
  if (!value) {
    throw new Error("useCatalog must be used inside <CatalogProvider>.");
  }
  return value;
}

interface CatalogProviderProps {
  categories: Category[];
  children: ReactNode;
}

export function CatalogProvider({ categories, children }: CatalogProviderProps) {
  const [query, setQueryState] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewerPoster, setViewerPoster] = useState<Poster | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Deep link: /?categoria=eje-3 scrolls to that axis once on load (#eje-3 is handled natively).
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get(CATEGORY_PARAM);
    if (!slug || !categories.some((category) => category.slug === slug)) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(slug)?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [categories]);

  // Debounce the search so results (and the live region) settle once, not per keystroke.
  useEffect(() => {
    const trimmed = query.trim();
    const timer = window.setTimeout(
      () => setSearchTerm(trimmed),
      trimmed === "" ? 0 : SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [query]);

  // When a search starts below the fold, bring the results into view.
  useEffect(() => {
    if (!searchTerm) return;
    const section = document.getElementById(CATALOG_SECTION_ID);
    if (section && section.getBoundingClientRect().top > window.innerHeight * 0.5) {
      section.scrollIntoView({ block: "start" });
    }
  }, [searchTerm]);

  const outcome = useMemo(() => searchCatalog(categories, searchTerm), [categories, searchTerm]);
  const searchTerms = useMemo(() => parseQuery(searchTerm), [searchTerm]);

  const actions = useMemo<CatalogActions>(() => {
    const clearQuery = () => {
      setQueryState("");
      setSearchTerm("");
    };

    return {
      selectCategory: (slug, options) => {
        if (!categories.some((category) => category.slug === slug)) return;
        clearQuery();
        const url = new URL(window.location.href);
        url.searchParams.delete(CATEGORY_PARAM);
        window.history.replaceState(
          window.history.state,
          "",
          `${url.pathname}${url.search}#${slug}`,
        );
        if (options?.scroll) {
          // Wait one frame so the axis sections exist again after leaving search mode.
          window.requestAnimationFrame(() => {
            document.getElementById(slug)?.scrollIntoView({ block: "start" });
          });
        }
      },
      setQuery: setQueryState,
      clearQuery,
      openViewer: (poster, trigger) => {
        triggerRef.current = trigger;
        setViewerPoster(poster);
      },
      closeViewer: () => {
        setViewerPoster(null);
        const trigger = triggerRef.current;
        triggerRef.current = null;
        if (trigger) window.requestAnimationFrame(() => trigger.focus());
      },
    };
  }, [categories]);

  const isSearching = searchTerm !== "";
  const announcement = isSearching
    ? `${outcome.count} ${outcome.count === 1 ? "resultado" : "resultados"}`
    : "";

  const value: CatalogContextValue = {
    state: { query, searchTerm, viewerPoster },
    actions,
    meta: {
      categories,
      totalPosters: categories.reduce((sum, category) => sum + category.posters.length, 0),
      isSearching,
      results: outcome.groups,
      resultCount: outcome.count,
      searchTerms,
      announcement,
    },
  };

  return <CatalogContext value={value}>{children}</CatalogContext>;
}
