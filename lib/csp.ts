/**
 * Politique de sécurité du contenu, en mode BLOQUANT.
 *
 * Elle était en `Content-Security-Policy-Report-Only` depuis le lot 1 : elle
 * observait et journalisait sans rien empêcher. C'était le bon choix à ce
 * moment-là — poser une politique bloquante à l'aveugle met un site à terre,
 * et l'observation a d'ailleurs servi : c'est ainsi qu'on a découvert qu'elle
 * aurait cassé Google Fonts. Mais une politique qui n'empêche rien ne protège
 * de rien, et le passage à une plateforme ouverte à des inconnus enlève le
 * confort de la laisser en observation.
 *
 * Ce qu'elle apporte réellement : si un XSS stocké passait malgré
 * l'assainissement (`components/shared/SafeHTML.tsx`, DOMPurify), le script
 * injecté n'aurait pas le nonce du tour en cours et ne s'exécuterait pas.
 * C'est une seconde ligne, pas la première.
 *
 * Module PUR — testable sans navigateur ni serveur.
 */

export interface OptionsCsp {
  /** Valeur unique par requête, portée par les scripts légitimes. */
  nonce: string;
  /**
   * `true` pour les pages faites pour être intégrées ailleurs (les liens de
   * partage). Le reste de l'application n'a aucune raison d'être encadré :
   * l'y autoriser ouvrirait au détournement de clic.
   */
  encadrable?: boolean;
}

export function politiqueCsp({ nonce, encadrable = false }: OptionsCsp): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    `frame-ancestors ${encadrable ? "*" : "'self'"}`,

    // `strict-dynamic` : un script porteur du nonce peut en charger d'autres.
    // C'est ce qui fait fonctionner `next/script` — Turnstile est injecté par
    // le runtime de Next, lui-même noncé — sans avoir à énumérer les domaines
    // tiers, liste qu'on oublierait de tenir à jour.
    //
    // `'unsafe-inline'` et `https:` sont IGNORÉS par tout navigateur qui
    // comprend `strict-dynamic` ; ils ne servent que de repli pour les
    // navigateurs restés à CSP niveau 1, où ils valent mieux qu'un site cassé.
    // Les retirer ne renforcerait rien et casserait ces navigateurs-là.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:`,

    // Les styles gardent `'unsafe-inline'`, et c'est un arbitrage assumé :
    // React pose des attributs `style`, Next injecte ses styles critiques, et
    // les noncer tous demanderait de réécrire chaque composant. Le risque
    // porté par une injection de style — exfiltration par sélecteur d'attribut,
    // habillage trompeur — est sans commune mesure avec l'exécution de script.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",

    // Images produites par les modèles (data:), aperçus locaux (blob:), fonds
    // de carte et pièces jointes distantes.
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob:",

    // Flux SSE de la conversation, tuiles IGN, appels des connecteurs.
    "connect-src 'self' https:",

    // Le lecteur PDF crée un worker depuis /pdfjs/, servi par nous ; certaines
    // versions passent par un blob.
    "worker-src 'self' blob:",

    // Turnstile s'affiche dans son propre cadre.
    "frame-src 'self' https://challenges.cloudflare.com",

    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/**
 * Nonce d'une requête : 128 bits d'aléa, en base64url.
 *
 * `crypto.randomUUID` suffirait en entropie, mais produit une valeur au format
 * reconnaissable ; on prend des octets bruts. La fonction vit ici pour être
 * testée, et parce que le middleware s'exécute sur le runtime Edge où seul le
 * `crypto` global est disponible — pas `node:crypto`.
 */
export function nouveauNonce(): string {
  const octets = new Uint8Array(16);
  crypto.getRandomValues(octets);
  let brut = "";
  for (const o of Array.from(octets)) brut += String.fromCharCode(o);
  return btoa(brut).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
