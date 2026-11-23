/**
 * LIENS DE GROUPE et ENVOI PAR WHATSAPP (19/11, maquettes validées) — règles
 * PURES.
 *
 * WhatsApp : aucune API. Le bouton ouvre `wa.me` avec le message déjà rédigé ;
 * l'auteur choisit le contact ou le groupe et envoie depuis SON numéro.
 * Getgents ne voit ni ses contacts ni ses groupes. (L'API Business de Meta a
 * été écartée : compte vérifié, numéro dédié, modèles approuvés, coût — et un
 * numéro personnel automatisé est interdit par WhatsApp.)
 *
 * Lien de groupe : UN lien, une liste d'invités ; chacun choisit son prénom et
 * répond une fois. Le prénom n'est PAS vérifié : pour les proches, pas pour un
 * client — d'où l'avertissement à la création, et le blocage par la
 * protection par code (un nom n'a pas d'adresse où envoyer le code).
 */

export const INVITES_MAX = 50;
export const PRENOM_MAX = 60;

const propre = (s: string) =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Liste d'invités : une ligne par prénom, nettoyée, sans doublon (casse et accents près), bornée. */
export function invitesValides(brut: unknown): string[] {
  const lignes = typeof brut === "string" ? brut.split(/[\n,;]/) : Array.isArray(brut) ? brut.filter((x): x is string => typeof x === "string") : [];
  const vus = new Set<string>();
  const sortie: string[] = [];
  for (const l of lignes) {
    const p = propre(l).slice(0, PRENOM_MAX);
    if (!p) continue;
    const cle = cleInvite(p);
    if (vus.has(cle)) continue;
    vus.add(cle);
    sortie.push(p);
    if (sortie.length >= INVITES_MAX) break;
  }
  return sortie;
}

/** Comparaison des prénoms : sans casse ni accents (« lea » = « Léa »). */
export const cleInvite = (p: string) =>
  p
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** L'invité tel qu'il figure dans la liste, ou null s'il n'y est pas. */
export function inviteDeLaListe(invites: readonly string[], prenom: unknown): string | null {
  if (typeof prenom !== "string" || !prenom.trim()) return null;
  const c = cleInvite(prenom);
  return invites.find((i) => cleInvite(i) === c) ?? null;
}

/** Le message prêt à envoyer. Le prénom est absent pour un groupe (on salue tout le monde). */
export function messageWhatsApp(o: { prenom: string | null; titre: string; lien: string; langue?: "fr" | "en" }): string {
  // Lu par le destinataire : dans la langue des lecteurs de la page (lot anglais 1).
  if (o.langue === "en") return `${o.prenom ? `Hi ${o.prenom},` : "Hi everyone,"} here is “${o.titre}”: ${o.lien}`;
  const salut = o.prenom ? `Bonjour ${o.prenom},` : "Bonjour à tous,";
  return `${salut} voici « ${o.titre} » : ${o.lien}`;
}

export function messageRelance(o: { titre: string; lien: string; attente: readonly string[]; langue?: "fr" | "en" }): string {
  const n = o.attente;
  if (o.langue === "en") {
    const qui = n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
    return n.length
      ? `Quick reminder for “${o.titre}”: we're still waiting for ${qui}. Reply here: ${o.lien}`
      : `Thanks everyone for your replies to “${o.titre}”! ${o.lien}`;
  }
  const qui = n.length <= 1 ? n.join("") : `${n.slice(0, -1).join(", ")} et ${n[n.length - 1]}`;
  return n.length
    ? `Petit rappel pour « ${o.titre} » : il manque encore ${qui}. Votre réponse ici : ${o.lien}`
    : `Merci à tous pour vos réponses à « ${o.titre} » ! ${o.lien}`;
}

/** Relance d'un lien personnel : « Petit rappel : … ». */
export function messageRappel(o: { prenom: string | null; titre: string; lien: string; langue?: "fr" | "en" }): string {
  return `${o.langue === "en" ? "Quick reminder:" : "Petit rappel :"} ${messageWhatsApp(o)}`;
}

/** Ouvre WhatsApp (application ou WhatsApp Web) avec le texte prérempli ; rien n'est envoyé sans l'auteur. */
export const lienWhatsApp = (texte: string) => `https://wa.me/?text=${encodeURIComponent(texte)}`;

/** Le prénom choisi sur CET appareil, par lien (fonctionnel : sans lui, on redemanderait à chaque ouverture). */
export const clePrenom = (jeton: string) => `getgents:groupe:${jeton.slice(0, 32)}`;
