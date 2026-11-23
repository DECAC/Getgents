import type { Metadata } from "next";
import { lireJetonRappel } from "@/lib/jetonRappel";
import { clePourRappels } from "@/lib/server/rappelsExpiration";
import { lienDuCompte, liensExpirantEntre } from "@/lib/server/artefactsPartages";
import { dateLisible } from "@/lib/langueLecteur";
import ConfirmerRappel from "./ConfirmerRappel";
import styles from "./rappel.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Prolonger vos liens", robots: { index: false, follow: false } };

/**
 * Page de CONFIRMATION d'un lien d'e-mail de rappel. Le GET ne change rien :
 * il montre ce qui sera fait ; seul le bouton (POST /api/rappel) agit. Les
 * messageries d'entreprise ouvrent les liens pour les analyser.
 */
export default async function PageRappel({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lu = lireJetonRappel(token, clePourRappels(), Date.now());
  if (!lu.ok)
    return (
      <main className={styles.page}>
        <div className={styles.carte}>
          <h1>{lu.raison === "expire" ? "Ce lien d'e-mail a expiré" : "Lien invalide"}</h1>
          <p>{lu.raison === "expire" ? "Vous pouvez prolonger vos liens depuis votre compte." : "Ce lien n'est pas reconnu."}</p>
          <a className={styles.lien} href="/pages">Ouvrir Mes pages</a>
        </div>
      </main>
    );
  const j = lu.jeton;
  let titre: string;
  let detail: string;
  let libelle: string;
  let lignes: string[] = [];
  try {
    if (j.t === "d") {
      titre = "Ne plus recevoir ces rappels ?";
      detail = "Vous ne recevrez plus d'e-mail avant l'expiration de vos liens. Vous pourrez les rétablir dans Mon compte.";
      libelle = "Ne plus recevoir de rappels";
    } else {
      const liens = j.t === "p" ? [await lienDuCompte(j.u, j.j)].filter((l) => l !== null) : await liensExpirantEntre(j.u, j.de, j.a);
      lignes = liens.map((l) => `${l!.titrePage} — ${l!.destinataire}${l!.expiresAt ? ` (jusqu'au ${dateLisible(l!.expiresAt, "fr")})` : ""}`);
      titre = liens.length > 1 ? `Prolonger ${liens.length} liens de 30 jours ?` : "Prolonger ce lien de 30 jours ?";
      detail = liens.length
        ? "Le lien et son QR code ne changent pas : seule la durée est prolongée, à partir d'aujourd'hui."
        : "Aucun lien à prolonger : ils ont peut-être déjà été prolongés ou révoqués.";
      libelle = liens.length > 1 ? `Prolonger ${liens.length} liens` : "Prolonger de 30 jours";
      if (!liens.length) libelle = "";
    }
  } catch {
    return (
      <main className={styles.page}>
        <div className={styles.carte}>
          <h1>Service momentanément indisponible</h1>
          <p>Réessayez dans un instant.</p>
        </div>
      </main>
    );
  }
  return (
    <main className={styles.page}>
      <div className={styles.carte}>
        <h1>{titre}</h1>
        {lignes.length > 0 && (
          <ul className={styles.liste}>
            {lignes.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        )}
        <p>{detail}</p>
        {libelle ? <ConfirmerRappel token={token} libelle={libelle} desabonner={j.t === "d"} /> : <a className={styles.lien} href="/pages">Ouvrir Mes pages</a>}
      </div>
    </main>
  );
}
