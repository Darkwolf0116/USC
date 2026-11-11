import { CatalogArea } from "@/components/catalog/CatalogArea";
import { LegacyAxisRedirect } from "@/components/catalog/LegacyAxisRedirect";
import { Hero } from "@/components/layout/Hero";

export default function Home() {
  return (
    <main id="contenido" tabIndex={-1}>
      <LegacyAxisRedirect />
      <CatalogArea>
        <Hero />
      </CatalogArea>
    </main>
  );
}
