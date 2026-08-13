import { ModulesPrototype } from "@/components/prototype/ModulesPrototype";

/**
 * Prototype de refonte des modules générés (artefacts). Route isolée, non
 * référencée dans la navigation : elle sert uniquement à juger l'expérience
 * avant d'engager la refonte du socle.
 */
export default function ModulesPrototypePage() {
  return <ModulesPrototype />;
}
