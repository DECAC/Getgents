import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lireArtefact } from "@/lib/server/artefactsPartages";
import { amorcesAssistant } from "@/lib/assistantDocument";
import { cookies } from "next/headers";
import VuePartage from "./VuePartage";
import EcranCode from "./EcranCode";
import { decisionAcces } from "@/lib/server/accesPartage";
import { masquerEmail, nomCookie } from "@/lib/accesCode";
import styles from "./partage.module.css";

/**
 * Un artefact partagé par le connecteur MCP, en pleine page.
 *
 * La page ne rend JAMAIS le contenu elle-même : elle l'encadre depuis
 * /api/partage/<jeton>/contenu, servi sous `sandbox`. Le cadre a son propre
 * attribut `sandbox` en plus — deux verrous indépendants. L'assistant du
 * document, s'il est activé, vit HORS du cadre, dans la page Getgents.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PagePartage({ params }: { params: { jeton: string } }) {
  const a = await lireArtefact(params.jeton);
  if (!a) notFound();
  const enFrancais = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
  const date = enFrancais(a.createdAt);
  // Le lien affiche la DERNIÈRE version de la page : on le dit, sinon le
  // destinataire qui l'a déjà lue croirait relire le même document.
  const heure = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
  const maj =
    a.misAJourLe && Date.parse(a.misAJourLe) > Date.parse(a.createdAt)
      ? enFrancais(a.misAJourLe) === date
        ? ` · mis à jour à ${heure(a.misAJourLe)}`
        : ` · mis à jour le ${enFrancais(a.misAJourLe)}`
      : "";
  const assistant = a.assistant && !!a.ownerId;
  // Page protégée : sans cookie d'accès valide, l'écran du code — et rien
  // du document (ni cadre, ni titre au-delà du bandeau).
  const decision = await decisionAcces(a, cookies().get(nomCookie(a.jeton))?.value);
  if (decision !== "ouvert")
    return (
      <div className={styles.page}>
        <header className={styles.bandeau}>
          <span className={styles.titre}>{a.titre}</span>
          <span className={styles.meta}>Lien privé · Getgents</span>
        </header>
        <EcranCode jeton={a.jeton} masque={masquerEmail(a.destinataire)} etat={decision} />
      </div>
    );

  return (
    <VuePartage
      jeton={a.jeton}
      titre={a.titre}
      assistant={assistant}
      amorces={amorcesAssistant(a.format)}
      bandeau={
        <>
          <span className={styles.titre}>{a.titre}</span>
          <span className={styles.meta}>
            Pour {a.destinataire} · {date}
            {maj}
          </span>
          <a className={styles.marque} href="/" target="_blank" rel="noopener noreferrer">
            Getgents
          </a>
        </>
      }
    />
  );
}
