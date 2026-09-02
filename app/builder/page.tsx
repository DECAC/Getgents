import { redirect } from "next/navigation";

/**
 * Racine du Gent' studio.
 *
 * Elle portait l'« accueil du studio », parti à `/accueil` sous le nom
 * Getgents. Le studio commence donc par la question qu'il pose réellement :
 * sur quel gent travaille-t-on ? D'où le renvoi vers la liste.
 *
 * Une redirection plutôt qu'une copie de la liste : deux adresses servant le
 * même écran se disputent l'indexation et brouillent la navigation — on ne
 * saurait plus dire où l'on est.
 */
export default function BuilderPage() {
  redirect("/builder/mesgents");
}
