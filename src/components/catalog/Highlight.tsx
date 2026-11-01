import { highlightSegments } from "@/lib/search";

interface HighlightProps {
  text: string;
  /** Normalized search terms. Empty renders plain text. */
  terms: string[];
}

/** Renders `text` with every match of `terms` wrapped in <mark>. */
export function Highlight({ text, terms }: HighlightProps) {
  if (terms.length === 0) return <>{text}</>;
  return (
    <>
      {highlightSegments(text, terms).map((segment, index) =>
        segment.match ? (
          <mark className="hl" key={index}>
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}
