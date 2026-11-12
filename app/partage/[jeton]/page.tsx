import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lireArtefact } from "@/lib/server/artefactsPartages";
import styles from "./partage.module.css";

/**
 * Un artefact partagé par le connecteur MCP, en pleine page (phase 0).
 *
 * La page ne rend JAMAIS le contenu elle-même : elle l'encadre depuis
 * /api/partage/<jeton>/contenu, servi sous `sandbox`. Le cadre a son propre
 * attribut `sandbox` en plus — deux verrous indépendants.
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

  return (
    <div className={styles.page}>
      <header className={styles.bandeau}>
        <span className={styles.titre}>{a.titre}</span>
        <span className={styles.meta}>
          Pour {a.destinataire} · {date}
        </span>
        <a className={styles.marque} href="/" target="_blank" rel="noopener noreferrer">
          Getgents
        </a>
      </header>
      <iframe
        className={styles.cadre}
        src={`/api/partage/${encodeURIComponent(a.jeton)}/contenu`}
        title={a.titre}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-downloads"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
