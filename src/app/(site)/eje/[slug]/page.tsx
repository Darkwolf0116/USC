import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AxisPage } from "@/components/axis/AxisPage";
import { CatalogArea } from "@/components/catalog/CatalogArea";
import { categories, findCategory } from "@/data/catalog";

export function generateStaticParams() {
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = findCategory(slug);
  if (!category) return {};
  return { title: `Eje ${category.number}: ${category.name} · Fisioterapia USC` };
}

export default async function AxisRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = findCategory(slug);
  if (!category) notFound();

  return (
    <main id="contenido" tabIndex={-1}>
      <CatalogArea>
        <AxisPage category={category} />
      </CatalogArea>
    </main>
  );
}
