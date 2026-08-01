import { getShareLink, recordShareEvent, TOKEN_RE } from "@/lib/server/shareLinks";
import { getSupabaseAdmin } from "@/lib/server/supabase";
import { canOpen } from "@/lib/shareLink";
import { espaceForPublicLink } from "@/lib/espaceApiPayload";
import { SharedGentShell } from "@/components/shared-link/SharedGentShell";
import type { Espace } from "@/lib/types";
import styles from "./page.module.css";

// Jamais mis en cache : la validité du lien (révocation, expiration) doit être
// réévaluée à chaque ouverture, et l'ouverture doit être tracée.
export const dynamic = "force-dynamic";

function Refus({ titre, message }: { titre: string; message: string }) {
  return (
    <main className={styles.refus}>
      <div className={styles.card}>
        <h1 className={styles.titre}>{titre}</h1>
        <p className={styles.message}>{message}</p>
      </div>
    </main>
  );
}

export default async function SharedLinkPage({ params }: { params: { token: string } }) {
  const token = params.token;
  if (!TOKEN_RE.test(token)) {
    return <Refus titre="Lien invalide" message="Ce lien n'est pas reconnu. Vérifiez l'adresse reçue." />;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return (
      <Refus
        titre="Partage indisponible"
        message="La persistance n'est pas configurée sur cette instance : les liens de partage ne peuvent pas être ouverts."
      />
    );
  }

  let link;
  try {
    link = await getShareLink(token);
  } catch {
    return <Refus titre="Erreur" message="Impossible de vérifier ce lien pour le moment. Réessayez plus tard." />;
  }

  if (!link) {
    return <Refus titre="Lien introuvable" message="Ce lien n'existe pas ou a été supprimé." />;
  }
  if (!canOpen(link)) {
    return (
      <Refus
        titre={link.revokedAt ? "Lien révoqué" : "Lien expiré"}
        message={
          link.revokedAt
            ? "Son auteur a mis fin à ce partage. Demandez-lui un nouveau lien si nécessaire."
            : "Ce lien a atteint sa date d'expiration. Demandez-en un nouveau à son auteur."
        }
      />
    );
  }

  const { data, error } = await supabase
    .from("published_gents")
    .select("espace")
    .eq("id", link.gentId)
    .maybeSingle();
  if (error || !data) {
    return <Refus titre="Contenu indisponible" message="Le gent associé à ce lien n'est plus publié." />;
  }

  // Projection publique : liste blanche stricte, sans prompt système, sans
  // historique du créateur, sans secrets de connecteurs.
  const espace = espaceForPublicLink(data.espace as Espace);

  await recordShareEvent(token, "open", link.targetLabel);

  return <SharedGentShell token={token} espace={espace} />;
}
