import type { ReactNode } from "react";
import { AssistantLauncher } from "@/components/assistant/AssistantLauncher";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { AssistantProvider } from "@/components/assistant/AssistantProvider";
import { CatalogProvider } from "@/components/catalog/CatalogProvider";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PdfViewerDialog } from "@/components/pdf-viewer/PdfViewerDialog";
import { categories } from "@/data/catalog";

/**
 * Shared shell for the home page and the axis pages. Keeping the providers here means the
 * assistant conversation, the search query and the PDF viewer survive navigation.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <CatalogProvider categories={categories}>
      <SiteHeader />
      {children}
      <SiteFooter categories={categories} />
      <PdfViewerDialog />
      <AssistantProvider>
        <AssistantLauncher />
        <AssistantPanel />
      </AssistantProvider>
    </CatalogProvider>
  );
}
