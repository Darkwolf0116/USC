import { CATALOG_SECTION_ID } from "@/lib/constants";
import { CategoryLink } from "@/components/catalog/CategoryLink";
import type { Category } from "@/data/types";
import { BrandLogo } from "./BrandLogo";

interface SiteFooterProps {
  categories: Category[];
}

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL;

export function SiteFooter({ categories }: SiteFooterProps) {
  return (
    <footer className="site-footer surface-navy">
      <div className="container">
        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <BrandLogo variant="footer" />
            <p className="site-footer__name">Universidad Santiago de Cali - Facultad de Salud</p>
            <p className="site-footer__program">Programa de Fisioterapia</p>
            <p className="site-footer__note">
              Mockup académico de proyectos de aula. Los nombres de estudiantes y docentes, los
              títulos y los pósteres son ilustrativos y no corresponden a personas ni trabajos reales.
            </p>
          </div>

          <nav aria-labelledby="footer-categories">
            <h2 className="site-footer__heading" id="footer-categories">
              Categorías
            </h2>
            <ul className="site-footer__list">
              {categories.map((category) => (
                <li key={category.slug}>
                  <CategoryLink slug={category.slug} className="site-footer__link">
                    {category.name}
                  </CategoryLink>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-folders">
            <h2 className="site-footer__heading" id="footer-folders">
              Carpetas del proyecto
            </h2>
            <ul className="site-footer__list">
              <li>
                <a className="site-footer__link" href={`#${CATALOG_SECTION_ID}`}>
                  Pósteres en PDF
                </a>
              </li>
              <li>
                <a className="site-footer__link" href="/Info/logo.png">
                  Recursos institucionales (Info)
                </a>
              </li>
              {REPO_URL ? (
                <li>
                  <a className="site-footer__link" href={REPO_URL} rel="noopener noreferrer">
                    Repositorio del proyecto
                  </a>
                </li>
              ) : null}
            </ul>
          </nav>
        </div>

        <p className="site-footer__bottom">2026. Mockup académico, Programa de Fisioterapia.</p>
      </div>
    </footer>
  );
}
