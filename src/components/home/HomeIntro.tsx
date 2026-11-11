import { BrandLogo } from "@/components/layout/BrandLogo";

export function HomeIntro() {
  return (
    <section className="intro surface-navy" aria-labelledby="intro-title">
      <div className="container intro__inner">
        <div className="intro__text">
          <span className="intro__bar" aria-hidden="true" />
          <h1 className="intro__title" id="intro-title">
            Investigación en el Aula Ágora 2026
          </h1>
          <p className="intro__lead">
            Explora las propuestas de innovación, emprendimiento, podcasts, cartillas y pósters
            científicos de nuestros estudiantes. Conoce los proyectos organizados en nuestros cuatro
            ejes: Innovación y Tecnología, Discapacidad y Procesos, Actividad Física y Salud, y
            Desarrollo del Movimiento Humano.
          </p>
        </div>
        <div className="intro__visual">
          <BrandLogo variant="hero" />
        </div>
      </div>
    </section>
  );
}
