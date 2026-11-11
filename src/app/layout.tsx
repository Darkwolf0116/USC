import type { Metadata, Viewport } from "next";
import { Montserrat, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-montserrat",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-source-sans",
});

export const metadata: Metadata = {
  title: "Repositorio de Proyectos de Aula · Fisioterapia USC",
  description:
    "Muestra académica del Programa de Fisioterapia de la Universidad Santiago de Cali: consulta los documentos de los cuatro ejes de investigación y abre el PDF completo.",
  icons: {
    icon: "/Info/logo.png",
    apple: "/Info/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#002b49",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${montserrat.variable} ${sourceSans.variable}`}>
      <body>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
