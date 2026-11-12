import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lireArtefact } from "@/lib/server/artefactsPartages";
import { amorcesAssistant } from "@/lib/assistantDocument";
import VuePartage from "./VuePartage";
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
  const date = new Date(a.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const assistant = a.assistant && !!a.ownerId;

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
          </span>
          <a className={styles.marque} href="/" target="_blank" rel="noopener noreferrer">
            Getgents
          </a>
        </>
      }
    />
  );
}
