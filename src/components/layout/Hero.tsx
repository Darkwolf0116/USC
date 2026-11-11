import type { CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import { CATALOG_SECTION_ID } from "@/lib/constants";
import { BrandLogo } from "./BrandLogo";

/** Stagger index for the one hero entrance. */
const step = (index: number) => ({ "--i": index }) as CSSProperties;

export function Hero() {
  return (
    <section className="hero surface-navy" aria-labelledby="hero-title">
      <div className="container hero__inner">
        <div className="hero__text">
          <span className="hero__bar hero__enter" style={step(0)} aria-hidden="true" />
          <h1 className="hero__title hero__enter" id="hero-title" style={step(1)}>
            Muestra Académica de Proyectos de Aula
          </h1>
          <p className="hero__program hero__enter" style={step(2)}>
            Programa de Fisioterapia
          </p>
          <p className="hero__lead hero__enter" style={step(3)}>
            Consulta los documentos de los cuatro ejes de investigación y abre el PDF completo.
          </p>
          <div className="hero__action hero__enter" style={step(4)}>
            <a className="btn btn--primary btn--large" href={`#${CATALOG_SECTION_ID}`}>
              Explorar los ejes
              <ChevronDown size={20} aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="hero__visual hero__enter" style={step(2)}>
          <BrandLogo variant="hero" />
        </div>
      </div>
    </section>
  );
}
