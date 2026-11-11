"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCatalog } from "./CatalogProvider";

/** Old links (`/?categoria=eje-3`, `/#eje-3`) now land on the axis page. */
export function LegacyAxisRedirect() {
  const router = useRouter();
  const { meta } = useCatalog();

  useEffect(() => {
    const redirect = () => {
      const fromQuery = new URLSearchParams(window.location.search).get("categoria");
      const slug = fromQuery ?? window.location.hash.replace(/^#/, "");
      if (slug && meta.categories.some((category) => category.slug === slug)) {
        router.replace(`/eje/${slug}`);
      }
    };
    redirect();
    window.addEventListener("hashchange", redirect);
    return () => window.removeEventListener("hashchange", redirect);
  }, [meta.categories, router]);

  return null;
}
