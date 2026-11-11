import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { categories } from "@/data/catalog";

/** Bottom navigation of an axis page: previous/next axis (disabled at the ends), all axes and home. */
export function AxisNav({ current }: { current: string }) {
  const index = categories.findIndex((category) => category.slug === current);
  const previous = index > 0 ? categories[index - 1] : undefined;
  const next = index >= 0 ? categories[index + 1] : undefined;

  return (
    <nav className="axis-nav" aria-label="Navegación entre ejes">
      <div className="axis-nav__steps">
        {previous ? (
          <Link className="btn btn--secondary" href={`/eje/${previous.slug}`}>
            <ArrowLeft size={18} aria-hidden="true" />
            Eje anterior
          </Link>
        ) : (
          <span className="btn btn--secondary" aria-disabled="true">
            <ArrowLeft size={18} aria-hidden="true" />
            Eje anterior
          </span>
        )}
        {next ? (
          <Link className="btn btn--secondary" href={`/eje/${next.slug}`}>
            Eje siguiente
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        ) : (
          <span className="btn btn--secondary" aria-disabled="true">
            Eje siguiente
            <ArrowRight size={18} aria-hidden="true" />
          </span>
        )}
      </div>

      <ul className="axis-nav__all">
        {categories.map((category) => (
          <li key={category.slug}>
            <Link
              className="axis-nav__link"
              href={`/eje/${category.slug}`}
              aria-current={category.slug === current ? "page" : undefined}
            >
              Eje {category.number}
            </Link>
          </li>
        ))}
      </ul>

      <Link className="btn btn--primary" href="/">
        <ArrowLeft size={18} aria-hidden="true" />
        Volver al inicio
      </Link>
    </nav>
  );
}
