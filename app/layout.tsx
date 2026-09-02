import type { Metadata } from "next";
import "./globals.css";
import { NavMobileProvider } from "@/lib/context/NavMobileContext";

/**
 * Aucune page n'est pré-générée.
 *
 * Le nonce de la politique de sécurité change à chaque requête. Une page
 * pré-générée à la compilation ne peut donc pas en porter : son HTML figé
 * garderait un nonce périmé, ou aucun — et tous les scripts de Next y seraient
 * bloqués par notre propre politique. La page s'afficherait sans jamais
 * s'animer, sans erreur visible ailleurs que dans la console.
 *
 * La consigne est posée sur le layout RACINE, donc héritée par toutes les
 * routes : neuf pages étaient concernées, et l'oubli d'une seule aurait suffi.
 * Le coût est nul ici — chaque écran dépend déjà de la session ou de la base.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Getgents — Espace",
  description: "Votre espace de travail avec vos gents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <NavMobileProvider>{children}</NavMobileProvider>
      </body>
    </html>
  );
}
