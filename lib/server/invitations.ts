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

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://getgents.ai").replace(/\/+$/, "");
}

function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function envoyerInvitation(
  email: string,
  nomGent: string,
  role: "viewer" | "editor"
): Promise<void> {
  const base = appUrl();
  const quoi = role === "editor" ? "le modifier avec son créateur" : "le consulter";
  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#2a1f19;line-height:1.55">
  <h2 style="font-size:19px;letter-spacing:-0.02em;margin:0 0 14px">Un gent a été partagé avec vous</h2>
  <p style="margin:0 0 14px">
    « ${echapper(nomGent)} » vous est accessible sur Getgents : vous pouvez ${quoi}.
  </p>
  <p style="margin:0 0 22px">
    <a href="${base}/connexion" style="display:inline-block;padding:10px 22px;border-radius:999px;background:#e65d76;color:#fff;text-decoration:none;font-weight:600">Ouvrir Getgents</a>
  </p>
  <p style="margin:0;font-size:13px;color:#73665f">
    Vous n'avez pas encore de compte ? Créez-en un avec cette adresse e-mail :
    le gent apparaîtra dans votre espace dès votre première connexion.
  </p>
</div>`.trim();

  try {
    await sendBrevoEmail(email, `« ${nomGent} » a été partagé avec vous`, html);
  } catch {
    // Journalisé par sendBrevoEmail. Un échec d'envoi ne doit pas faire croire
    // à un partage raté : il a bien eu lieu.
  }
}
