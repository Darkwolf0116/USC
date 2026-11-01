import Link from "next/link";
import { BrandLogo } from "./BrandLogo";
import { CategoryMenu } from "./CategoryMenu";
import { MobileMenu } from "./MobileMenu";
import { SearchField } from "./SearchField";

export const SITE_TITLE = "Repositorio de Proyectos de Aula - Fisioterapia USC";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link className="brand" href="/" aria-label={`${SITE_TITLE}, inicio`}>
          <BrandLogo variant="header" />
          <span className="brand__title">{SITE_TITLE}</span>
        </Link>
        <div className="site-header__tools">
          <CategoryMenu />
          <SearchField variant="header" />
        </div>
        <MobileMenu />
      </div>
    </header>
  );
}
