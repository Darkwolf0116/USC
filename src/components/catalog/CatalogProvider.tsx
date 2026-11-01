"use client";

import {
  createContext,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Category, Poster } from "@/data/types";
import { CATALOG_SECTION_ID } from "@/lib/constants";
import { parseQuery, searchCatalog, type SearchGroup } from "@/lib/search";

const CATEGORY_PARAM = "categoria";
const URL_EVENT = "catalog:urlchange";
const SEARCH_DEBOUNCE_MS = 250;

/* The active category lives in the URL (?categoria=<slug>) so a presenter can share links.
   It is read with useSyncExternalStore instead of useSearchParams: the server snapshot is the
   default category, the page stays fully prerendered and visible without JavaScript, and no
   Suspense boundary is needed. */
function subscribeToUrl(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(URL_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(URL_EVENT, onChange);
  };
}

function readCategoryFromUrl(): string {
  return new URLSearchParams(window.location.search).get(CATEGORY_PARAM) ?? "";
}

function readServerCategory(): string {
  return "";
}

export interface CatalogState {
  /** Slug of the category shown in the tab panel. */
  activeSlug: string;
  /** Raw text of the search field. */
  query: string;
  /** Debounced, trimmed text that drives the results. */
  searchTerm: string;
  /** Poster open in the PDF viewer, or null. */
  viewerPoster: Poster | null;
}

export interface SelectCategoryOptions {
  /** Smooth-scroll the categories section into view after selecting. */
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
  activeCategory: Category;
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
  const urlSlug = useSyncExternalStore(subscribeToUrl, readCategoryFromUrl, readServerCategory);
  const [query, setQueryState] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewerPoster, setViewerPoster] = useState<Poster | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const activeCategory = categories.find((category) => category.slug === urlSlug) ?? categories[0];

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
        const url = new URL(window.location.href);
        url.searchParams.set(CATEGORY_PARAM, slug);
        window.history.replaceState(
          window.history.state,
          "",
          `${url.pathname}${url.search}${url.hash}`,
        );
        window.dispatchEvent(new Event(URL_EVENT));
        clearQuery();
        if (options?.scroll) {
          document.getElementById(CATALOG_SECTION_ID)?.scrollIntoView({ block: "start" });
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
    state: { activeSlug: activeCategory.slug, query, searchTerm, viewerPoster },
    actions,
    meta: {
      categories,
      activeCategory,
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
