/**
 * Créer une page en COLLANT le code d'un artefact (13/11).
 *
 * Contourne le connecteur MCP : marche avec Claude, ChatGPT, Mistral, ou un
 * fichier fait à la main. Pas de contrôle de fidélité à faire — c'est
 * l'utilisateur qui colle le code exact —, mais les mêmes alertes que le
 * connecteur (artefact branché sur Claude, abréviations), plus le repérage
 * des données personnelles, qui vaut aussi pour le connecteur.
 *
 * Module PUR : il tourne dans le navigateur (aperçu pendant la frappe) ET sur
 * le serveur (revérification à l'enregistrement).
 */

import { CONTENU_MAX, controleFidelite, type FormatArtefact } from "./mcpPartage";
import { donneesPersonnelles } from "./donneesPersonnelles";

export { donneesPersonnelles };

/** Origine d'une page collée à la main (colonne `origine`) : affichée « Collée à la main ». */
export const ORIGINE_COLLAGE = "collage";

export function libelleOrigine(origine: string | null): string | null {
  if (!origine) return null;
  return origine === ORIGINE_COLLAGE ? "Collée à la main" : `Créée dans ${origine}`;
}

/**
 * Le collage nettoyé : BOM retiré, et un bloc de code Markdown qui ENTOURE
 * tout le contenu (« ```html … ``` », fréquent quand on copie une réponse
 * plutôt que l'artefact) est déballé.
 */
export function nettoyerCollage(brut: string): string {
  let s = brut.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  const bloc = s.match(/^```[a-z0-9-]*\s*\n([\s\S]*?)\n```\s*$/i);
  if (bloc) s = bloc[1].trim();
  return s;
}

const PAR_EXTENSION: Record<string, FormatArtefact> = {
  html: "html",
  htm: "html",
  jsx: "react",
  tsx: "react",
  js: "react",
  md: "markdown",
  markdown: "markdown",
  svg: "svg",
  txt: "texte",
};

/** Le format, d'après le nom du fichier s'il y en a un, sinon d'après le contenu. */
export function detecterFormat(contenu: string, nomFichier?: string): FormatArtefact {
  const ext = nomFichier?.split(".").pop()?.toLowerCase();
  if (ext && PAR_EXTENSION[ext]) return PAR_EXTENSION[ext];
  const s = contenu.trim();
  if (/^<svg[\s>]/i.test(s) || (/^<\?xml/i.test(s) && /<svg[\s>]/i.test(s))) return "svg";
  if (/^(<!doctype html|<html[\s>]|<head[\s>]|<body[\s>])/i.test(s)) return "html";
  // React : un module (import/export) ou un composant qui rend du JSX.
  if (/^\s*import\s.+from\s+['"]/m.test(s) || /export\s+default\s+(function|class|\(|[A-Z])/.test(s) || /\buse(State|Effect|Memo|Ref)\s*\(/.test(s))
    return "react";
  if (/^<[a-z][\w-]*[\s>]/i.test(s)) return "html";
  if (/^#{1,6}\s+\S/m.test(s) || /^\s*[-*]\s+\S/m.test(s) || /```/.test(s) || /\*\*[^*]+\*\*/.test(s)) return "markdown";
  return "texte";
}

const sansBalises = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Un titre à proposer : <title>, puis premier <h1>, puis premier titre Markdown, puis le nom du composant. */
export function titreDetecte(contenu: string, format: FormatArtefact): string {
  const net = (t: string | undefined) => (t ? sansBalises(t).slice(0, 200) : "");
  if (format === "markdown" || format === "texte") {
    const m = contenu.match(/^#{1,3}\s+(.+)$/m);
    if (m) return net(m[1].replace(/[*_`]/g, ""));
  }
  const t = net(contenu.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  if (t) return t;
  const h1 = net(contenu.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  if (h1 && !/[{}]/.test(h1)) return h1;
  if (format === "react") {
    const nom = contenu.match(/export\s+default\s+function\s+([A-Z][A-Za-z0-9]*)/)?.[1] ?? contenu.match(/function\s+([A-Z][A-Za-z0-9]*)\s*\(/)?.[1];
    if (nom && nom !== "App") return nom.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  }
  return "";
}

export type NiveauAlerte = "bloquant" | "attention" | "info";

export interface AlerteImport {
  niveau: NiveauAlerte;
  texte: string;
}

/** Ce qu'il faut dire à l'auteur avant qu'il crée (ou publie) la page. */
export function alertesImport(contenu: string, format: FormatArtefact): AlerteImport[] {
  const a: AlerteImport[] = [];
  if (!contenu.trim()) return [{ niveau: "bloquant", texte: "Collez le code de l'artefact, ou déposez un fichier." }];
  if (contenu.length > CONTENU_MAX)
    a.push({ niveau: "bloquant", texte: `Le contenu dépasse ${Math.round(CONTENU_MAX / 1_000_000)} Mo : retirez les images encodées, ou allégez la page.` });
  const f = controleFidelite(contenu, format);
  if (f.dependClaude)
    a.push({
      niveau: "attention",
      texte: "Cette page lit ses données en direct dans Claude : chez vos destinataires, ces parties resteront vides. Demandez à Claude une version figée, avec les données écrites dans la page.",
    });
  if (f.abreviationSuspecte)
    a.push({ niveau: "attention", texte: "Le code contient une marque d'abréviation (« … reste du code ») : il est probablement incomplet. Recopiez l'artefact entier." });
  const d = donneesPersonnelles(contenu);
  const trouvees = [...d.emails, ...d.telephones];
  if (trouvees.length)
    a.push({
      niveau: "attention",
      texte: `Relisez avant de partager : la page contient ${trouvees.length > 1 ? "des coordonnées" : "une coordonnée"} (${trouvees.slice(0, 3).join(", ")}${trouvees.length > 3 ? "…" : ""}). ${trouvees.length > 1 ? "Elles seront visibles" : "Elle sera visible"} de tous les destinataires.`,
    });
  return a;
}

/** Le texte VISIBLE d'un document, en lignes : ce qu'on compare d'une version à l'autre. */
export function lignesVisibles(contenu: string): string[] {
  return contenu
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "\n")
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/tr|\/td|\/th)[^>]*>/gi, "\n")
    .split("\n")
    .map(sansBalises)
    .filter((l) => l.length > 0);
}

export interface Difference {
  identique: boolean;
  /** Première ligne de texte visible qui diffère (null : seul le code a changé, ou rien). */
  avant: string | null;
  apres: string | null;
}

/**
 * Ce qui change entre deux versions, en UNE ligne : de quoi vérifier qu'on a
 * collé le bon code, sans moteur de comparaison complet.
 */
export function premiereDifference(avant: string, apres: string): Difference {
  if (avant.trim() === apres.trim()) return { identique: true, avant: null, apres: null };
  const a = lignesVisibles(avant);
  const b = lignesVisibles(apres);
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return { identique: false, avant: a[i]?.slice(0, 160) ?? null, apres: b[i]?.slice(0, 160) ?? null };
  }
  return { identique: false, avant: null, apres: null };
}

export const tailleLisible = (n: number) => (n < 1000 ? `${n} o` : n < 1_000_000 ? `${(n / 1000).toFixed(1).replace(".", ",")} ko` : `${(n / 1_000_000).toFixed(1).replace(".", ",")} Mo`);
