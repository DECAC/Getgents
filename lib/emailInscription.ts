/**
 * E-mails de l'inscription libre (18/11). Module PUR.
 *
 * Mêmes principes que `supabase/templates/invitation.html` : styles en
 * ligne et tableaux (la plupart des messageries ignorent les feuilles de
 * style). Le lien de confirmation pointe vers `/auth/confirm` : le jeton est
 * vérifié CÔTÉ SERVEUR.
 */

const echapper = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const POLICE = "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

function gabarit(apercu: string, titre: string, corps: string, bouton: { libelle: string; href: string }, pied: string): string {
  const href = echapper(bouton.href);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${echapper(titre)}</title></head>
<body style="margin:0;padding:0;background:#fbf3ed;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${echapper(apercu)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fbf3ed;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#fffdf9;border:1px solid #eadbd3;border-radius:16px;">
<tr><td style="padding:32px 32px 8px;${POLICE}"><span style="display:inline-block;width:32px;height:32px;line-height:32px;border-radius:8px;background:#ffdee2;color:#e65d76;font-weight:700;font-size:12px;text-align:center;">GG</span><span style="font-size:15px;font-weight:700;color:#2a1f19;vertical-align:middle;padding-left:8px;">Getgents Pages</span></td></tr>
<tr><td style="padding:16px 32px 0;${POLICE}color:#2a1f19;"><h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">${echapper(titre)}</h1>${corps}</td></tr>
<tr><td align="left" style="padding:0 32px 8px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:999px;background:#9a6b12;"><a href="${href}" style="display:inline-block;padding:13px 26px;${POLICE}font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${echapper(bouton.libelle)}</a></td></tr></table></td></tr>
<tr><td style="padding:16px 32px 0;${POLICE}"><p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#73665f;">Le bouton ne s'ouvre pas ? Copiez cette adresse dans votre navigateur :</p><p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${href}" style="color:#a0700e;">${href}</a></p></td></tr>
<tr><td style="padding:16px 32px 28px;border-top:1px solid #eadbd3;${POLICE}"><p style="margin:0;font-size:12px;line-height:1.6;color:#a2958f;">${pied}</p></td></tr>
</table></td></tr></table></body></html>`;
}

const p = (t: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#4a3f39;">${t}</p>`;

export function emailConfirmation(email: string, lien: string): { objet: string; html: string } {
  return {
    objet: "Activez votre compte Getgents Pages",
    html: gabarit(
      "Un clic pour activer votre compte et partager vos premières pages.",
      "Activez votre compte",
      p(`Un compte Getgents Pages vient d'être créé pour <b>${echapper(email)}</b>.`) +
        p("Ouvrez ce lien pour l'activer : vous arriverez directement sur vos pages."),
      { libelle: "Activer mon compte", href: lien },
      "Vous n'avez pas créé ce compte ? Ignorez ce message : sans ce lien, il ne sera jamais activé."
    ),
  };
}

/** Adresse déjà inscrite : on le lui dit à ELLE, pas à l'écran (qui ne doit pas révéler qui est inscrit). */
export function emailDejaInscrit(email: string, origine: string): { objet: string; html: string } {
  return {
    objet: "Vous avez déjà un compte Getgents Pages",
    html: gabarit(
      "Votre adresse a déjà un compte : connectez-vous, ou réinitialisez votre mot de passe.",
      "Vous avez déjà un compte",
      p(`Quelqu'un — sans doute vous — a voulu créer un compte avec <b>${echapper(email)}</b>, qui en a déjà un.`) +
        p("Connectez-vous avec votre mot de passe. Vous l'avez oublié ? « Mot de passe oublié » sur la page de connexion."),
      { libelle: "Me connecter", href: `${origine}/connexion` },
      "Ce n'était pas vous ? Ignorez ce message : rien n'a changé sur votre compte."
    ),
  };
}

/** Notification de l'éditeur, une par compte créé. Le texte libre est ÉCHAPPÉ. */
export function emailNouvelleInscription(email: string, pourQuoi: string, restantes: number): string {
  const reponse = pourQuoi.trim()
    ? `<blockquote style="margin:0 0 0 8px;padding-left:12px;border-left:3px solid #ccc">${echapper(pourQuoi).replace(/\n/g, "<br>")}</blockquote>`
    : "<p style=\"color:#777\">(pas de réponse)</p>";
  return (
    `<p><b>Nouvelle inscription à Getgents Pages</b></p>` +
    `<p><b>Adresse :</b> ${echapper(email)}</p>` +
    `<p><b>Avec qui, et quoi :</b></p>${reponse}` +
    `<p style="color:#777">Places restantes : ${restantes}. Le compte est actif dès que la personne ouvre son lien.</p>`
  );
}
