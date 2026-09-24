import type { Metadata } from "next";

// Page de travail PRIVÉE : son contenu vit dans le navigateur de celui qui l'a
// ouverte. Rien à y indexer, et l'adresse ne doit pas circuler dans les
// moteurs de recherche.
export const metadata: Metadata = {
  title: "Artefact — Getgents",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
