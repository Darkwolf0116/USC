import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { axisDisplays } from "@/data/axes";

/** One large link per research axis; each opens the axis page with its PDFs. */
export function AxisButtons() {
  return (
    <section className="axis-buttons" aria-labelledby="axis-buttons-title">
      <div className="container">
        <h2 className="axis-buttons__title" id="axis-buttons-title">
          Explora los ejes
        </h2>
        <ul className="axis-buttons__grid">
          {axisDisplays.map((axis) => (
            <li key={axis.slug}>
              <Link className="axis-button" href={axis.href}>
                <span className="axis-button__number">Eje {axis.number}</span>
                <span className="axis-button__name">{axis.shortName}</span>
                <span className="axis-button__full">{axis.fullName}</span>
                <span className="axis-button__foot">
                  <span className="axis-button__count">
                    {axis.documentCount} {axis.documentCount === 1 ? "documento" : "documentos"}
                  </span>
                  <ArrowRight className="axis-button__arrow" size={20} aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
