import { categories } from "./catalog";
import type { Category } from "./types";

/**
 * Short axis names used by the home page copy and buttons. They live here, keyed by slug,
 * because `catalog.json` is generated from `Ejes/` and must not be edited by hand.
 */
export const AXIS_SHORT_NAMES: Record<string, string> = {
  "eje-1": "Innovación y Tecnología",
  "eje-2": "Discapacidad y Procesos",
  "eje-3": "Actividad Física y Salud",
  "eje-4": "Desarrollo del Movimiento Humano",
};

export interface AxisDisplay {
  slug: string;
  number: number;
  /** Short name; falls back to the full name for axes added later. */
  shortName: string;
  fullName: string;
  documentCount: number;
  href: string;
}

export function toAxisDisplay(category: Category): AxisDisplay {
  return {
    slug: category.slug,
    number: category.number,
    shortName: AXIS_SHORT_NAMES[category.slug] ?? category.name,
    fullName: category.name,
    documentCount: category.posters.length,
    href: `/eje/${category.slug}`,
  };
}

export const axisDisplays: AxisDisplay[] = categories.map(toAxisDisplay);
