"use client";

import { useId, useRef, useState, type ToggleEvent } from "react";
import { ChevronDown } from "lucide-react";
import { useCatalog } from "@/components/catalog/CatalogProvider";
import { CategoryLink } from "@/components/catalog/CategoryLink";

/**
 * Desktop "Ejes" dropdown built on the Popover API: light dismiss (outside click),
 * Esc to close and top-layer stacking come from the platform.
 */
export function CategoryMenu() {
  const { meta } = useCatalog();
  const popoverId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const handleToggle = (event: ToggleEvent<HTMLDivElement>) => {
    const isOpen = event.newState === "open";
    setOpen(isOpen);
    const button = buttonRef.current;
    const popover = popoverRef.current;
    if (isOpen && button && popover) {
      const rect = button.getBoundingClientRect();
      popover.style.setProperty("--menu-top", `${Math.round(rect.bottom + 8)}px`);
      popover.style.setProperty(
        "--menu-right",
        `${Math.max(0, Math.round(document.documentElement.clientWidth - rect.right))}px`,
      );
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn--secondary menu-button"
        popoverTarget={popoverId}
        aria-expanded={open}
        aria-controls={popoverId}
      >
        Ejes
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      <div id={popoverId} ref={popoverRef} className="menu-popover" popover="auto" onToggle={handleToggle}>
        <ul className="menu-list">
          {meta.categories.map((category) => (
            <li key={category.slug}>
              <CategoryLink
                slug={category.slug}
                className="menu-link"
                onSelect={() => popoverRef.current?.hidePopover()}
              >
                Eje {category.number}: {category.name}
              </CategoryLink>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
