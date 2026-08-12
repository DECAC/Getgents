import { ESPACES } from "@/lib/mock-data/espaces";
import { SuperGentShell } from "@/components/supergent/SuperGentShell";

/**
 * Accueil du Gent' space : le « super gent ». Point d'entrée unique où l'on
 * interroge l'ensemble de ses gents sans avoir à choisir lequel ouvrir.
 *
 * `initialId` ne sert qu'à amorcer l'EspaceProvider (qui détient la liste des
 * gents) : aucun espace n'est ouvert sur cette page.
 */
export default function AccueilPage() {
  const first = Object.keys(ESPACES)[0] ?? "voyage";
  return <SuperGentShell initialId={first} />;
}
