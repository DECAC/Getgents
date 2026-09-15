import { ESPACES } from "@/lib/mock-data/espaces";
import { SuperGentShell } from "@/components/supergent/SuperGentShell";

/**
 * Gent' space : le « super gent ». Point d'entrée unique où l'on interroge
 * l'ensemble de ses gents sans avoir à choisir lequel ouvrir.
 *
 * Cette page vivait à `/accueil`, une adresse qui ne disait ni ce qu'on y
 * trouve ni à qui elle appartient — et qui entrait en concurrence avec
 * l'accueil de la plateforme, désormais installé là.
 *
 * `initialId` ne sert qu'à amorcer l'EspaceProvider (qui détient la liste des
 * gents) : aucun espace n'est ouvert sur cette page.
 */
export default function MySpacePage() {
  const first = Object.keys(ESPACES)[0] ?? "voyage";
  return <SuperGentShell initialId={first} />;
}
