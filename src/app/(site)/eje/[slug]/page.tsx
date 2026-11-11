import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AxisPage } from "@/components/axis/AxisPage";
import { CatalogArea } from "@/components/catalog/CatalogArea";
import { categories, findCategory } from "@/data/catalog";

type AxisParams = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: AxisParams): Promise<Metadata> {
  const { slug } = await params;
  const category = findCategory(slug);
  if (!category) notFound();
  return { title: `Eje ${category.number}: ${category.name} · Fisioterapia USC` };
}

async function AxisContent({ params }: AxisParams) {
  const { slug } = await params;
  const category = findCategory(slug);
  if (!category) notFound();

  return (
    <CatalogArea>
      <AxisPage category={category} />
    </CatalogArea>
  );
}

/** `params` is read inside <Suspense> so client navigation between axes stays instant. */
export default function AxisRoute({ params }: AxisParams) {
  return (
    <main id="contenido" tabIndex={-1}>
      <Suspense fallback={null}>
        <AxisContent params={params} />
      </Suspense>
    </main>
  );
}
