"use client";

import { useCatalog } from "./CatalogProvider";
import { TAB_PANEL_ID, tabId } from "./CategoryTabs";
import { PosterGrid } from "./PosterGrid";

export function CategoryPanel() {
  const { meta } = useCatalog();
  const category = meta.activeCategory;
  const count = category.posters.length;

  return (
    <div id={TAB_PANEL_ID} role="tabpanel" aria-labelledby={tabId(category.slug)} tabIndex={-1}>
      <header className="panel__head">
        <h2 className="panel__title">{category.name}</h2>
        <p className="panel__description">{category.description}</p>
        <p className="panel__count">
          {count} {count === 1 ? "póster" : "pósteres"}
        </p>
      </header>
      <PosterGrid posters={category.posters} />
    </div>
  );
}
