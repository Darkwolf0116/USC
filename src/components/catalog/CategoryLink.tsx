"use client";

import type { MouseEvent, ReactNode } from "react";
import { CATALOG_SECTION_ID } from "@/lib/constants";
import { useCatalog } from "./CatalogProvider";

interface CategoryLinkProps {
  slug: string;
  className?: string;
  children: ReactNode;
  /** Runs after the category is selected, for example to close a menu. */
  onSelect?: () => void;
}

/**
 * A real link (`?categoria=<slug>#categorias`) that works without JavaScript.
 * With JavaScript it selects the category in place and scrolls to the section.
 */
export function CategoryLink({ slug, className, children, onSelect }: CategoryLinkProps) {
  const { state, actions, meta } = useCatalog();
  const current = !meta.isSearching && state.activeSlug === slug;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    actions.selectCategory(slug, { scroll: true });
    onSelect?.();
  };

  return (
    <a
      className={className}
      href={`?categoria=${slug}#${CATALOG_SECTION_ID}`}
      aria-current={current ? "true" : undefined}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
