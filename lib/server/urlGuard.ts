/**
 * Garde-fou anti-SSRF pour les URL fournies par un utilisateur.
 *
 * Les connecteurs « API REST » et les serveurs MCP sont configurés librement
 * par le créateur, puis appelés PAR LE SERVEUR, et le corps de la réponse lui
 * est renvoyé. Sans contrôle, c'est un proxy ouvert : `http://127.0.0.1:…`
 * atteint les services internes de l'hébergeur, et `http://169.254.169.254/`
 * les métadonnées de l'instance cloud (identifiants IAM). L'ancien filtre se
 * limitait à `/^https?:\/\//`, qui laisse tout passer.
 *
 * Ce module est PUR : il ne lit ni l'environnement ni le réseau, pour être
 * testable exhaustivement. La lecture de l'environnement se fait à l'appel,
 * via `connectorUrlPolicy()`.
 */

export interface UrlPolicy {
  /** Autoriser http:// — vrai seulement hors production (API locales de test). */
  allowHttp: boolean;
  /** Autoriser les hôtes privés — vrai seulement hors production. */
  allowPrivateHosts: boolean;
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

/** Politique appliquée aux connecteurs : stricte en production, souple en local. */
export function connectorUrlPolicy(): UrlPolicy {
  const production = process.env.NODE_ENV === "production";
  return { allowHttp: !production, allowPrivateHosts: !production };
}

const ALLOWED_PORTS = new Set(["", "80", "443"]);

/**
 * Suffixes d'hôte jamais publics. `metadata.google.internal` est nommé
 * explicitement : c'est la cible historique des exfiltrations d'identifiants
 * sur GCP, et elle ne tombe pas sous les autres règles.
 */
const PRIVATE_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
  ".lan",
];

const PRIVATE_NAMES = new Set(["localhost", "metadata.google.internal"]);

/**
 * Convertit un nom d'hôte en IPv4 s'il en est une, quelle que soit sa
 * notation. `http://2130706433/` vaut 127.0.0.1 et `http://0x7f.1/` aussi :
 * ne reconnaître que la forme pointée laisserait la porte grande ouverte.
 */
export function ipv4FromHostname(host: string): number | null {
  const parts = host.split(".");
  if (parts.length > 4 || parts.some((p) => p === "")) return null;

  const values: number[] = [];
  for (const part of parts) {
    let n: number;
    if (/^0[xX][0-9a-fA-F]+$/.test(part)) n = parseInt(part.slice(2), 16);
    else if (/^0[0-7]+$/.test(part)) n = parseInt(part.slice(1), 8);
    else if (/^\d+$/.test(part)) n = parseInt(part, 10);
    else return null;
    if (!Number.isFinite(n) || n < 0) return null;
    values.push(n);
  }

  // Notations courtes : « a.b » = a.0.0.b, « a » = entier 32 bits complet.
  const last = values[values.length - 1]!;
  const leading = values.slice(0, -1);
  if (leading.some((v) => v > 255)) return null;
  const maxLast = 2 ** (8 * (4 - leading.length));
  if (last >= maxLast) return null;

  let addr = 0;
  leading.forEach((v, i) => {
    addr += v * 2 ** (8 * (3 - i));
  });
  return addr + last;
}

function isPrivateIpv4(addr: number): boolean {
  const a = (addr >>> 24) & 0xff;
  const b = (addr >>> 16) & 0xff;
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // privé
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64/10
    (a === 169 && b === 254) || // link-local — métadonnées cloud
    (a === 172 && b >= 16 && b <= 31) || // privé
    (a === 192 && b === 168) || // privé
    (a === 192 && b === 0) || // 192.0.0/24 et 192.0.2/24
    (a === 198 && (b === 18 || b === 19)) || // bancs d'essai
    a >= 224 // multicast et réservé
  );
}

function isPrivateIpv6(host: string): boolean {
  const raw = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (raw === "::1" || raw === "::" || raw === "0:0:0:0:0:0:0:1") return true;
  // IPv4 encapsulée : ::ffff:127.0.0.1 vise la même machine.
  const mapped = raw.match(/^::ffff:(.+)$/);
  if (mapped) {
    const addr = ipv4FromHostname(mapped[1]!);
    if (addr !== null && isPrivateIpv4(addr)) return true;
  }
  const head = raw.split(":")[0] ?? "";
  // fc00::/7 (unique local) et fe80::/10 (link-local).
  return /^f[cd]/.test(head) || /^fe[89ab]/.test(head);
}

/** L'hôte désigne-t-il une machine non joignable depuis l'Internet public ? */
export function isPrivateHostname(host: string): boolean {
  const lower = host.toLowerCase();
  if (PRIVATE_NAMES.has(lower)) return true;
  if (PRIVATE_SUFFIXES.some((s) => lower.endsWith(s))) return true;
  if (lower.startsWith("[") || lower.includes(":")) return isPrivateIpv6(lower);

  const addr = ipv4FromHostname(lower);
  if (addr !== null) return isPrivateIpv4(addr);

  // Nom sans point : résolu par le suffixe de recherche interne du réseau
  // (`http://metadata/`, `http://redis/`). Aucune API publique n'a cette forme.
  return !lower.includes(".");
}

/**
 * Valide une URL de connecteur. Renvoie l'URL analysée, ou le motif du refus
 * — motif destiné au créateur, il doit lui dire quoi corriger.
 */
export function checkPublicHttpUrl(raw: string, policy: UrlPolicy): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: `URL de base invalide : ${raw}` };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: `Schéma non autorisé (${url.protocol}) : utilisez https://.` };
  }
  if (url.protocol === "http:" && !policy.allowHttp) {
    return { ok: false, reason: "Appel en clair refusé : utilisez https:// pour ce connecteur." };
  }
  if (url.username || url.password) {
    return {
      ok: false,
      reason: "Identifiants interdits dans l'URL : utilisez le champ « Clé d'API » du connecteur.",
    };
  }
  // Le port n'est bridé que sous la politique stricte : en local, une API de
  // test tourne sur n'importe quel port.
  if (!policy.allowPrivateHosts && !ALLOWED_PORTS.has(url.port)) {
    return { ok: false, reason: `Port non autorisé (${url.port}) : seuls 80 et 443 le sont.` };
  }
  if (!policy.allowPrivateHosts && isPrivateHostname(url.hostname)) {
    return {
      ok: false,
      reason: `Hôte non public refusé (${url.hostname}) : un connecteur ne peut appeler qu'une API accessible depuis Internet.`,
    };
  }

  return { ok: true, url };
}
