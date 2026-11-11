"use client";

import type { MouseEvent, ReactNode } from "react";
import { useCatalog } from "./CatalogProvider";

interface CategoryLinkProps {
  slug: string;
  className?: string;
  children: ReactNode;
  /** Runs after the axis is selected, for example to close a menu. */
  onSelect?: () => void;
}

/**
 * A real in-page link (`#eje-N`) that works without JavaScript.
 * With JavaScript it also leaves search mode first, so the section exists before scrolling.
 */
export function CategoryLink({ slug, className, children, onSelect }: CategoryLinkProps) {
  const { actions } = useCatalog();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    actions.selectCategory(slug, { scroll: true });
    onSelect?.();
  };

  return (
    <a className={className} href={`#${slug}`} onClick={handleClick}>
      {children}
    </a>
  );
}
