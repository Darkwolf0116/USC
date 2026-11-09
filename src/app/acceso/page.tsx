import type { Metadata } from "next";
import { AccessGate } from "@/components/auth/AccessGate";

export const metadata: Metadata = {
  title: "Acceso · Repositorio de Proyectos de Aula · Fisioterapia USC",
  description: "Ingresa con tu nombre completo y tu correo institucional @usc.edu.co.",
  robots: { index: false },
};

export default function AccessPage() {
  return (
    <main id="contenido" tabIndex={-1} className="access">
      <AccessGate />
    </main>
  );
}
