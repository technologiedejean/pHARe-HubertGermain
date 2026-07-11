// >>> Ce fichier REMPLACE : app/layout.tsx <<<
import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";

// Police d'interface (nette, lisible)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Police d'accroche (serif chaleureux, utilisée avec parcimonie)
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: "pHARe — Espace référent",
  description:
    "Espace sécurisé du dispositif de lutte contre le harcèlement à l'École.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${inter.variable} ${fraunces.variable}`}
        style={{ fontFamily: "var(--font-inter)" }}
      >
        {children}
      </body>
    </html>
  );
}