import type { CSSProperties } from "react";
import Image from "next/image";
import type { Poster } from "@/data/types";

/** Small deterministic generator so each miniature differs but never changes between renders. */
function sequence(seed: string, length: number, min: number, max: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const values: number[] = [];
  for (let i = 0; i < length; i += 1) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    values.push(min + (Math.abs(h) % 1000) / 1000 * (max - min));
  }
  return values;
}

const px = (value: number) => `${Math.round(value)}%`;

function vars(values: Record<string, string>): CSSProperties {
  return values as CSSProperties;
}

interface PosterPreviewProps {
  poster: Poster;
}

/**
 * Lightweight miniature of an A3 poster built from CSS. The wrapper keeps the 1:1.414
 * ratio so the card never shifts. When the poster has a `thumbnail`, that image is used.
 */
export function PosterPreview({ poster }: PosterPreviewProps) {
  if (poster.thumbnail) {
    return (
      <div className="poster-preview poster-preview--image" aria-hidden="true">
        <Image
          src={poster.thumbnail}
          alt=""
          fill
          sizes="(min-width: 64rem) 10.5rem, 40vw"
          style={{ objectFit: "cover" }}
        />
      </div>
    );
  }

  const titleWidths = sequence(`${poster.slug}:title`, 3, 62, 100).map(px);
  const left = sequence(`${poster.slug}:left`, 9, 55, 100).map(px);
  const right = sequence(`${poster.slug}:right`, 6, 55, 100).map(px);
  const bars = sequence(`${poster.slug}:bars`, 4, 30, 100).map(px);

  return (
    <div className="poster-preview" aria-hidden="true">
      <div className="poster-preview__band">
        <span className="poster-preview__badge" />
        <span className="poster-preview__band-lines">
          <span />
          <span />
        </span>
      </div>
      <div className="poster-preview__lead">
        {titleWidths.map((width, index) => (
          <span key={index} style={vars({ "--w": width })} />
        ))}
      </div>
      <div className="poster-preview__cols">
        <div className="poster-preview__col">
          <span className="is-head" style={vars({ "--w": "48%" })} />
          {left.slice(0, 4).map((width, index) => (
            <span key={index} style={vars({ "--w": width })} />
          ))}
          <span className="is-head" style={vars({ "--w": "40%" })} />
          {left.slice(4).map((width, index) => (
            <span key={index} style={vars({ "--w": width })} />
          ))}
        </div>
        <div className="poster-preview__col">
          <span className="is-head" style={vars({ "--w": "44%" })} />
          {right.slice(0, 3).map((width, index) => (
            <span key={index} style={vars({ "--w": width })} />
          ))}
          <span className="poster-preview__chart">
            {bars.map((height, index) => (
              <span key={index} style={vars({ "--h": height })} />
            ))}
          </span>
          {right.slice(3).map((width, index) => (
            <span key={index} style={vars({ "--w": width })} />
          ))}
        </div>
      </div>
    </div>
  );
}
