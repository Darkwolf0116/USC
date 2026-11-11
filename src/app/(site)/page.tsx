import { CatalogArea } from "@/components/catalog/CatalogArea";
import { LegacyAxisRedirect } from "@/components/catalog/LegacyAxisRedirect";
import { AxisButtons } from "@/components/home/AxisButtons";
import { HomeIntro } from "@/components/home/HomeIntro";
import { IntroVideo } from "@/components/home/IntroVideo";

export default function Home() {
  return (
    <main id="contenido" tabIndex={-1}>
      <LegacyAxisRedirect />
      <CatalogArea>
        <HomeIntro />
        <IntroVideo />
        <AxisButtons />
      </CatalogArea>
    </main>
  );
}
