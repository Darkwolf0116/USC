"use client";

import { useEffect, useRef, useSyncExternalStore, type KeyboardEvent } from "react";
import { useCatalog } from "./CatalogProvider";

export const TAB_PANEL_ID = "panel-categoria";
export const tabId = (slug: string) => `tab-${slug}`;

const LARGE_QUERY = "(min-width: 64rem)";

function subscribeToLayout(onChange: () => void): () => void {
  const media = window.matchMedia(LARGE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const readOrientation = () => (window.matchMedia(LARGE_QUERY).matches ? "vertical" : "horizontal");
const readServerOrientation = () => "horizontal" as const;

/**
 * WAI-ARIA tabs with automatic activation and a roving tabindex.
 * Horizontal scrolling chips on small screens, a vertical index from 64rem up.
 */
export function CategoryTabs() {
  const { state, actions, meta } = useCatalog();
  const orientation = useSyncExternalStore(subscribeToLayout, readOrientation, readServerOrientation);
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  // Keep the active chip visible inside the horizontal row without moving the page.
  useEffect(() => {
    const list = listRef.current;
    const tab = tabRefs.current.get(state.activeSlug);
    if (!list || !tab || orientation !== "horizontal") return;
    const target = tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2;
    list.scrollTo({ left: Math.max(0, target) });
  }, [state.activeSlug, orientation]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const slugs = meta.categories.map((category) => category.slug);
    const current = slugs.indexOf(state.activeSlug);
    let next = current;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (current + 1) % slugs.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (current - 1 + slugs.length) % slugs.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = slugs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const slug = slugs[next];
    actions.selectCategory(slug);
    tabRefs.current.get(slug)?.focus();
  };

  return (
    <div
      ref={listRef}
      className="tabs"
      role="tablist"
      aria-label="Categorías de proyectos"
      aria-orientation={orientation}
      onKeyDown={handleKeyDown}
    >
      {meta.categories.map((category) => {
        const selected = category.slug === state.activeSlug;
        return (
          <button
            key={category.slug}
            ref={(node) => {
              if (node) tabRefs.current.set(category.slug, node);
              return () => {
                tabRefs.current.delete(category.slug);
              };
            }}
            id={tabId(category.slug)}
            className="tab"
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={TAB_PANEL_ID}
            tabIndex={selected ? 0 : -1}
            onClick={() => actions.selectCategory(category.slug)}
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
