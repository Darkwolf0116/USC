import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { PosterGrid } from "@/components/catalog/PosterGrid";
import type { Category } from "@/data/types";
import { AxisNav } from "./AxisNav";

interface AxisPageProps {
  category: Category;
}

/** Dedicated page of one research axis: breadcrumbs, heading, PDF grid and site navigation. */
export function AxisPage({ category }: AxisPageProps) {
  const count = category.posters.length;

  return (
    <div className="axis-page">
      <div className="container">
        <div className="axis-page__top">
          <nav aria-label="Ruta de navegación" className="breadcrumbs">
            <ol className="breadcrumbs__list">
              <li>
                <Link className="breadcrumbs__link" href="/">
                  Inicio
                </Link>
              </li>
              <li aria-hidden="true" className="breadcrumbs__sep">
                <ChevronRight size={16} />
              </li>
              <li>
                <span aria-current="page">Eje {category.number}</span>
              </li>
            </ol>
          </nav>
          <Link className="btn btn--secondary" href="/">
            <ArrowLeft size={18} aria-hidden="true" />
            Volver al inicio
          </Link>
        </div>

        <header className="axis__head">
          <h1 className="axis__title">
            <span className="axis__number">Eje {category.number}</span>
            <span className="axis__name">{category.name}</span>
          </h1>
          <p className="axis__count">
            {count} {count === 1 ? "documento" : "documentos"}
          </p>
        </header>

        <PosterGrid posters={category.posters} />

        <AxisNav current={category.slug} />
      </div>
    </div>
  );
}
