import Link from "next/link";
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
              Documentos de investigación del Programa de Fisioterapia, organizados en cuatro ejes.
            </p>
          </div>

          <nav aria-labelledby="footer-categories">
            <h2 className="site-footer__heading" id="footer-categories">
              Ejes de investigación
            </h2>
            <ul className="site-footer__list">
              {categories.map((category) => (
                <li key={category.slug}>
                  <CategoryLink slug={category.slug} className="site-footer__link">
                    Eje {category.number}: {category.name}
                  </CategoryLink>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-folders">
            <h2 className="site-footer__heading" id="footer-folders">
              Enlaces
            </h2>
            <ul className="site-footer__list">
              <li>
                <Link className="site-footer__link" href="/">
                  Inicio
                </Link>
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

        <p className="site-footer__bottom">2026. Programa de Fisioterapia, Universidad Santiago de Cali.</p>
      </div>
    </footer>
  );
}
