/** A single academic poster (course project) shown in the repository. */
export interface Poster {
  slug: string;
  title: string;
  students: string[];
  /** Fictional advisor, written with the "Ft." prefix. */
  advisor: string;
  /** Academic period, for example "2026-2". */
  semester: string;
  summary: string;
  /** Public path to the PDF, for example "/posters/<slug>.pdf". */
  pdf: string;
  /** Optional public path to a raster thumbnail. When missing, a CSS miniature is drawn. */
  thumbnail?: string;
}

export interface Category {
  slug: string;
  name: string;
  description: string;
  posters: Poster[];
}

export interface CatalogData {
  categories: Category[];
}
