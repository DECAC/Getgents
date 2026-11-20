import { etatInscriptions } from "@/lib/server/inscriptions";
import { AccesRestreint, FormulaireInscription } from "./Formulaires";

/**
 * /inscription : formulaire d'inscription tant qu'il reste des places
 * (`INSCRIPTIONS_PLAFOND`), sinon la demande d'accès. Le formulaire fermé
 * n'est pas masqué, il n'est pas monté : un champ caché reste soumettable.
 */
export const dynamic = "force-dynamic";

export default async function InscriptionPage() {
  const etat = await etatInscriptions();
  if (etat.genre === "ouvertes") return <FormulaireInscription />;
  return <AccesRestreint complet={etat.genre === "completes"} />;
}
