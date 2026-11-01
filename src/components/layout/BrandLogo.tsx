"use client";

import { useState } from "react";
import Image from "next/image";

type BrandLogoVariant = "header" | "footer" | "hero";

const VARIANT_CLASS: Record<BrandLogoVariant, string> = {
  header: "brand-tile",
  footer: "brand-tile brand-tile--lg",
  hero: "brand-tile brand-tile--hero",
};

interface BrandLogoProps {
  variant: BrandLogoVariant;
}

/**
 * Institutional logo inside a tile that matches the file's baked-in background.
 * If `/Info/logo.png` is missing or fails to load, an "USC" monogram tile replaces it.
 */
export function BrandLogo({ variant }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`${VARIANT_CLASS[variant]} brand-tile--monogram`}
        data-fallback="true"
        role="img"
        aria-label="Universidad Santiago de Cali, Fisioterapia"
      >
        <strong aria-hidden="true">USC</strong>
        <span aria-hidden="true">Fisioterapia</span>
      </span>
    );
  }

  return (
    <span className={VARIANT_CLASS[variant]}>
      {/* `unoptimized` keeps the public URL (/Info/logo.png) so a missing file is detected here. */}
      <Image
        ref={(image) => {
          // An error can fire before hydration attaches onError; catch that case here.
          if (image && image.complete && image.naturalWidth === 0) setFailed(true);
        }}
        src="/Info/logo.png"
        alt="Logotipo de la Universidad Santiago de Cali"
        width={720}
        height={612}
        unoptimized
        loading={variant === "hero" ? "eager" : undefined}
        fetchPriority={variant === "footer" ? "low" : undefined}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
