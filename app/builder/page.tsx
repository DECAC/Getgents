import { StudioHome } from "@/components/builder/StudioHome";

/**
 * Accueil du Gent' studio : une page nue avec un champ unique où le créateur
 * décrit le rôle de son gent (voir StudioHome). Cette route ne redirige plus
 * vers le dernier gent ouvert — ouvrir le studio ne doit pas revenir à éditer
 * un gent qu'on n'a pas choisi.
 */
export default function BuilderPage() {
  return <StudioHome />;
}
