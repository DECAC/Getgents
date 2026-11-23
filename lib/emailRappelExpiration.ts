import { SEUIL_RAPPEL_HEURES } from "./dureeLien";

/**
 * E-mail de rappel d'expiration (lot « Partager », étape 2) : UN message par
 * auteur et par jour, qui regroupe ses liens à moins de 48 h de l'échéance,
 * avec un bouton « Prolonger » par lien et un « Tout prolonger ». Module PUR.
 *
 * Les boutons mènent à une page de confirmation (voir `jetonRappel.ts`).
 * Message de SERVICE, adressé au titulaire du compte : il porte un lien pour
 * ne plus le recevoir, et un réglage existe dans « Mon compte ».
 */

export interface LienRappel {
  destinataire: string;
  titrePage: string;
  expiresAt: string;
  /** Adresse de la page de confirmation pour CE lien. */
  urlProlonger: string;
}

export const LIENS_PAR_MAIL = 20;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const quand = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

export function objetRappel(n: number): string {
  return n === 1 ? `1 de vos liens expire dans moins de ${SEUIL_RAPPEL_HEURES} h` : `${n} de vos liens expirent dans moins de ${SEUIL_RAPPEL_HEURES} h`;
}

export function mailRappelExpiration(o: {
  liens: LienRappel[];
  /** Nombre total de liens concernés (peut dépasser ceux listés). */
  total: number;
  urlTout: string;
  urlPages: string;
  urlDesabonner: string;
  nom?: string | null;
}): { objet: string; html: string } {
  const liste = o.liens.slice(0, LIENS_PAR_MAIL);
  const autres = o.total - liste.length;
  const bouton = (url: string, texte: string, plein = true) =>
    `<a href="${esc(url)}" style="display:inline-block;padding:9px 16px;border-radius:999px;font-weight:600;font-size:14px;text-decoration:none;` +
    (plein ? "background:#9a6b12;color:#fff" : "border:1px solid #d9c9bf;color:#2a1f19") +
    `">${esc(texte)}</a>`;
  const lignes = liste
    .map(
      (l) =>
        `<tr><td style="padding:10px 0;border-top:1px solid #eadbd3"><b>${esc(l.destinataire)}</b><br>` +
        `<span style="color:#73665f;font-size:13px">${esc(l.titrePage)} · expire ${esc(quand(l.expiresAt))}</span></td>` +
        `<td style="padding:10px 0 10px 12px;border-top:1px solid #eadbd3;text-align:right;white-space:nowrap">${bouton(l.urlProlonger, "Prolonger de 30 jours", false)}</td></tr>`
    )
    .join("");
  const html =
    `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#2a1f19;line-height:1.5;max-width:560px">` +
    `<p>${o.nom ? `Bonjour ${esc(o.nom)},` : "Bonjour,"}</p>` +
    `<p>${o.total === 1 ? "Un de vos liens de partage expire" : `${o.total} de vos liens de partage expirent`} dans moins de ${SEUIL_RAPPEL_HEURES} h. ` +
    `Après l'échéance, ${o.total === 1 ? "il ne s'ouvrira" : "ils ne s'ouvriront"} plus — et un QR code imprimé ou projeté cesserait de fonctionner.</p>` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${lignes}</table>` +
    (autres > 0 ? `<p style="color:#73665f;font-size:13px">… et ${autres} autre${autres > 1 ? "s" : ""}.</p>` : "") +
    `<p style="margin:18px 0">${o.total > 1 ? bouton(o.urlTout, `Tout prolonger (${o.total})`) : ""} ${bouton(o.urlPages, "Ouvrir mes pages", o.total === 1)}</p>` +
    `<p style="color:#73665f;font-size:13px">Prolonger refait durer le lien 30 jours à partir d'aujourd'hui ; le lien et son QR code ne changent pas. ` +
    `Un clic ouvre une page de confirmation : rien n'est prolongé sans votre accord.</p>` +
    `<p style="color:#a2958f;font-size:12px">Vous recevez ce message parce que ces liens sont ceux de votre compte Getgents. ` +
    `<a href="${esc(o.urlDesabonner)}" style="color:#73665f">Ne plus recevoir ces rappels</a> (réglable aussi dans « Mon compte »).</p></div>`;
  return { objet: objetRappel(o.total), html };
}
