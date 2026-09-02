import { sendBrevoEmail } from "@/lib/server/brevo";

/**
 * E-mail d'invitation à un gent partagé.
 *
 * Ce qui n'y figure PAS, volontairement : le contenu du gent, son prompt
 * système, le nom de qui invite. Un e-mail voyage en clair, se transfère et
 * s'archive ; il annonce un partage et donne le chemin, rien de plus. Le
 * destinataire verra le gent une fois connecté, à travers les mêmes gardes
 * que tout le monde.
 *
 * L'envoi n'est jamais bloquant : l'accès est déjà accordé en base, et le
 * destinataire le trouvera à sa prochaine connexion même si l'e-mail se perd.
 */

/** Adresse publique du site. Exportée : la route de partage en a besoin pour
 *  composer le lien invité, et deux définitions divergeraient. */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://getgents.ai").replace(/\/+$/, "");
}

function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Deux populations, deux messages.
 *
 * Un INVITÉ en lecture n'a pas de compte à créer : il reçoit un lien qui
 * l'amène droit au gent. C'est la conséquence directe de l'accès restreint —
 * lui dire « créez un compte » le mènerait à un écran qui lui explique qu'il
 * ne peut pas, et le partage tomberait dans le vide.
 *
 * Un ÉDITEUR, lui, travaille sur le gent dans le studio : cela suppose une
 * session et des écritures attribuées à quelqu'un. Un lien ne peut pas le
 * porter, et son message doit donc dire la vérité — l'accès arrive quand son
 * compte existe.
 */
export async function envoyerInvitation(
  email: string,
  nomGent: string,
  role: "viewer" | "editor",
  lienInvite?: string | null
): Promise<void> {
  const base = appUrl();
  const invite = role === "viewer" && !!lienInvite;

  const corps = invite
    ? `
  <p style="margin:0 0 14px">
    « ${echapper(nomGent)} » vous est accessible : ouvrez-le et posez-lui vos questions.
  </p>
  <p style="margin:0 0 22px">
    <a href="${lienInvite}" style="display:inline-block;padding:10px 22px;border-radius:999px;background:#e65d76;color:#fff;text-decoration:none;font-weight:600">Ouvrir le gent</a>
  </p>
  <p style="margin:0;font-size:13px;color:#73665f">
    Aucun compte n'est nécessaire : ce lien vous est personnel, gardez-le.
  </p>`
    : `
  <p style="margin:0 0 14px">
    « ${echapper(nomGent)} » vous est accessible sur Getgents : vous pouvez le modifier
    avec son créateur.
  </p>
  <p style="margin:0 0 22px">
    <a href="${base}/connexion" style="display:inline-block;padding:10px 22px;border-radius:999px;background:#e65d76;color:#fff;text-decoration:none;font-weight:600">Ouvrir Getgents</a>
  </p>
  <p style="margin:0;font-size:13px;color:#73665f">
    Modifier un gent demande un compte. Si vous n'en avez pas encore, la personne qui
    vous a partagé ce gent peut vous en ouvrir un — Getgents est en accès restreint
    pour le moment.
  </p>`;

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#2a1f19;line-height:1.55">
  <h2 style="font-size:19px;letter-spacing:-0.02em;margin:0 0 14px">Un gent a été partagé avec vous</h2>${corps}
</div>`.trim();

  try {
    await sendBrevoEmail(email, `« ${nomGent} » a été partagé avec vous`, html);
  } catch {
    // Journalisé par sendBrevoEmail. Un échec d'envoi ne doit pas faire croire
    // à un partage raté : il a bien eu lieu.
  }
}
