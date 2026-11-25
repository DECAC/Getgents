/**
 * Aperçu d'un lien de page partagée (Open Graph) — ce qu'affichent WhatsApp,
 * LinkedIn, Slack, iMessage quand on colle le lien. Module PUR.
 *
 * Ce que voit l'aperçu, le voit toute personne à qui le lien est montré (un
 * groupe WhatsApp entier) et le service qui le met en cache. D'où :
 *   - page PROTÉGÉE par code : le titre seul (déjà affiché sur l'écran du
 *     code), jamais d'extrait du contenu ;
 *   - destinataire écrit comme une adresse e-mail : jamais affiché ;
 *   - extrait de la page : refusé s'il contient une coordonnée.
 */

import { donneesPersonnelles } from "./donneesPersonnelles";
import type { Langue } from "./langueLecteur";

export interface ApercuLien {
  titre: string;
  description: string;
  /** « Pour Marie », « Pour Famille Martin » — null si rien de montrable. */
  pour: string | null;
  /** Intitulé du bouton de réponse, s'il est actif et la page non protégée. */
  action: string | null;
  protegee: boolean;
  /** Langue de l'aperçu : celle des lecteurs de la page (lot anglais 1). */
  langue: Langue;
  /** Capture de la page à montrer (option de l'auteur, version courante, page non protégée), sinon absent. */
  capture?: { pageId: string; version: number } | null;
}

const DESCRIPTION_MAX = 200;

/** Texte lisible d'un fragment HTML : balises retirées, entités courantes décodées, espaces resserrés. */
export function texteDe(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function couper(t: string, max: number): string {
  if (t.length <= max) return t;
  const c = t.slice(0, max - 1);
  const espace = c.lastIndexOf(" ");
  return `${(espace > max * 0.6 ? c.slice(0, espace) : c).replace(/[\s,;:.–—-]+$/, "")}…`;
}

function sansCoordonnees(t: string): boolean {
  const d = donneesPersonnelles(t);
  return d.emails.length === 0 && d.telephones.length === 0;
}

/**
 * Description écrite PAR LA PAGE : `<meta name="description">` ou
 * `og:description`, sinon le chapeau (paragraphe avant le premier intertitre). Null si la page
 * n'en dit rien d'utilisable (artefact React, page sans paragraphe…).
 */
export function descriptionDeLaPage(contenu: string): string | null {
  const html = contenu.slice(0, 200_000);
  const meta =
    /<meta\s[^>]*(?:name|property)\s*=\s*["'](?:description|og:description)["'][^>]*>/i.exec(html)?.[0] ?? null;
  const valeur = meta ? /content\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(meta) : null;
  const candidates: string[] = [];
  if (valeur) candidates.push(texteDe(valeur[1] ?? valeur[2] ?? ""));
  // Sinon le CHAPEAU : un paragraphe placé avant le premier intertitre
  // (`<h2>`), sous le titre. Plus loin, c'est une note ou un détail — « Arrondi
  // à l'euro supérieur » n'est pas une description.
  const corps = html.replace(/<(script|style|template|svg)[\s\S]*?<\/\1>/gi, " ");
  const avantIntertitre = corps.split(/<h2[\s>]/i)[0];
  const p = /<p[\s>][\s\S]*?<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = p.exec(avantIntertitre))) {
    const t = texteDe(m[0]);
    if (t.length >= 30) {
      candidates.push(t);
      break;
    }
  }
  for (const c of candidates) if (c.length >= 20 && sansCoordonnees(c)) return couper(c, DESCRIPTION_MAX);
  return null;
}

/** Le destinataire est-il montrable ? Une adresse e-mail, jamais. */
export function pourQui(destinataire: string): string | null {
  const d = destinataire.trim();
  if (!d || d.includes("@")) return null;
  return couper(d, 40);
}

export function apercuDuLien(p: {
  titre: string;
  contenu: string;
  destinataire: string;
  protegee: boolean;
  action: string | null;
  assistant: boolean;
  langue?: Langue;
}): ApercuLien {
  const en = p.langue === "en";
  const langue: Langue = en ? "en" : "fr";
  const titre = couper(p.titre.trim() || (en ? "Shared page" : "Page partagée"), 90);
  const pour = pourQui(p.destinataire);
  if (p.protegee)
    return {
      titre,
      pour,
      action: null,
      protegee: true,
      langue,
      description: en
        ? "Private page, protected by a code e-mailed to its recipient."
        : "Page privée, protégée par un code envoyé par e-mail à son destinataire.",
    };
  const extrait = descriptionDeLaPage(p.contenu);
  const phrases = en ? ["A page shared with you through a private link."] : ["Une page partagée avec vous par un lien privé."];
  if (p.action) phrases.push(en ? "You can reply in one click." : "Vous pouvez répondre en un clic.");
  if (p.assistant) phrases.push(en ? "A question? An assistant answers from the page." : "Une question ? Un assistant y répond à partir de la page.");
  return { titre, pour, action: p.action, protegee: false, langue, description: extrait ?? phrases.join(" ") };
}
