import { CatalogProvider } from "@/components/catalog/CatalogProvider";
import { CategoriesSection } from "@/components/catalog/CategoriesSection";
import { Hero } from "@/components/layout/Hero";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PdfViewerDialog } from "@/components/pdf-viewer/PdfViewerDialog";
import { categories } from "@/data/catalog";

export default function Home() {
  return (
    <CatalogProvider categories={categories}>
      <SiteHeader />
      <main id="contenido" tabIndex={-1}>
        <Hero />
        <CategoriesSection />
      </main>
      <SiteFooter categories={categories} />
      <PdfViewerDialog />
    </CatalogProvider>
  );
}
