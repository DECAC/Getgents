import { StudioHome } from "@/components/builder/StudioHome";

/**
 * Accueil de Getgents : une page nue avec un champ unique où l'on décrit le
 * rôle du gent à construire (voir StudioHome).
 *
 * Elle vivait à `/builder`, où elle était l'« accueil du studio » — une porte
 * d'entrée cachée derrière une adresse d'outil. C'est pourtant le premier
 * geste de la plateforme : dire ce dont on a besoin. Elle prend donc l'adresse
 * d'accueil, et le studio garde `/builder` pour le travail sur un gent existant.
 */
export default function AccueilPage() {
  return <StudioHome />;
}
