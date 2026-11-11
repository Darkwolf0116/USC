"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCatalog } from "./CatalogProvider";

interface CategoryLinkProps {
  slug: string;
  className?: string;
  children: ReactNode;
  /** Runs after the link is activated, for example to close a menu. */
  onSelect?: () => void;
}

/** Link to the axis page. It also leaves search mode so the page content is visible on arrival. */
export function CategoryLink({ slug, className, children, onSelect }: CategoryLinkProps) {
  const { actions } = useCatalog();
  const pathname = usePathname();
  const href = `/eje/${slug}`;

  return (
    <Link
      className={className}
      href={href}
      aria-current={pathname === href ? "page" : undefined}
      onClick={() => {
        actions.clearQuery();
        onSelect?.();
      }}
    >
      {children}
    </Link>
  );
}
